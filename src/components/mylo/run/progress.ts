// What a player keeps between rounds: best scores, hearts to spend, outfits, missions and the daily streak.
// It all stays in this browser (localStorage `mylo-run`); nothing is sent anywhere.
import type { GameEvent, Mod } from './engine';

export const OUTFITS = ['none', 'cap', 'scarf', 'glasses', 'flowers', 'cape', 'crown'] as const;
export type Outfit = (typeof OUTFITS)[number];
export const PRICE: Record<Outfit, number> = { none: 0, cap: 40, scarf: 100, glasses: 180, flowers: 300, cape: 450, crown: 700 };

export const KINDS = ['hearts', 'score', 'worlds', 'combo', 'double', 'roll', 'power', 'litter', 'near', 'games'] as const;
export type MKind = (typeof KINDS)[number];
// run: counts inside one round only; otherwise it adds up across rounds
const DEFS: Record<MKind, { run: boolean; steps: number[] }> = {
  hearts: { run: true, steps: [8, 15, 25, 40, 60] },
  score: { run: true, steps: [250, 450, 700, 1000, 1500, 2200] },
  worlds: { run: true, steps: [2, 3, 4] },
  combo: { run: true, steps: [3, 4, 5] },
  double: { run: false, steps: [5, 15, 30, 60] },
  roll: { run: false, steps: [2, 6, 15, 30] },
  power: { run: false, steps: [2, 5, 10, 20] },
  litter: { run: false, steps: [8, 20, 40, 80] },
  near: { run: false, steps: [3, 8, 15, 30] },
  games: { run: false, steps: [3, 5, 10] },
};
export const isRunMission = (k: MKind) => DEFS[k].run;
export type Mission = { kind: MKind; n: number; level: number; have: number };

export type Progress = {
  v: 1; best: number; bank: number; earned: number; outfit: Outfit; owned: Outfit[]; done: number; missions: Mission[];
  tips: Record<string, boolean>; daily: { day: string; best: number; played: boolean }; streak: { last: string; n: number }; games: number;
};
const KEY = 'mylo-run';

export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dayNum = (s: string) => Math.round(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000);
const MODS: Mod[] = ['hearts', 'wind', 'clouds', 'power', 'night'];
export const dailyMod = (day: string): Mod => MODS[((dayNum(day) % MODS.length) + MODS.length) % MODS.length];

export const level = (p: Progress) => 1 + Math.floor(p.done / 3);
export const reward = (m: Mission) => 10 + m.level * 5;

function pick(p: Progress, avoid: MKind[]): Mission {
  const free = KINDS.filter((k) => !avoid.includes(k));
  const kind = free[Math.floor(Math.random() * free.length)];
  const steps = DEFS[kind].steps;
  const lv = Math.min(steps.length - 1, Math.floor(p.done / 4) + (Math.random() < 0.3 ? 1 : 0));
  return { kind, n: steps[lv], level: lv, have: 0 };
}
function fill(p: Progress) {
  while (p.missions.length < 3) p.missions.push(pick(p, p.missions.map((m) => m.kind)));
}

export function load(): Progress {
  let p: Partial<Progress> = {};
  try { p = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch {}
  let oldBest = 0;
  try { oldBest = Number(localStorage.getItem('mylo-run-best')) || 0; } catch {}
  const out: Progress = {
    v: 1, best: Math.max(Number(p.best) || 0, oldBest), bank: Number(p.bank) || 0, earned: Number(p.earned) || 0,
    outfit: OUTFITS.includes(p.outfit as Outfit) ? (p.outfit as Outfit) : 'none',
    owned: Array.isArray(p.owned) ? (p.owned.filter((o) => OUTFITS.includes(o)) as Outfit[]) : [],
    done: Number(p.done) || 0,
    missions: Array.isArray(p.missions) ? p.missions.filter((m) => m && KINDS.includes(m.kind) && m.n > 0).slice(0, 3) : [],
    tips: typeof p.tips === 'object' && p.tips ? p.tips : {},
    daily: p.daily && typeof p.daily.day === 'string' ? p.daily : { day: '', best: 0, played: false },
    streak: p.streak && typeof p.streak.last === 'string' ? p.streak : { last: '', n: 0 },
    games: Number(p.games) || 0,
  };
  if (!out.owned.includes('none')) out.owned.unshift('none');
  if (out.daily.day !== today()) out.daily = { day: today(), best: 0, played: false };
  // a streak breaks when a whole day was missed
  if (out.streak.last && dayNum(today()) - dayNum(out.streak.last) > 1) out.streak = { last: out.streak.last, n: 0 };
  fill(out);
  return out;
}
export function save(p: Progress) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); localStorage.removeItem('mylo-run-best'); } catch {}
}

