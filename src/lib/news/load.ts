import type { SupabaseClient } from '@supabase/supabase-js';
import type { Lang } from '../i18n/dict';
import type { Topic } from '../topics';

export type NewsStory = {
  id: string; url: string; title: string; teaser: string | null; topic: Topic; published_at: string; source_name: string; outlets: number;
  petition: { id: string; title: string; combined: number; goal: number } | null;
};

// The biggest stories of the last two days: covered by the most outlets first, then the newest.
// Hungarian readers get Hungarian and English stories; everyone else gets English.
export async function loadNews(sb: SupabaseClient, lang: Lang, limit = 12): Promise<NewsStory[]> {
  let q = sb.from('news_stories').select('id, url, title, teaser, topic, published_at, source_name, outlets, petition_id, lang')
    .gte('published_at', new Date(Date.now() - 48 * 3.6e6).toISOString())
    .order('outlets', { ascending: false }).order('published_at', { ascending: false }).limit(limit);
  if (lang !== 'hu') q = q.eq('lang', 'en');
  const { data, error } = await q;
  if (error || !data?.length) return [];
  const ids = [...new Set(data.map((d: any) => d.petition_id).filter(Boolean))];
  const { data: ps } = ids.length
    ? await sb.from('petitions').select('id, title, goal, petition_stats(combined)').in('id', ids).eq('status', 'live')
    : { data: [] as any[] };
  const byId = new Map((ps ?? []).map((p: any) => [p.id, { id: p.id, title: p.title, goal: p.goal, combined: Number((Array.isArray(p.petition_stats) ? p.petition_stats[0] : p.petition_stats)?.combined ?? 0) }]));
  return data.map((d: any) => ({ ...d, outlets: Number(d.outlets), petition: (d.petition_id && byId.get(d.petition_id)) || null }));
}

export function ago(iso: string, t: (k: any, v?: any) => string) {
  const m = Math.max(1, Math.round((Date.now() - +new Date(iso)) / 60000));
  return m < 60 ? t('news.ago.m', { n: m }) : m < 48 * 60 ? t('news.ago.h', { n: Math.round(m / 60) }) : t('news.ago.d', { n: Math.round(m / 1440) });
}
