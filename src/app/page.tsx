import { loadViewer } from '@/lib/viewer';
import { Feed } from '@/components/Feed';
import { score, type FeedItem } from '@/lib/ranking';
import { Welcome } from '@/components/Welcome';
import { loadNews } from '@/lib/news/load';
import { getLang } from '@/lib/i18n/server';
import { localize } from '@/lib/petitionText';
import { teamLevel } from '@/lib/clips/level';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [{ sb, viewer, signed, followed, settings, weights }, lang] = await Promise.all([loadViewer(), getLang()]);
  const [{ data }, news, level] = await Promise.all([
    sb.from('video_feed').select('*').order('created_at', { ascending: false }).limit(60),
    loadNews(sb, lang, 12),
    teamLevel(sb),
  ]);
  // UNIER team picks: clips from trusted channels, each under its petition. The shared switch in Admin
  // turns them down ('less': fewer, ranked lower) or off once people post enough of their own.
  const { data: clipRows } = level === 'off' ? { data: [] } : await sb.from('team_videos')
    .select('id, youtube_id, title, topic, lang, published_at, video_sources(name), petitions!inner(id, title, target, goal, status, lang, tr, link_url, link_cta, petition_stats(combined, last_hour, united_count))')
    .eq('status', 'live').eq('petitions.status', 'live').order('published_at', { ascending: false }).limit(level === 'less' ? 6 : 30);   // empty before 0025 has run
  const rows = data ?? [];
  // Petitions nobody has filmed yet still get a slide: a poster card. Real videos replace it.
  const filmed = new Set(rows.map((r: any) => r.petition_id));
  const { data: unfilmed } = await sb.from('petitions').select('id, title, target, ask, topic, goal, created_at, link_url, link_cta, lang, tr, petition_stats(combined, last_hour, united_count)')
    .eq('status', 'live').order('created_at', { ascending: false }).limit(60);
  const stat = (p: any) => (Array.isArray(p.petition_stats) ? p.petition_stats[0] : p.petition_stats) ?? {};
  const cards: FeedItem[] = (unfilmed ?? []).filter((p: any) => !filmed.has(p.id)).map((raw: any) => localize(raw, lang)).map((p: any) => ({
    id: `card-${p.id}`, kind: 'card', petition_id: p.id, topic: p.topic, caption: p.ask.length > 160 ? p.ask.slice(0, 157) + '…' : p.ask, petition_title: p.title, target: p.target,
    uploader_handle: null, role: 'founder', combined: Number(stat(p).combined ?? 0), last_hour: Number(stat(p).last_hour ?? 0), goal: p.goal,
    united_count: Number(stat(p).united_count ?? 0), trim_start: 0, trim_end: 8, blur_faces: false, created_at: p.created_at,
    video_url: null, cover_url: null, link_url: p.link_url ?? null, link_cta: p.link_cta ?? null,
  }));
  const clips: FeedItem[] = (clipRows ?? []).map((c: any) => {
    const p = localize(c.petitions, lang); const st = stat(c.petitions);
    return { id: `clip-${c.id}`, kind: 'clip', youtube_id: c.youtube_id, source_name: c.video_sources?.name ?? 'YouTube', petition_id: p.id, topic: c.topic, caption: c.title,
      petition_title: p.title, target: p.target, uploader_handle: null, role: 'founder', combined: Number(st.combined ?? 0), last_hour: Number(st.last_hour ?? 0), goal: p.goal,
      united_count: Number(st.united_count ?? 0), trim_start: 0, trim_end: 30, blur_faces: false, created_at: c.published_at, video_url: null, cover_url: null,
      link_url: p.link_url ?? null, link_cta: p.link_cta ?? null, damp: level === 'less' ? 2 : 0.5 };
  });
  if (!rows.length && !cards.length && !clips.length) {
    const { data: ps } = await sb.from('petitions').select('id, title, target, topic, goal, lang, tr, petition_stats(combined)').eq('status', 'live').order('created_at', { ascending: false }).limit(8);
    const petitions = (ps ?? []).map((p: any) => ({ ...localize(p, lang), combined: Number((Array.isArray(p.petition_stats) ? p.petition_stats[0] : p.petition_stats)?.combined ?? 0) }));
    return <Welcome petitions={petitions} news={news} viewer={viewer} signed={[...signed]} />;
  }
  // private bucket: hand out short-lived links for approved videos only
  const paths = rows.flatMap((r: any) => [r.storage_path, r.cover_path].filter(Boolean));
  const signedUrls = paths.length ? (await sb.storage.from('videos').createSignedUrls(paths, 60 * 60)).data ?? [] : [];
  const url = (p: string | null) => (p ? signedUrls.find((s: any) => s.path === p)?.signedUrl ?? null : null);
  const items: FeedItem[] = rows.map((r: any): FeedItem => ({
    id: r.id, petition_id: r.petition_id, topic: r.topic, caption: r.caption, petition_title: localize({ title: r.petition_title, lang: r.petition_lang, tr: r.petition_tr }, lang).title ?? r.petition_title,
    uploader_handle: r.uploader_handle, role: r.role, combined: Number(r.combined), last_hour: Number(r.last_hour), goal: r.goal,
    united_count: Number(r.united_count), trim_start: Number(r.trim_start), trim_end: Number(r.trim_end), blur_faces: r.blur_faces,
    created_at: r.created_at, video_url: url(r.storage_path), cover_url: url(r.cover_path),
    link_url: r.link_url ?? null, link_cta: r.link_cta ?? null,
  })).concat(clips, cards);
  // The first video is picked here so it ships in the first HTML and starts playing right away.
  const ctx = { followed, signed, seen: {} };
  // Open on a real video when there is one, so something plays instantly; posters come after.
  // Team clips need a tap to play (privacy), so they never open the feed.
  const plays = items.filter((i) => i.kind !== 'card' && i.kind !== 'clip');
  const openers = plays.length ? plays : items;
  const first = settings?.chronological_feed ? openers[0] : [...openers].sort((a, b) => score(b, weights, ctx) - score(a, weights, ctx))[0];
  return <Feed firstId={first?.id} items={items} news={news} viewer={viewer} signed={[...signed]} followed={[...followed]} serverWeights={weights}
    chronological={!!settings?.chronological_feed} autoplay={settings?.autoplay !== false && !settings?.is_minor}
    breakMinutes={settings?.is_minor ? Math.min(10, settings?.break_reminder_minutes ?? 10) : settings?.break_reminder_minutes ?? 20} />;
}
