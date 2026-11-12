import { loadViewer } from '@/lib/viewer';
import { Feed } from '@/components/Feed';
import type { FeedItem } from '@/lib/ranking';
import { Welcome } from '@/components/Welcome';
import { loadNews } from '@/lib/news/load';
import { getLang } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [{ sb, viewer, signed, followed, settings, weights }, lang] = await Promise.all([loadViewer(), getLang()]);
  const [{ data }, news] = await Promise.all([
    sb.from('video_feed').select('*').order('created_at', { ascending: false }).limit(60),
    loadNews(sb, lang, 12),
  ]);
  const rows = data ?? [];
  if (!rows.length) {
    const { data: ps } = await sb.from('petitions').select('id, title, target, topic, goal, petition_stats(combined)').eq('status', 'live').order('created_at', { ascending: false }).limit(8);
    const petitions = (ps ?? []).map((p: any) => ({ ...p, combined: Number((Array.isArray(p.petition_stats) ? p.petition_stats[0] : p.petition_stats)?.combined ?? 0) }));
    return <Welcome petitions={petitions} news={news} viewer={viewer} signed={[...signed]} />;
  }
  // private bucket: hand out short-lived links for approved videos only
  const paths = rows.flatMap((r: any) => [r.storage_path, r.cover_path].filter(Boolean));
  const signedUrls = paths.length ? (await sb.storage.from('videos').createSignedUrls(paths, 60 * 60)).data ?? [] : [];
  const url = (p: string | null) => (p ? signedUrls.find((s: any) => s.path === p)?.signedUrl ?? null : null);
  const items: FeedItem[] = rows.map((r: any) => ({
    id: r.id, petition_id: r.petition_id, topic: r.topic, caption: r.caption, petition_title: r.petition_title,
    uploader_handle: r.uploader_handle, role: r.role, combined: Number(r.combined), last_hour: Number(r.last_hour), goal: r.goal,
    united_count: Number(r.united_count), trim_start: Number(r.trim_start), trim_end: Number(r.trim_end), blur_faces: r.blur_faces,
    created_at: r.created_at, video_url: url(r.storage_path), cover_url: url(r.cover_path),
    link_url: r.link_url ?? null, link_cta: r.link_cta ?? null,
  }));
  return <Feed items={items} news={news} viewer={viewer} signed={[...signed]} followed={[...followed]} serverWeights={weights}
    chronological={!!settings?.chronological_feed} autoplay={settings?.autoplay !== false && !settings?.is_minor}
    breakMinutes={settings?.is_minor ? Math.min(10, settings?.break_reminder_minutes ?? 10) : settings?.break_reminder_minutes ?? 20} />;
}
