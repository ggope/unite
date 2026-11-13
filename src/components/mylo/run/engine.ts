// Mylo's Run: the game rules, with no React and no drawing.
// Mylo runs away from the camera on a path with three lanes. Distances are in "path units":
// a lane is LANE wide, `z` is how far ahead something is (Mylo stands at z = 0), `y` is height above the ground.

export const LANE = 1.4;
export const SPAWN_Z = 72;
const GRAV = 30, JUMP = 9.6, SLIDE = 0.7, SHIFT = 0.13;
export const WORLD_SPAN = 500;   // points per world
export const MYLO_H = 1.3, SLIDE_H = 0.62, LOW_H = 0.62, CLOUD_BOTTOM = 0.86;

export const WORLDS = ['park', 'city', 'sea', 'night'] as const;
export type Mod = 'none' | 'hearts' | 'wind' | 'clouds' | 'power' | 'night';
export type Power = 'umbrella' | 'magnet' | 'sprout';
export type Kind = 'low' | 'cloud' | 'block' | 'heart' | 'litter' | 'power';
export type Thing = {
  k: Kind; lane: number; x: number; z: number; y: number; d: number; seed: number; world: number;
  got?: boolean; near?: boolean; passed?: boolean; slid?: boolean; jumped?: boolean; p?: Power;
};
export type Bit = { x: number; y: number; z: number; vx: number; vy: number; life: number; max: number; c: string; r: number; text?: string; size?: number };
export type GameEvent =
  | { t: 'heart'; combo: number } | { t: 'litter' } | { t: 'jump' } | { t: 'roll' } | { t: 'power'; p: Power }
  | { t: 'near' } | { t: 'world'; visited: number; world: number } | { t: 'smash' } | { t: 'shield' }
  | { t: 'tip'; tip: 'lanes' | 'low' | 'cloud' | 'block' | 'power' } | { t: 'over' };
export type Phase = 'ready' | 'run' | 'pause' | 'over';

// a small seeded random generator, so today's challenge is the same course for everyone
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const hashStr = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

export function newGame(opts: { seed?: number; mod?: Mod; tips?: Record<string, boolean> } = {}) {
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
  const mod = opts.mod ?? 'none';
  const startWorld = mod === 'night' ? 3 : 0;
  return {
    phase: 'ready' as Phase, mod, t: 0, dist: 0, speed: 17, bonus: 0, score: 0,
    hearts: 0, litter: 0, combo: 0, comboT: 9, maxCombo: 0,
    // Mylo
    lane: 0, x: 0, y: 0, vy: 0, ground: true, slide: 0, slideHeld: false, landed: 0, laneT: 9, fromLane: 0,
    queue: [] as ('left' | 'right' | 'up' | 'down')[],
    big: 0, shield: false, magnet: 0, invuln: 0, chase: 0.8,
    // world
    startWorld, world: startWorld, prevWorld: startWorld, worldFade: 0, visited: 1, banner: 0,
    things: [] as Thing[], bits: [] as Bit[], nextRow: 26, powIn: 8, curve: 0, curveT: 0,
    obs: rng(seed), loot: rng(seed ^ 0x9E3779B9), pow: rng(seed ^ 0x85EBCA6B),
    blink: 2, flash: 0, flashText: '', tip: '' as '' | 'lanes' | 'low' | 'cloud' | 'block' | 'power', tipT: 0, tips: { ...(opts.tips ?? {}) },
    toast: '', toastT: 0, hitAt: 0, nextFlash: 100,
  };
}
export type Game = ReturnType<typeof newGame>;

const rr = (f: () => number, a: number, b: number) => a + f() * (b - a);
const fx = (a: number, b: number) => a + Math.random() * (b - a);

// ----- input: four moves -----
export function move(g: Game, m: 'left' | 'right' | 'up' | 'down') { if (g.phase === 'run' && g.queue.length < 3) g.queue.push(m); }
export function slideHold(g: Game, on: boolean) { g.slideHeld = on; }
export const sliding = (g: Game) => g.slide > 0 || (g.slideHeld && g.ground);
export const scaleOf = (g: Game) => (g.big > 0 ? (g.big < 0.6 ? 1 + 0.5 * (g.big / 0.6) : 1.5) : 1);

