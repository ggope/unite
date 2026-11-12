import { sendPending } from '@/lib/push/send';
import { createClient } from '@supabase/supabase-js';
import { parseFeed, shorten } from './parse';
import { classify, tokens, sameStory } from './classify';

const MAX_AGE_H = 72, PER_FEED = 40;

// Reads every active source, keeps stories that fit a UNIER cause, groups the same story across outlets.
export async function runImport() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: sources } = await sb.from('news_sources').select('id, name, feed_url, lang').eq('active', true);
  const since = new Date(Date.now() - MAX_AGE_H * 3.6e6);
  const { data: recent } = await sb.from('news_items').select('url, title, topic, lang, story_key').gte('published_at', since.toISOString());
  const known = new Set((recent ?? []).map((r) => r.url));
  const pool = (recent ?? []).map((r) => ({ ...r, tk: tokens(r.title) }));
  const report: { source: string; status: string; added: number }[] = [];

  await Promise.all((sources ?? []).map(async (src) => {
    let status = 'ok', added = 0;
    try {
      const res = await fetch(src.feed_url, { headers: { 'User-Agent': 'UNIER news reader (+https://github.com/ggope/unite)', Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' }, signal: AbortSignal.timeout(12000), cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const items = parseFeed((await res.text()).slice(0, 3_000_000)).slice(0, PER_FEED);
      const rows = [];
      for (const it of items) {
        const when = it.published ?? new Date();
        if (when < since || known.has(it.url)) continue;
        const topic = classify(it.title, it.teaser); if (!topic) continue;
        const tk = tokens(it.title);
        const match = pool.find((p) => p.topic === topic && p.lang === src.lang && sameStory(tk, p.tk));
        const story_key = match?.story_key ?? crypto.randomUUID();
        const row = { source_id: src.id, url: it.url.slice(0, 1000), title: shorten(it.title, 300), teaser: it.teaser ? shorten(it.teaser, 280) : null, lang: src.lang, topic, story_key, published_at: when.toISOString() };
        rows.push(row); known.add(it.url); pool.push({ url: row.url, title: row.title, topic, lang: src.lang, story_key, tk });
      }
      if (rows.length) {
        const { error, count } = await sb.from('news_items').upsert(rows, { onConflict: 'url', ignoreDuplicates: true, count: 'exact' });
        if (error) throw new Error(error.message);
        added = count ?? rows.length;
      }
    } catch (e: any) { status = String(e?.message ?? e).slice(0, 200); }
    await sb.from('news_sources').update({ last_fetched_at: new Date().toISOString(), last_status: status, last_count: added }).eq('id', src.id);
    report.push({ source: src.name, status, added });
  }));

  // keep the table small: drop old stories nobody attached a petition to
  await sb.from('news_items').delete().lt('published_at', new Date(Date.now() - 30 * 864e5).toISOString()).is('petition_id', null);
  // the daily privacy clean-up rides on the same schedule (0011_privacy.sql)
  const clean = await sb.rpc('run_retention');
  report.push({ source: 'privacy clean-up', status: clean.error ? `error: ${clean.error.message}` : JSON.stringify(clean.data), added: 0 });
  // and anything a phone notification missed goes out now (0014_notify.sql)
  try { const p = await sendPending(50); report.push({ source: 'notifications', status: JSON.stringify(p), added: 0 }); }
  catch (e: any) { report.push({ source: 'notifications', status: `error: ${e?.message ?? e}`, added: 0 }); }
  return report;
}