// What happened in the current round, for the missions that count one round at a time.
export type RunStats = { hearts: number; score: number; worlds: number; combo: number };
export const freshRun = (): RunStats => ({ hearts: 0, score: 0, worlds: 1, combo: 0 });

// Feeds one game event into the missions. Returns the missions finished just now.
export function track(p: Progress, run: RunStats, e: GameEvent | { t: 'score'; score: number } | { t: 'start' }): Mission[] {
  const add: Partial<Record<MKind, number>> = {};
  if (e.t === 'heart') { run.hearts++; run.combo = Math.max(run.combo, e.combo); }
  else if (e.t === 'score') run.score = e.score;
  else if (e.t === 'world') run.worlds = e.visited;
  else if (e.t === 'double') add.double = 1;
  else if (e.t === 'roll') add.roll = 1;
  else if (e.t === 'power') add.power = 1;
  else if (e.t === 'litter') add.litter = 1;
  else if (e.t === 'near') add.near = 1;
  else if (e.t === 'start') add.games = 1;
  const finished: Mission[] = [];
  for (const m of p.missions) {
    if (DEFS[m.kind].run) m.have = Math.max(m.have, m.kind === 'hearts' ? run.hearts : m.kind === 'score' ? run.score : m.kind === 'worlds' ? run.worlds : run.combo);
    else m.have += add[m.kind] ?? 0;
    if (m.have >= m.n) finished.push(m);
  }
  if (finished.length) {
    for (const m of finished) { p.bank += reward(m); p.earned += reward(m); p.done++; }
    p.missions = p.missions.filter((m) => !finished.includes(m));
    fill(p);
  }
  return finished;
}
// One-round missions start again from zero each round.
export function startRun(p: Progress) { for (const m of p.missions) if (DEFS[m.kind].run) m.have = 0; }

// The end of a round: hearts go to the bank, the best score and the daily streak are updated.
export function finishRun(p: Progress, r: { score: number; hearts: number; litter: number; daily: boolean }) {
  const isBest = r.score > p.best;
  if (isBest) p.best = r.score;
  const gain = r.hearts + Math.floor(r.litter / 2);
  p.bank += gain; p.earned += gain; p.games++;
  let gift = 0, dailyBest = false;
  if (r.daily) {
    const d = today();
    if (p.daily.day !== d) p.daily = { day: d, best: 0, played: false };
    if (!p.daily.played) {
      gift = 15; p.bank += gift; p.earned += gift; p.daily.played = true;
      p.streak = { last: d, n: p.streak.last && dayNum(d) - dayNum(p.streak.last) === 1 ? p.streak.n + 1 : p.streak.last === d ? p.streak.n : 1 };
    }
    if (r.score > p.daily.best) { p.daily.best = r.score; dailyBest = true; }
  }
  // run missions keep their best progress shown, but restart next round
  return { isBest, gain, gift, dailyBest };
}

export function buy(p: Progress, o: Outfit): boolean {
  if (p.owned.includes(o)) { p.outfit = o; return true; }
  if (p.bank < PRICE[o]) return false;
  p.bank -= PRICE[o]; p.owned.push(o); p.outfit = o; return true;
}