function burst(g: Game, x: number, y: number, z: number, n: number, colors: string[]) {
  for (let i = 0; i < n; i++) g.bits.push({ x, y, z, vx: fx(-2.5, 2.5), vy: fx(2, 6), life: 0, max: fx(0.4, 0.8), c: colors[i % colors.length], r: fx(0.05, 0.1) });
}
function float(g: Game, x: number, y: number, text: string, c = '#B83A0B', size = 15) {
  g.bits.push({ x, y, z: 0.5, vx: 0, vy: 1.4, life: 0, max: 0.8, c, r: 0, text, size });
}
function tip(g: Game, emit: (e: GameEvent) => void, t: 'lanes' | 'low' | 'cloud' | 'block' | 'power') {
  if (!g.tips[t]) { g.tips[t] = true; emit({ t: 'tip', tip: t }); }
}

// ----- spawning: one row of the path at a time -----
type Ob = 'low' | 'cloud' | 'block';
function pickOb(g: Game, f: () => number): Ob {
  const cloudy = g.mod === 'clouds' ? 0.42 : 0.27;
  const r = f();
  if (g.t > 7 && r < cloudy) return 'cloud';
  if (r < 0.62) return 'low';
  return 'block';
}
function spawnRow(g: Game, emit: (e: GameEvent) => void) {
  const f = g.obs, z = SPAWN_Z, w = g.world, lanes = [-1, 0, 1];
  const put = (lane: number, k: Ob) => {
    const d = k === 'block' ? 1.6 : k === 'cloud' ? 0.9 : 0.7;
    g.things.push({ k, lane, x: lane * LANE, z, y: 0, d, seed: f() * 6, world: w });
    tip(g, emit, k);
  };
  const r = f();
  let free: number[] = [];
  if (g.t < 3) free = lanes;
  else if (r < 0.45 || g.t < 10) {
    const lane = lanes[Math.floor(f() * 3)]; put(lane, pickOb(g, f)); free = lanes.filter((l) => l !== lane);
  } else if (r < 0.82) {
    const open = lanes[Math.floor(f() * 3)];
    for (const l of lanes) if (l !== open) put(l, f() < 0.6 ? 'block' : pickOb(g, f));
    free = [open];
  } else {
    // a full row: everyone has to jump or slide
    const k: Ob = g.t > 7 && f() < 0.45 ? 'cloud' : 'low';
    for (const l of lanes) put(l, k);
    if (k === 'low' && f() < 0.6) { const l = lanes[Math.floor(f() * 3)]; for (let i = 0; i < 4; i++) g.things.push({ k: 'heart', lane: l, x: l * LANE, z: z - 1.6 + i * 1.1, y: 0.6 + Math.sin(((i + 0.5) / 4) * Math.PI) * 1.1, d: 0.3, seed: 0, world: w }); }
  }
  // a line of hearts (or litter) in a free lane
  const lf = g.loot;
  if (free.length && lf() < (g.mod === 'hearts' ? 0.95 : 0.65)) {
    const l = free[Math.floor(lf() * free.length)], n = g.mod === 'hearts' ? 7 : 5;
    const name = WORLDS[w], trash = (name === 'city' || name === 'sea') && lf() < 0.4;
    for (let i = 0; i < (trash ? 2 : n); i++) g.things.push({ k: trash ? 'litter' : 'heart', lane: l, x: l * LANE, z: z - 3 - i * (trash ? 3 : 1.6), y: 0.55, d: 0.3, seed: lf() * 6, world: w });
  }
  if (g.t > 6 && g.powIn <= 0 && free.length) {
    const pf = g.pow, l = free[Math.floor(pf() * free.length)], q = pf();
    const p: Power = q < 0.4 ? 'umbrella' : q < 0.75 ? 'magnet' : 'sprout';
    g.things.push({ k: 'power', lane: l, x: l * LANE, z: z - 6, y: 0.9, d: 0.4, seed: pf() * 6, world: w, p });
    g.powIn = g.mod === 'power' ? rr(pf, 5, 8) : rr(pf, 10, 16);
    tip(g, emit, 'power');
  }
  const min = Math.max(11, g.speed * 0.72);
  g.nextRow = rr(f, min, min * 1.6);
}

