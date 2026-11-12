import type { Mood } from '@/components/mylo/art';
import type { Topic } from './topics';

// What mylo_today() returns: public totals only.
export type MyloToday = {
  mood: Mood; future: number;
  signed_24h: number; usual: number; wins_7d: number; wins_24h: number; near_goal: number; new_7d: number;
  stories: number; grim: number; hopeful: number;
  grim_headlines: { title: string; url: string; source_name: string }[];
  wins: { id: string; title: string }[];
  goals: { id: string; title: string; topic: Topic; goal: number; target: string; combined: number; featured: boolean }[];
};

// Before the 0008 migration runs (or if the database is unreachable) Mylo is simply calm.
export const MYLO_FALLBACK: MyloToday = {
  mood: 'calm', future: 55, signed_24h: 0, usual: 0, wins_7d: 0, wins_24h: 0, near_goal: 0, new_7d: 0,
  stories: 0, grim: 0, hopeful: 0, grim_headlines: [], wins: [], goals: [],
};

export function asMylo(data: unknown): MyloToday {
  return data && typeof data === 'object' && 'mood' in data ? { ...MYLO_FALLBACK, ...(data as MyloToday) } : MYLO_FALLBACK;
}
