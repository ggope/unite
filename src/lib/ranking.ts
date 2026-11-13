// For You ranking. Modelled on what TikTok and Instagram have said publicly about their feeds:
// a per-person interest graph updated from watch time, completion, replays, cares, shares,
// follows and signatures; fast negative feedback from quick skips; a share of exploration;
// and a penalty for repeats. Weights live in the database for signed-in people and in the
// browser for everyone else.
import type { Topic } from './topics';

export const SIGNAL = { complete: 1, watch: 1, replay: 1.4, care: 1.5, share: 2.5, follow: 2.5, sign: 4, skip: -0.6, less: -8 } as const;
export type Signal = keyof typeof SIGNAL;
export type Weights = Partial<Record<Topic, number>>;

export type FeedItem = {
  id: string; petition_id: string; topic: Topic; caption: string; petition_title: string;
  uploader_handle: string | null; role: 'founder' | 'supporter'; combined: number; last_hour: number;
  goal: number; united_count: number; trim_start: number; trim_end: number; blur_faces: boolean;
  created_at: string; video_url: string | null; cover_url: string | null;
  link_url?: string | null; link_cta?: string | null;
  kind?: 'video' | 'card' | 'clip'; target?: string;   // 'card': a petition with no video yet, shown as a poster
  penalty?: number;   // UNIER team content ranks lower when Admin → Team content is set to less (0023)
  youtube_id?: string; source_name?: string;           // 'clip': a UNIER team pick from a trusted channel (0025)
};

export function score(item: FeedItem, w: Weights, ctx: { followed: Set<string>; signed: Set<string>; seen: Record<string, number>; mine?: string | null }) {
  const interest = w[item.topic] ?? 0;
  const popularity = Math.log10(1 + item.combined) / 6;
  const hours = (Date.now() - new Date(item.created_at).getTime()) / 3.6e6;
  const freshness = 1 / (1 + hours / 12);
  const social = ctx.followed.has(item.petition_id) || ctx.signed.has(item.petition_id) ? 1.5 : 0;
  const repeat = (ctx.seen[item.id] ?? 0) * 2.5;
  return interest + popularity * 1.5 + freshness + social - repeat - (item.penalty ?? 0);
}

export function pickNext(pool: FeedItem[], w: Weights, ctx: Parameters<typeof score>[2], chronological: boolean) {
  if (!pool.length) return null;
  if (chronological) return { item: [...pool].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))[0], explore: false };
  const ranked = [...pool].sort((a, b) => score(b, w, ctx) - score(a, w, ctx));
  const known = Object.values(w).filter((v) => (v ?? 0) > 1).length;
  if (Math.random() < (known < 2 ? 0.45 : 0.2)) {               // cold start explores more
    const fresh = ranked.filter((i) => (w[i.topic] ?? 0) <= 1 && (w[i.topic] ?? 0) > -3);
    if (fresh.length) return { item: fresh[Math.floor(Math.random() * fresh.length)], explore: true };
  }
  return { item: ranked[0], explore: false };
}

export function applySignal(w: Weights, topic: Topic, s: Signal, k = 1): Weights {
  const next: Weights = {};
  for (const [t, v] of Object.entries(w)) next[t as Topic] = (v ?? 0) * 0.985;
  next[topic] = Math.max(-6, Math.min(14, (next[topic] ?? 0) + SIGNAL[s] * k));
  return next;
}
