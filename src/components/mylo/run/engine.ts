// Mylo's Run: the game rules, with no React and no drawing.
// The world is 240 units tall; y grows downwards and Mylo's `y` is his height above the ground (negative = up).

export const H = 240, GROUND = 206, MX = 56;
const GRAV = 2300, JUMP = 770, JUMP2 = 650, CUT = 300, DROP = 1200, ROLL = 0.55;
export const WORLD_SPAN = 500;   // points per world

export const WORLDS = ['park', 'city', 'sea', 'night'] as const;
export type Mod = 'none' | 'hearts' | 'wind' | 'clouds' | 'power' | 'night';
export type Power = 'umbrella' | 'magnet' | 'sprout';
export type Kind = 'thorn' | 'cone' | 'bin' | 'crab' | 'rock' | 'high' | 'low' | 'heart' | 'litter' | 'power';
export type Thing = {
  k: Kind; x: number; y: number; w: number; h: number; seed: number; world: number;
  got?: boolean; near?: boolean; passed?: boolean; rolled?: boolean; p?: Power; spikes?: number[]; vx?: number;
};
export type Bit = { x: number; y: number; vx: number; vy: number; life: number; max: number; c: string; r: number; text?: string; size?: number };
export type GameEvent =
  | { t: 'heart'; combo: number } | { t: 'litter' } | { t: 'double' } | { t: 'roll' } | { t: 'power'; p: Power }
  | { t: 'near' } | { t: 'world'; visited: number; world: number } | { t: 'smash' } | { t: 'shield' } | { t: 'tip'; tip: 'high' | 'low' | 'power' }
  | { t: 'over' };
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
    phase: 'ready' as Phase, mod, t: 0, dist: 0, speed: 280, bonus: 0, score: 0,
    hearts: 0, litter: 0, combo: 0, comboT: 9, maxCombo: 0,
    // Mylo
    y: 0, vy: 0, air: 0, ground: true, jumps: 0, holding: false, pressQ: false, buffered: -1, coyote: 0, landed: 0,
    roll: 0, rollHeld: false, rollQueued: false, touchJump: 0,
    big: 0, shield: false, magnet: 0, invuln: 0,
    // world
    startWorld, world: startWorld, prevWorld: startWorld, worldFade: 0, visited: 1, banner: 0,
    things: [] as Thing[], bits: [] as Bit[], sinceSpawn: 0, gap: 460, heartIn: 1.4, powIn: 7, dust: 0,
    obs: rng(seed), loot: rng(seed ^ 0x9E3779B9), pow: rng(seed ^ 0x85EBCA6B),
    blink: 2, flash: 0, flashText: '', tip: '' as '' | 'high' | 'low' | 'power', tipT: 0, tips: { ...(opts.tips ?? {}) },
    toast: '', toastT: 0, hitAt: 0, nextFlash: 100,
  };
}
export type Game = ReturnType<typeof newGame>;

const rr = (f: () => number, a: number, b: number) => a + f() * (b - a);
const fx = (a: number, b: number) => a + Math.random() * (b - a);

// ----- input -----
export function press(g: Game) { g.holding = true; g.pressQ = true; }
export function release(g: Game) { g.holding = false; }
export function rollDown(g: Game, held: boolean) {
  if (g.phase !== 'run') return;
  if (held) g.rollHeld = true;
  if (!g.ground) {
    // a swipe right after a tap means "roll", not "jump then roll": take the hop back
    if (g.touchJump > 0 && g.jumps === 1 && g.air < 0.16) { g.y = 0; g.vy = 0; g.ground = true; g.jumps = 0; g.roll = ROLL; return; }
    g.vy = Math.max(g.vy, DROP); g.rollQueued = true; return;
  }
  g.roll = ROLL;
}
export function rollUp(g: Game) { g.rollHeld = false; }
export const rolling = (g: Game) => g.ground && (g.roll > 0 || g.rollHeld);
export const scaleOf = (g: Game) => (g.big > 0 ? (g.big < 0.6 ? 1 + 0.5 * (g.big / 0.6) : 1.5) : 1);

