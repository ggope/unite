import { createClient } from '@supabase/supabase-js';
import { parseFeed, shorten } from '../news/parse';
import { classify, tokens } from '../news/classify';
import { teamLevel } from './level';

// Team videos: reads each trusted channel's public YouTube feed, keeps clips about a UNIER cause,
// and pairs each one with the live petition it fits best. Only the id, title and date are stored;
// the clip itself plays in YouTube's embedded player after a tap.
const MAX_AGE_D = 60, PER_FEED = 15;
export const ytId = (url: string) => url.match(/(?:[?&]v=|youtu\.be\/|\/shorts\/|\/embed\/)([A-Za-z0-9_-]{11})/)?.[1] ?? null;

type Petition = { id: string; topic: string; tk: Set<string>; combined: number };
export function bestPetition(title: string, teaser: string, topic: string, petitions: Petition[]) {
  const tk = tokens(`${title} ${teaser}`);
  let best: Petition | null = null, top = -1;
  for (const p of petitions) {
    if (p.topic !== topic) continue;
    let shared = 0; for (const w of tk) if (p.tk.has(w)) shared++;
    // shared words count most; among equals the petition more people back
    const s = shared * 1000 + Math.log10(1 + p.combined);
    if (s > top) { top = s; best = p; }
  }
  return best;
}

export async function runClipImport() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const level = await teamLevel(sb);
  if (level === 'off') return [{ source: 'team videos', status: 'switched off in Admin → Team content', added: 0 }];
  const perSource = level === 'less' ? 1 : 4;   // new clips per channel per day
  const [{ data: sources, error }, { data: live }, { data: known }] = await Promise.all([
    sb.from('video_sources').select('id, name, feed_url, lang').eq('active', true),
    sb.from('petitions').select('id, title, ask, topic, petition_stats(combined)').eq('status', 'live').limit(1000),
    sb.from('team_videos').select('youtube_id').gte('published_at', new Date(Date.now() - 2 * MAX_AGE_D * 864e5).toISOString()),
  ]);
  if (error) return [{ source: 'team videos', status: `not ready (run 0025_team_videos.sql): ${error.message}`, added: 0 }];
  const petitions: Petition[] = (live ?? []).map((p: any) => {
    const st = Array.isArray(p.petition_stats) ? p.petition_stats[0] : p.petition_stats;
    return { id: p.id, topic: p.topic, tk: tokens(`${p.title} ${p.ask ?? ''}`), combined: Number(st?.combined ?? 0) };
  });
  const seen = new Set((known ?? []).map((k: any) => k.youtube_id));
  const since = new Date(Date.now() - MAX_AGE_D * 864e5);
  const report: { source: string; status: string; added: number }[] = [];

  await Promise.all((sources ?? []).map(async (src: any) => {
    let status = 'ok', added = 0;
    try {
      const res = await fetch(src.feed_url, { headers: { 'User-Agent': 'UNIER video reader (+https://github.com/ggope/unite)', Accept: 'application/atom+xml, application/xml, text/xml' }, signal: AbortSignal.timeout(12000), cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = [];
      // YouTube keeps the description in <media:description>; read it as a normal one
      const xml = (await res.text()).slice(0, 2_000_000).replace(/<(\/?)media:description\b/g, '<$1description');
      for (const it of parseFeed(xml).slice(0, PER_FEED)) {
        if (rows.length >= perSource) break;
        const id = ytId(it.url); const when = it.published ?? new Date();
        if (!id || seen.has(id) || when < since) continue;
        if (/#shorts?\b/i.test(it.title) && it.title.length < 20) continue;   // too thin to explain anything
        const teaser = it.teaser.slice(0, 300);   // channel boilerplate ("follow us on social media") sits further down
        const topic = classify(it.title, teaser); if (!topic) continue;
        const p = bestPetition(it.title, teaser, topic, petitions); if (!p) continue;
        rows.push({ source_id: src.id, youtube_id: id, title: shorten(it.title, 300), lang: src.lang, topic, petition_id: p.id, published_at: when.toISOString() });
        seen.add(id);
      }
      if (rows.length) {
        const { error, count } = await sb.from('team_videos').upsert(rows, { onConflict: 'youtube_id', ignoreDuplicates: true, count: 'exact' });
        if (error) throw new Error(error.message);
        added = count ?? rows.length;
      }
    } catch (e: any) { status = String(e?.message ?? e).slice(0, 200); }
    await sb.from('video_sources').update({ last_fetched_at: new Date().toISOString(), last_status: status, last_count: added }).eq('id', src.id);
    report.push({ source: `video: ${src.name}`, status, added });
  }));
  // clips older than 90 days leave the feed for good
  await sb.from('team_videos').delete().lt('published_at', new Date(Date.now() - 90 * 864e5).toISOString());
  return report;
}