// ----- one small step of time -----
export function step(g: Game, dt: number, emit: (e: GameEvent) => void) {
  g.blink -= dt; if (g.blink < -0.12) g.blink = fx(2, 5);
  if (g.flash > 0) g.flash -= dt;
  if (g.tipT > 0) g.tipT -= dt;
  if (g.toastT > 0) g.toastT -= dt;
  if (g.worldFade > 0) g.worldFade = Math.max(0, g.worldFade - dt / 1.5);
  if (g.banner > 0) g.banner -= dt;
  for (const b of g.bits) { b.life += dt; b.x += b.vx * dt; b.y += b.vy * dt; if (!b.text) b.vy -= 14 * dt; }
  g.bits = g.bits.filter((b) => b.life < b.max);

  if (g.phase === 'over') {
    if (!g.ground) { g.vy -= GRAV * dt; g.y += g.vy * dt; if (g.y <= 0) { g.y = 0; g.vy = 0; g.ground = true; } }
    g.chase = Math.min(1, g.chase + dt * 1.5);
    return;
  }
  if (g.phase !== 'run') return;

  g.t += dt;
  g.speed = Math.min(40, 17 + g.t * 0.32) * (g.mod === 'wind' ? 1.12 : 1);
  const dz = g.speed * dt;
  g.dist += dz;
  if (g.t < 0.2) tip(g, emit, 'lanes');

  // the path bends gently left and right
  g.curveT += dt;
  g.curve = Math.sin(g.curveT * 0.21) * 0.0016 + Math.sin(g.curveT * 0.09 + 1) * 0.001;

  // timers
  if (g.big > 0) { g.big -= dt; if (g.big <= 0) g.invuln = 1; }
  if (g.magnet > 0) g.magnet -= dt;
  if (g.invuln > 0) g.invuln -= dt;
  if (g.slide > 0) g.slide -= dt;
  g.laneT += dt;
  g.chase = Math.max(0, g.chase - dt * 0.35);
  g.comboT += dt; if (g.comboT > 1.8) g.combo = 0;
  g.powIn -= dt;

  // moves
  while (g.queue.length) {
    const m = g.queue.shift()!;
    if (m === 'left' || m === 'right') {
      const to = Math.max(-1, Math.min(1, g.lane + (m === 'left' ? -1 : 1)));
      if (to !== g.lane) { g.fromLane = g.lane; g.lane = to; g.laneT = 0; }
    } else if (m === 'up') {
      if (g.ground) { g.vy = JUMP; g.ground = false; g.slide = 0; }
    } else {
      if (!g.ground) g.vy = Math.min(g.vy, -JUMP * 1.4);   // come down fast, then slide
      g.slide = SLIDE;
    }
  }
  const target = g.lane * LANE;
  g.x += Math.sign(target - g.x) * Math.min(Math.abs(target - g.x), (LANE / SHIFT) * dt);
  if (!g.ground) {
    g.vy -= GRAV * dt; g.y += g.vy * dt;
    if (g.y <= 0) { g.y = 0; g.vy = 0; g.ground = true; g.landed = 0.12; burst(g, g.x, 0, 0, 4, ['#C9B48A', '#A8936A']); }
  }
  if (g.landed > 0) g.landed -= dt;

  // spawning
  g.nextRow -= dz;
  if (g.nextRow <= 0) spawnRow(g, emit);

  // move, collect, collide
  const s = scaleOf(g), slid = sliding(g), top = g.y + (slid ? SLIDE_H : MYLO_H) * s;
  for (const o of g.things) {
    o.z -= dz;
    if (o.got) continue;
    if (o.k === 'heart' || o.k === 'litter' || o.k === 'power') {
      if (g.magnet > 0 && o.k !== 'power' && o.z < 14 && o.z > -0.5) {
        const k = Math.min(1, dt * 8); o.x += (g.x - o.x) * k; o.y += (g.y + 0.6 - o.y) * k;
      }
      if (Math.abs(o.z) < 0.6 && Math.abs(o.x - g.x) < 0.75 * s && o.y > g.y - 0.3 && o.y < top + 0.35) {
        o.got = true;
        if (o.k === 'heart') {
          g.hearts++; g.combo++; g.comboT = 0; g.maxCombo = Math.max(g.maxCombo, g.combo);
          const pts = 5 * Math.min(g.combo, 5); g.bonus += pts;
          burst(g, o.x, o.y, 0.5, 5, ['#E2412B', '#FF8C8C', '#FFC84A']);
          float(g, o.x, o.y + 0.5, g.combo > 1 ? `+${pts} x${Math.min(g.combo, 5)}` : `+${pts}`);
          emit({ t: 'heart', combo: g.combo });
        } else if (o.k === 'litter') {
          g.litter++; g.bonus += 3;
          burst(g, o.x, o.y, 0.5, 5, ['#3DBA5C', '#7EC8E3']); float(g, o.x, o.y + 0.5, '+3', '#2F8E45');
          emit({ t: 'litter' });
        } else {
          if (o.p === 'umbrella') g.shield = true; else if (o.p === 'magnet') g.magnet = 8; else g.big = 5;
          burst(g, o.x, o.y, 0.5, 10, ['#2F6FD6', '#FFC84A', '#3DBA5C', '#E2412B']);
          emit({ t: 'power', p: o.p! });
        }
      }
      continue;
    }
    const inLane = Math.abs(o.x - g.x) < 0.78 * s;
    const overlapZ = o.z < 0.3 && o.z + o.d > -0.3;
    if (overlapZ && inLane) {
      const clear = o.k === 'low' ? g.y > LOW_H : o.k === 'cloud' ? top < CLOUD_BOTTOM : false;
      if (clear) {
        if (o.k === 'low') { o.jumped = true; if (g.y < LOW_H + 0.25) o.near = true; }
        else o.slid = true;
      } else {
        if (g.big > 0) {
          o.got = true; g.bonus += 2; burst(g, o.x, 0.6, 0.3, 10, ['#2E6B35', '#8D909B', '#FFC84A']); float(g, o.x, 1.6, '+2'); emit({ t: 'smash' });
          continue;
        }
        if (g.invuln > 0) continue;
        if (g.shield) {
          g.shield = false; g.invuln = 1; g.chase = 1; o.got = true;
          burst(g, o.x, 0.8, 0.3, 12, ['#2F6FD6', '#FFFFFF', '#7EC8E3']); emit({ t: 'shield' });
          continue;
        }
        g.phase = 'over'; g.hitAt = performance.now(); g.vy = 5; g.ground = false; g.slide = 0;
        emit({ t: 'over' });
        return;
      }
    }
    // a block dodged at the last moment counts as a close escape
    if (o.k === 'block' && overlapZ && o.lane === g.fromLane && g.laneT < 0.3 && !inLane) o.near = true;
    if (!o.passed && o.z + o.d < -0.3) {
      o.passed = true;
      if (o.jumped) emit({ t: 'jump' });
      if (o.slid) emit({ t: 'roll' });
      if (o.near) { g.bonus += 3; float(g, g.x, top + 0.6, '+3', '#2F6FD6', 14); emit({ t: 'near' }); }
    }
  }
  g.things = g.things.filter((o) => o.z > -4 && !o.got);

  g.score = Math.floor(g.dist / 1.6) + g.bonus;
  const visited = 1 + Math.floor(g.score / WORLD_SPAN);
  if (visited > g.visited) {
    g.visited = visited; g.prevWorld = g.world; g.world = (g.startWorld + visited - 1) % WORLDS.length; g.worldFade = 1; g.banner = 2.2;
    burst(g, g.x, 1.6, 0.5, 10, ['#2F6FD6', '#E2412B', '#FFC84A', '#3DBA5C']);
    emit({ t: 'world', visited, world: g.world });
  }
  if (g.score >= g.nextFlash) {
    if (g.nextFlash % WORLD_SPAN) { g.flash = 1.1; g.flashText = String(g.nextFlash); }   // a small cheer every 100 points
    g.nextFlash += 100;
  }
}