// Mylo's body for hit tests: a circle plus a box for the legs
export function body(g: Game) {
  const feet = GROUND + g.y, s = scaleOf(g);
  if (rolling(g)) return { cx: MX + 25, cy: feet - 12 * s, r: 11.5 * s, legs: null };
  return { cx: MX + 25 * s, cy: feet - 23 * s, r: 13 * s, legs: { x: MX + 18 * s, y: feet - 12 * s, w: 14 * s, h: 12 * s } };
}
function hits(g: Game, x: number, y: number, w: number, h: number) {
  const b = body(g);
  const nx = Math.max(x, Math.min(b.cx, x + w)), ny = Math.max(y, Math.min(b.cy, y + h));
  if ((nx - b.cx) ** 2 + (ny - b.cy) ** 2 < b.r * b.r) return true;
  const l = b.legs;
  return !!l && l.x < x + w && l.x + l.w > x && l.y < y + h && l.y + l.h > y;
}
// the part of each thing that hurts, a little smaller than the drawing so near misses feel fair
export function hurtBox(o: Thing, t: number) {
  switch (o.k) {
    case 'thorn': return { x: o.x + 4, y: o.y + 6, w: o.w - 8, h: o.h - 6 };
    case 'high': case 'low': { const bob = Math.sin(t * 3 + o.seed) * (o.k === 'low' ? 1.5 : 3); return { x: o.x + 8, y: o.y + bob, w: o.w - 16, h: o.h }; }
    default: return { x: o.x + 3, y: o.y + 3, w: o.w - 6, h: o.h - 3 };
  }
}

function burst(g: Game, x: number, y: number, n: number, colors: string[]) {
  for (let i = 0; i < n; i++) g.bits.push({ x, y, vx: fx(-140, 140), vy: fx(-260, -60), life: 0, max: fx(0.4, 0.8), c: colors[i % colors.length], r: fx(2, 4) });
}
function float(g: Game, x: number, y: number, text: string, c = '#B83A0B', size = 13) {
  g.bits.push({ x, y, vx: 0, vy: -50, life: 0, max: 0.8, c, r: 0, text, size });
}

// ----- spawning -----
function spawnObstacle(g: Game, W: number, emit: (e: GameEvent) => void) {
  const x = W + 30, f = g.obs, w = g.world, seed = f() * 6;
  const cloudy = g.mod === 'clouds' ? 0.42 : 0.3;
  const canHigh = g.t > 10 || g.score > 120, canLow = g.t > 18 || g.score > 220;
  const r = f();
  if (canLow && r < cloudy / 2) {
    g.things.push({ k: 'low', x, y: GROUND - 66, w: rr(f, 66, 84), h: 36, seed, world: w });
    if (!g.tips.low) { g.tips.low = true; emit({ t: 'tip', tip: 'low' }); }
  } else if (canHigh && r < cloudy) {
    g.things.push({ k: 'high', x, y: GROUND - 122, w: rr(f, 60, 80), h: 42, seed, world: w });
    if (!g.tips.high) { g.tips.high = true; emit({ t: 'tip', tip: 'high' }); }
  } else {
    let o: Thing;
    const name = WORLDS[w];
    if (name === 'city') {
      o = f() < 0.55 ? { k: 'cone', x, y: 0, w: f() < Math.min(0.45, g.t / 50) ? 34 : 18, h: 24, seed, world: w } : { k: 'bin', x, y: 0, w: 24, h: 34, seed, world: w };
    } else if (name === 'sea') {
      o = f() < 0.55 ? { k: 'crab', x, y: 0, w: 28, h: 18, seed, world: w, vx: rr(f, 30, 70) } : { k: 'rock', x, y: 0, w: rr(f, 26, 40), h: rr(f, 20, 28), seed, world: w };
    } else {
      const n = f() < Math.min(0.5, g.t / 60) ? (f() < 0.35 ? 3 : 2) : 1;
      const sw = rr(f, 15, 19);
      o = { k: 'thorn', x, y: 0, w: sw * n, h: rr(f, 22, 34) + (n > 1 ? 0 : 4), seed, world: w, spikes: Array.from({ length: n * 2 }, () => rr(f, 0.75, 1)) };
    }
    o.y = GROUND - o.h;
    g.things.push(o);
    if (f() < 0.4) g.things.push({ k: 'heart', x: x + o.w / 2, y: GROUND - o.h - 60, w: 0, h: 0, seed, world: w });
  }
  const air = (2 * JUMP) / GRAV;
  const min = g.speed * air * 0.95 + 110;
  g.gap = rr(f, min, min * 2.1);
}

function spawnLoot(g: Game, W: number) {
  const f = g.loot, x = W + 30;
  g.heartIn = g.mod === 'hearts' ? rr(f, 0.45, 1.1) : rr(f, 1.1, 2.4);
  if (g.things.some((o) => (o.k === 'high' || o.k === 'low') && Math.abs(o.x - x) < 120)) return;
  const name = WORLDS[g.world];
  if ((name === 'city' || name === 'sea') && f() < 0.45) g.things.push({ k: 'litter', x, y: GROUND - (f() < 0.5 ? 14 : rr(f, 50, 110)), w: 0, h: 0, seed: f() * 6, world: g.world });
  else if (g.mod === 'hearts' && f() < 0.5) {
    // heart rain: a little arc of hearts
    const y0 = GROUND - rr(f, 40, 90);
    for (let i = 0; i < 4; i++) g.things.push({ k: 'heart', x: x + i * 26, y: y0 - Math.sin((i / 3) * Math.PI) * 30, w: 0, h: 0, seed: 0, world: g.world });
  } else g.things.push({ k: 'heart', x, y: GROUND - rr(f, 28, 135), w: 0, h: 0, seed: f() * 6, world: g.world });
}

function spawnPower(g: Game, W: number, emit: (e: GameEvent) => void) {
  const f = g.pow, x = W + 30;
  g.powIn = g.mod === 'power' ? rr(f, 5, 8) : rr(f, 10, 16);
  if (g.things.some((o) => (o.k === 'high' || o.k === 'low') && Math.abs(o.x - x) < 140)) { g.powIn = 1; return; }
  const r = f(), p: Power = r < 0.4 ? 'umbrella' : r < 0.75 ? 'magnet' : 'sprout';
  g.things.push({ k: 'power', x, y: GROUND - rr(f, 50, 105), w: 0, h: 0, seed: f() * 6, world: g.world, p });
  if (!g.tips.power) { g.tips.power = true; emit({ t: 'tip', tip: 'power' }); }
}

// ----- one small step of time -----
export function step(g: Game, dt: number, W: number, emit: (e: GameEvent) => void) {
  g.blink -= dt; if (g.blink < -0.12) g.blink = fx(2, 5);
  if (g.flash > 0) g.flash -= dt;
  if (g.tipT > 0) g.tipT -= dt;
  if (g.toastT > 0) g.toastT -= dt;
  if (g.worldFade > 0) g.worldFade = Math.max(0, g.worldFade - dt / 1.5);
  if (g.banner > 0) g.banner -= dt;
  for (const b of g.bits) { b.life += dt; b.x += b.vx * dt; b.y += b.vy * dt; if (!b.text) b.vy += 900 * dt; }
  g.bits = g.bits.filter((b) => b.life < b.max);

  if (g.phase === 'over') {
    if (!g.ground) { g.vy += GRAV * dt; g.y += g.vy * dt; if (g.y >= 0) { g.y = 0; g.vy = 0; g.ground = true; } }
    return;
  }
  if (g.phase !== 'run') return;

  g.t += dt;
  g.speed = Math.min(660, 280 + g.t * 7) * (g.mod === 'wind' ? 1.12 : 1);
  const dx = g.speed * dt;
  g.dist += dx;

  // timers
  if (g.big > 0) { g.big -= dt; if (g.big <= 0) g.invuln = 1; }
  if (g.magnet > 0) g.magnet -= dt;
  if (g.invuln > 0) g.invuln -= dt;
  if (g.roll > 0) g.roll -= dt;
  if (g.touchJump > 0) g.touchJump -= dt;
  g.comboT += dt; if (g.comboT > 1.8) g.combo = 0;

  // jumping
  const doJump = () => { g.vy = -JUMP; g.ground = false; g.jumps = 1; g.coyote = 0; g.air = 0; g.buffered = -1; g.roll = 0; g.rollQueued = false; };
  if (g.buffered > 0) g.buffered -= dt;
  if (g.ground) g.coyote = 0.08; else g.coyote -= dt;
  if (g.pressQ) {
    g.pressQ = false;
    if (g.ground || g.coyote > 0) doJump();
    else if (g.jumps < 2) {
      g.vy = -JUMP2; g.jumps = 2; g.air = 0; g.rollQueued = false; emit({ t: 'double' });
      burst(g, MX + 25, GROUND + g.y - 4, 5, ['#FFFFFF', '#FFE0D1']);
    } else g.buffered = 0.12;
  } else if (g.buffered > 0 && g.ground) doJump();
  if (!g.ground) {
    g.air += dt;
    if (!g.holding && g.air > 0.07 && g.vy < -CUT) g.vy = -CUT;   // let go early: smaller hop
    g.vy += GRAV * dt; g.y += g.vy * dt;
    if (g.y >= 0) {
      g.y = 0; g.vy = 0; g.ground = true; g.jumps = 0; g.landed = 0.12;
      if (g.rollQueued) { g.roll = ROLL; g.rollQueued = false; }
      burst(g, MX + 25, GROUND, 4, ['#C9B48A', '#A8936A']);
    }
  }
  if (g.landed > 0) g.landed -= dt;

  // dust
  g.dust -= dt;
  if (g.ground && g.dust <= 0) { g.dust = 0.09; g.bits.push({ x: MX + 14, y: GROUND - 2, vx: -g.speed * 0.4, vy: fx(-60, -20), life: 0, max: 0.35, c: '#CDB78E', r: fx(1.5, 3) }); }

  // spawning
  g.sinceSpawn += dx;
  if (g.sinceSpawn >= g.gap) { g.sinceSpawn = 0; spawnObstacle(g, W, emit); }
  g.heartIn -= dt; if (g.heartIn <= 0) spawnLoot(g, W);
  if (g.t > 6) { g.powIn -= dt; if (g.powIn <= 0) spawnPower(g, W, emit); }

  // move, collect, collide
  const b = body(g), feet = GROUND + g.y;
  for (const o of g.things) {
    o.x -= dx + (o.vx ?? 0) * dt;
    if (o.got) continue;
    if (o.k === 'heart' || o.k === 'litter' || o.k === 'power') {
      if (g.magnet > 0 && o.k !== 'power' && o.x - b.cx < 170 && o.x > b.cx - 30) {
        const ax = b.cx - o.x, ay = b.cy - o.y, d = Math.hypot(ax, ay) || 1, v = 520 * dt;
        o.x += (ax / d) * v; o.y += (ay / d) * v;
      }
      const reach = o.k === 'power' ? 16 : 11;
      if ((o.x - b.cx) ** 2 + (o.y - b.cy) ** 2 < (b.r + reach) ** 2) {
        o.got = true;
        if (o.k === 'heart') {
          g.hearts++; g.combo++; g.comboT = 0; g.maxCombo = Math.max(g.maxCombo, g.combo);
          const pts = 5 * Math.min(g.combo, 5); g.bonus += pts;
          burst(g, o.x, o.y, 6, ['#E2412B', '#FF8C8C', '#FFC84A']);
          float(g, o.x, o.y - 8, g.combo > 1 ? `+${pts} x${Math.min(g.combo, 5)}` : `+${pts}`);
          emit({ t: 'heart', combo: g.combo });
        } else if (o.k === 'litter') {
          g.litter++; g.bonus += 3;
          burst(g, o.x, o.y, 5, ['#3DBA5C', '#7EC8E3']); float(g, o.x, o.y - 8, '+3', '#2F8E45');
          emit({ t: 'litter' });
        } else {
          if (o.p === 'umbrella') g.shield = true;
          else if (o.p === 'magnet') g.magnet = 8;
          else g.big = 5;
          burst(g, o.x, o.y, 10, ['#2F6FD6', '#FFC84A', '#3DBA5C', '#E2412B']);
          emit({ t: 'power', p: o.p! });
        }
      }
      continue;
    }
    const hb = hurtBox(o, g.t);
    const overlapX = hb.x < MX + 42 && hb.x + hb.w > MX + 8;
    if (hits(g, hb.x, hb.y, hb.w, hb.h)) {
      if (g.big > 0) {
        o.got = true; g.bonus += 2; burst(g, o.x + o.w / 2, o.y + o.h / 2, 10, ['#2E6B35', '#8D909B', '#FFC84A']); float(g, o.x, o.y - 6, '+2'); emit({ t: 'smash' });
        continue;
      }
      if (g.invuln > 0) continue;
      if (g.shield) {
        g.shield = false; g.invuln = 1; o.got = true;
        burst(g, o.x + o.w / 2, o.y + o.h / 2, 12, ['#2F6FD6', '#FFFFFF', '#7EC8E3']); emit({ t: 'shield' });
        continue;
      }
      g.phase = 'over'; g.hitAt = performance.now(); g.vy = -380; g.ground = false;
      emit({ t: 'over' });
      return;
    }
    // close escapes and rolls, counted once the thing is behind Mylo
    if (overlapX) {
      if (o.k === 'low' && rolling(g)) o.rolled = true;
      else if (o.k !== 'high' && o.k !== 'low' && !g.ground) { const gap = hb.y - feet; if (gap >= 0 && gap < 9) o.near = true; }
      else if (o.k === 'high' && g.ground) { const gap = b.cy - b.r - (hb.y + hb.h); if (gap >= 0 && gap < 8) o.near = true; }
    }
    if (!o.passed && hb.x + hb.w < MX + 8) {
      o.passed = true;
      if (o.rolled) emit({ t: 'roll' });
      if (o.near) { g.bonus += 3; float(g, MX + 30, feet - 70, '+3', '#2F6FD6', 12); emit({ t: 'near' }); }
    }
  }
  g.things = g.things.filter((o) => o.x > -120 && !o.got);

  g.score = Math.floor(g.dist / 14) + g.bonus;
  const visited = 1 + Math.floor(g.score / WORLD_SPAN);
  if (visited > g.visited) {
    g.visited = visited; g.prevWorld = g.world; g.world = (g.startWorld + visited - 1) % WORLDS.length; g.worldFade = 1; g.banner = 2.2;
    burst(g, b.cx, b.cy - 20, 10, ['#2F6FD6', '#E2412B', '#FFC84A', '#3DBA5C']);
    emit({ t: 'world', visited, world: g.world });
  }
  if (g.score >= g.nextFlash) {
    if (g.nextFlash % WORLD_SPAN) { g.flash = 1.1; g.flashText = String(g.nextFlash); }   // a small cheer every 100 points
    g.nextFlash += 100;
  }
}
