// Mylo's Run: the scene, seen from just behind Mylo. A simple perspective: things further away are smaller
// and closer to the horizon, and the path bends a little. The canvas is 300 units tall; its width follows the screen.
import { LANE, CLOUD_BOTTOM, WORLDS, scaleOf, sliding, type Game, type Thing } from './engine';
import type { Outfit } from './progress';
import { P, TAU, myloBack, myloSprite, powerIcon, setUnit, shade } from './sprite';

export const H = 300;
export type TipKey = 'lanes' | 'low' | 'cloud' | 'block' | 'power';
export type Labels = { best: string; worlds: string[]; tips: Record<TipKey, string>; daily?: string };
type Ctx = CanvasRenderingContext2D;

type Theme = { sky: [string, string]; hill: string; grass: [string, string]; road: [string, string]; line: string; ink: string; soft: string; fog: string };
export const THEMES: Theme[] = [
  { sky: ['#FFF6E6', '#FCE2C2'], hill: '#C9DFA6', grass: ['#A9D18A', '#9CC77C'], road: ['#E8D2A6', '#E0C895'], line: '#FFF4DC', ink: '#1A1A1A', soft: '#6B6457', fog: '#FCE2C2' },
  { sky: ['#EEF3F8', '#F9E4CF'], hill: '#BFC6D2', grass: ['#C2C7CF', '#B6BBC4'], road: ['#8E8C8A', '#858381'], line: '#F2F2F2', ink: '#1A1A1A', soft: '#5C6270', fog: '#F9E4CF' },
  { sky: ['#E3F4FF', '#FFF0D8'], hill: '#9FD3E6', grass: ['#F3DFAE', '#ECD49E'], road: ['#D9B98A', '#D1AF7E'], line: '#FFF7E6', ink: '#1A1A1A', soft: '#5B6B73', fog: '#FFF0D8' },
  { sky: ['#1E2747', '#3F4677'], hill: '#2B3F33', grass: ['#2F4A3A', '#2A4334'], road: ['#6F6250', '#675B4A'], line: '#B9AE8E', ink: '#F7EFE0', soft: '#C9C3E6', fog: '#3F4677' },
];

// ---------- camera ----------
type Cam = { W: number; f: number; hy: number; camX: number; camH: number; camZ: number; curve: number };
type Pt = { x: number; y: number; s: number };
function proj(c: Cam, x: number, y: number, z: number): Pt | null {
  const dz = z - c.camZ;
  if (dz < 0.35) return null;
  const s = c.f / dz, bend = c.curve * Math.max(0, z) * Math.max(0, z) * 3;
  return { x: c.W / 2 + (x + bend - c.camX) * s, y: c.hy + (c.camH - y) * s, s };
}
const fogA = (z: number) => (z > 48 ? Math.max(0, 1 - (z - 48) / 24) : 1);

function quad(ctx: Ctx, a: Pt, b: Pt, c: Pt, d: Pt) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fill(); }

function puff(ctx: Ctx, x: number, y: number, s: number, fill: string) {
  ctx.fillStyle = fill; ctx.beginPath();
  ctx.arc(x, y, 10 * s, 0, TAU); ctx.arc(x + 12 * s, y - 6 * s, 13 * s, 0, TAU); ctx.arc(x + 26 * s, y, 10 * s, 0, TAU); ctx.rect(x, y - 2 * s, 26 * s, 12 * s); ctx.fill();
}

// ---------- sky and ground ----------
function sky(ctx: Ctx, c: Cam, world: number, g: Game) {
  const th = THEMES[world], W = c.W;
  const gr = ctx.createLinearGradient(0, 0, 0, c.hy);
  gr.addColorStop(0, th.sky[0]); gr.addColorStop(1, th.sky[1]);
  ctx.fillStyle = gr; ctx.fillRect(0, 0, W, c.hy + 2);
  const shift = -g.curve * 9000;   // the far scenery slides when the path bends
  if (WORLDS[world] === 'night') {
    ctx.fillStyle = '#FFF4C8';
    for (let i = 0; i < 30; i++) { const sx = (((i * 97 + shift * 0.3) % (W + 20)) + W + 20) % (W + 20), sy = 10 + ((i * 53) % (c.hy - 30)); const tw = 0.8 + 0.6 * Math.sin(g.t * 2 + i); ctx.fillRect(sx, sy, tw * 1.6, tw * 1.6); }
    ctx.fillStyle = '#F6EFCF'; ctx.beginPath(); ctx.arc(W * 0.72 + shift * 0.2, 40, 15, 0, TAU); ctx.fill();
    ctx.fillStyle = th.sky[0]; ctx.beginPath(); ctx.arc(W * 0.72 + shift * 0.2 + 7, 35, 13, 0, TAU); ctx.fill();
  } else {
    ctx.fillStyle = '#FFC84A'; ctx.beginPath(); ctx.arc(W * 0.72 + shift * 0.2, 42, 18, 0, TAU); ctx.fill();
    for (let i = 0; i < 3; i++) { const x = ((((i * W) / 3 + shift * 0.4 - g.dist * 0.4) % (W + 120)) + W + 120) % (W + 120) - 60; puff(ctx, x, 24 + i * 16, 0.8 + (i % 2) * 0.3, '#FFFFFF'); }
  }
  // far hills, or the skyline in the city, or the sea
  ctx.fillStyle = th.hill;
  const name = WORLDS[world];
  if (name === 'city') {
    for (let i = -2; i < W / 26 + 2; i++) { const x = i * 26 + (((shift * 0.6) % 26) + 26) % 26, h = 14 + ((Math.abs(i * 37 + Math.floor(shift * 0.6 / 26) * 11)) % 26); ctx.fillRect(x, c.hy - h, 22, h); }
  } else if (name === 'sea') {
    ctx.fillRect(0, c.hy - 8, W, 8);
    ctx.fillStyle = '#FFFFFF'; for (let i = 0; i < 6; i++) ctx.fillRect(((i * 71 + shift * 0.5 + g.t * 6) % W + W) % W, c.hy - 5, 10, 1.5);
  } else {
    ctx.beginPath(); ctx.moveTo(0, c.hy);
    for (let x = 0; x <= W + 8; x += 8) ctx.lineTo(x, c.hy - 10 - 9 * Math.sin((x - shift * 0.5) * 0.03) - 5 * Math.sin((x - shift * 0.5) * 0.071 + 1));
    ctx.lineTo(W + 8, c.hy); ctx.closePath(); ctx.fill();
  }
}

function ground(ctx: Ctx, c: Cam, world: number, g: Game) {
  const th = THEMES[world], name = WORLDS[world];
  ctx.fillStyle = th.grass[0]; ctx.fillRect(0, c.hy, c.W, H - c.hy);
  const N = 44, near = -2.4, far = 74, edge = LANE * 1.5;
  const zs: number[] = [];
  for (let i = 0; i <= N; i++) zs.push(near + (far - near) * Math.pow(i / N, 1.7));
  for (let i = N; i > 0; i--) {
    const z0 = zs[i], z1 = zs[i - 1];
    const band = Math.floor((z1 + g.dist) / 2.2) % 2;
    const pl0 = proj(c, -edge, 0, z0), pr0 = proj(c, edge, 0, z0), pl1 = proj(c, -edge, 0, z1), pr1 = proj(c, edge, 0, z1);
    if (!pl0 || !pr0 || !pl1 || !pr1) continue;
    ctx.globalAlpha = fogA(z1);
    // sides: grass stripes, or water on the right at the seaside
    const L0 = proj(c, -40, 0, z0)!, L1 = proj(c, -40, 0, z1)!, R0 = proj(c, 40, 0, z0)!, R1 = proj(c, 40, 0, z1)!;
    ctx.fillStyle = th.grass[band]; quad(ctx, L0, pl0, pl1, L1);
    ctx.fillStyle = name === 'sea' ? (band ? '#7EC8E3' : '#76C1DD') : th.grass[band];
    if (name === 'sea') { const s0 = proj(c, edge + 1.6, 0, z0)!, s1 = proj(c, edge + 1.6, 0, z1)!; quad(ctx, s0, R0, R1, s1); ctx.fillStyle = th.grass[band]; quad(ctx, pr0, s0, s1, pr1); }
    else quad(ctx, pr0, R0, R1, pr1);
    // the path
    ctx.fillStyle = th.road[band]; quad(ctx, pl0, pr0, pr1, pl1);
    // edges and dashed lane lines
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    const e = 0.08;
    for (const sx of [-edge, edge]) { const a = proj(c, sx - e, 0, z0)!, b = proj(c, sx + e, 0, z0)!, cc = proj(c, sx + e, 0, z1)!, d = proj(c, sx - e, 0, z1)!; quad(ctx, a, b, cc, d); }
    if (Math.floor((z1 + g.dist) / 1.3) % 2 === 0) {
      ctx.fillStyle = th.line;
      for (const sx of [-LANE / 2, LANE / 2]) { const a = proj(c, sx - 0.05, 0, z0)!, b = proj(c, sx + 0.05, 0, z0)!, cc = proj(c, sx + 0.05, 0, z1)!, d = proj(c, sx - 0.05, 0, z1)!; quad(ctx, a, b, cc, d); }
    }
  }
  ctx.globalAlpha = 1;
}

// ---------- things by the path ----------
type Prop = { z: number; x: number; kind: string; h: number; seed: number };
function props(g: Game, world: number): Prop[] {
  const out: Prop[] = [], step = 4.5, base = Math.floor(g.dist / step), name = WORLDS[world];
  for (let k = -1; k < 17; k++) {
    const id = base + k, z = id * step - g.dist;
    const hsh = Math.abs(Math.sin(id * 12.9898) * 43758.5453) % 1;
    for (const side of [-1, 1]) {
      const r = (hsh * (side > 0 ? 7 : 3)) % 1;
      if (name === 'sea' && side > 0) { if (r < 0.18) out.push({ z: z + 2, x: LANE * 1.5 + 4 + r * 10, kind: 'buoy', h: 0.5, seed: r }); continue; }
      const gap = name === 'city' ? 0.9 : 1.2;
      const x = side * (LANE * 1.5 + gap + r * (name === 'city' ? 0.3 : 1.8));
      let kind = 'tree';
      if (name === 'city') kind = r < 0.2 ? 'lamp' : 'house';
      else if (name === 'sea') kind = r < 0.5 ? 'palm' : r < 0.75 ? 'parasol' : 'none';
      else if (name === 'night') kind = r < 0.35 ? 'lamp' : r < 0.85 ? 'tree' : 'bush';
      else kind = r < 0.6 ? 'tree' : r < 0.85 ? 'bush' : 'flowers';
      if (kind !== 'none') out.push({ z: z + (side > 0 ? 2.2 : 0), x, kind, h: name === 'city' ? 3 + r * 4 : 2.4 + r * 1.2, seed: r });
    }
  }
  return out;
}

function drawProp(ctx: Ctx, c: Cam, o: Prop, world: number) {
  const b = proj(c, o.x, 0, o.z); if (!b) return;
  const s = b.s, night = WORLDS[world] === 'night';
  ctx.globalAlpha = fogA(o.z);
  switch (o.kind) {
    case 'tree': {
      ctx.fillStyle = night ? '#4A3B2A' : '#7A5A3A'; ctx.fillRect(b.x - 0.1 * s, b.y - 1.2 * s, 0.2 * s, 1.2 * s);
      ctx.fillStyle = night ? '#24402C' : o.seed > 0.5 ? '#4C9A50' : '#5DAA58';
      ctx.beginPath(); ctx.arc(b.x, b.y - 1.6 * s, 0.75 * s, 0, TAU); ctx.arc(b.x - 0.45 * s, b.y - 1.25 * s, 0.5 * s, 0, TAU); ctx.arc(b.x + 0.45 * s, b.y - 1.25 * s, 0.5 * s, 0, TAU); ctx.fill();
      break;
    }
    case 'bush': ctx.fillStyle = night ? '#2E5236' : '#6DB463'; ctx.beginPath(); ctx.arc(b.x, b.y - 0.3 * s, 0.45 * s, Math.PI, 0); ctx.arc(b.x + 0.4 * s, b.y - 0.2 * s, 0.3 * s, Math.PI, 0); ctx.fill(); break;
    case 'flowers': for (let i = 0; i < 4; i++) { ctx.fillStyle = ['#FF8CC6', '#FFC84A', '#FFFFFF', '#E2412B'][i]; ctx.beginPath(); ctx.arc(b.x + (i - 1.5) * 0.25 * s, b.y - (0.15 + (i % 2) * 0.1) * s, 0.09 * s, 0, TAU); ctx.fill(); } break;
    case 'house': {
      const w = 2.6 * s, h = o.h * s, x0 = o.x < 0 ? b.x - w : b.x;
      ctx.fillStyle = ['#C9CED8', '#D9C8B4', '#B8C4D6', '#D6B8B0'][Math.floor(o.seed * 4)]; ctx.fillRect(x0, b.y - h, w, h);
      ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(o.x < 0 ? b.x - 0.12 * s : b.x, b.y - h, 0.12 * s, h);
      ctx.fillStyle = '#FFE7A8';
      if (s > 4) for (let wy = 0.5; wy < o.h - 0.4; wy += 0.9) for (let wx = 0.35; wx < 2.3; wx += 0.7) ctx.fillRect(x0 + wx * s, b.y - h + wy * s, 0.3 * s, 0.4 * s);
      break;
    }
    case 'lamp': {
      ctx.fillStyle = '#3B3B44'; ctx.fillRect(b.x - 0.04 * s, b.y - 2.2 * s, 0.08 * s, 2.2 * s);
      ctx.fillStyle = night ? '#FFE873' : '#F2F2F2'; ctx.beginPath(); ctx.arc(b.x, b.y - 2.25 * s, 0.14 * s, 0, TAU); ctx.fill();
      if (night) { ctx.fillStyle = 'rgba(255,232,115,.18)'; ctx.beginPath(); ctx.arc(b.x, b.y - 2.25 * s, 0.6 * s, 0, TAU); ctx.fill(); }
      break;
    }
    case 'palm': {
      ctx.strokeStyle = '#8A6A44'; ctx.lineWidth = Math.max(1, 0.14 * s); ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.quadraticCurveTo(b.x + 0.3 * s * Math.sign(o.x), b.y - 1.4 * s, b.x + 0.1 * s, b.y - 2.6 * s); ctx.stroke();
      ctx.fillStyle = '#3E9E5A';
      for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.6; ctx.beginPath(); ctx.ellipse(b.x + 0.1 * s + Math.cos(a) * 0.55 * s, b.y - 2.6 * s + Math.sin(a) * 0.3 * s + 0.15 * s, 0.6 * s, 0.14 * s, a, 0, TAU); ctx.fill(); }
      break;
    }
    case 'parasol': {
      ctx.fillStyle = '#6B6B6B'; ctx.fillRect(b.x - 0.03 * s, b.y - 1.3 * s, 0.06 * s, 1.3 * s);
      ctx.fillStyle = o.seed > 0.6 ? '#E2412B' : '#2F6FD6'; ctx.beginPath(); ctx.arc(b.x, b.y - 1.25 * s, 0.7 * s, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.moveTo(b.x, b.y - 1.95 * s); ctx.lineTo(b.x - 0.2 * s, b.y - 1.25 * s); ctx.lineTo(b.x + 0.2 * s, b.y - 1.25 * s); ctx.fill();
      break;
    }
    case 'buoy': ctx.fillStyle = '#E2412B'; ctx.beginPath(); ctx.arc(b.x, b.y - 0.15 * s, 0.22 * s, 0, TAU); ctx.fill(); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(b.x - 0.22 * s, b.y - 0.2 * s, 0.44 * s, 0.08 * s); break;
  }
  ctx.globalAlpha = 1;
}

// ---------- obstacles and pick-ups ----------
function box(ctx: Ctx, c: Cam, x: number, w: number, h: number, z: number, d: number, front: string, top: string, side: string) {
  const fl = proj(c, x - w / 2, 0, z), fr = proj(c, x + w / 2, 0, z), tl = proj(c, x - w / 2, h, z), tr = proj(c, x + w / 2, h, z);
  const bl = proj(c, x - w / 2, h, z + d), br = proj(c, x + w / 2, h, z + d);
  if (!fl || !fr || !tl || !tr || !bl || !br) return null;
  ctx.fillStyle = top; quad(ctx, tl, tr, br, bl);
  const sideX = x < c.camX ? x + w / 2 : x - w / 2;
  const s0 = proj(c, sideX, 0, z)!, s1 = proj(c, sideX, h, z)!, s2 = proj(c, sideX, h, z + d)!, s3 = proj(c, sideX, 0, z + d)!;
  if (Math.abs(x - c.camX) > 0.2) { ctx.fillStyle = side; quad(ctx, s0, s1, s2, s3); }
  ctx.fillStyle = front; quad(ctx, fl, fr, tr, tl);
  ctx.strokeStyle = '#1A1A1A'; ctx.lineWidth = Math.max(1, fl.s * 0.03); ctx.beginPath(); ctx.moveTo(fl.x, fl.y); ctx.lineTo(fr.x, fr.y); ctx.lineTo(tr.x, tr.y); ctx.lineTo(tl.x, tl.y); ctx.closePath(); ctx.stroke();
  return { fl, fr, tl, tr };
}

function drawThing(ctx: Ctx, c: Cam, o: Thing, t: number) {
  const name = WORLDS[o.world];
  ctx.globalAlpha = fogA(o.z);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  switch (o.k) {
    case 'block': {
      if (name === 'city') {
        const f = box(ctx, c, o.x, 1.15, 1.5, o.z, o.d, '#3F7F5A', '#2F6447', '#356D4D');
        if (f) { const s = f.fl.s; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 0.06 * s; ctx.beginPath(); ctx.arc((f.fl.x + f.fr.x) / 2, (f.fl.y + f.tl.y) / 2, 0.22 * s, 0.3, 5.6); ctx.stroke(); }
      } else if (name === 'sea') {
        const f = box(ctx, c, o.x, 1.15, 1.2, o.z, o.d, '#E9C98C', '#F3DCA8', '#D8B477');
        if (f) { const s = f.fl.s; ctx.fillStyle = '#E9C98C'; for (const dx of [-0.42, 0, 0.42]) { const tx = (f.tl.x + f.tr.x) / 2 + dx * s; ctx.fillRect(tx - 0.13 * s, f.tl.y - 0.45 * s, 0.26 * s, 0.45 * s); ctx.fillRect(tx - 0.17 * s, f.tl.y - 0.55 * s, 0.34 * s, 0.12 * s); }
          ctx.fillStyle = '#E2412B'; const cx = (f.tl.x + f.tr.x) / 2; ctx.beginPath(); ctx.moveTo(cx, f.tl.y - 0.9 * s); ctx.lineTo(cx + 0.3 * s, f.tl.y - 0.78 * s); ctx.lineTo(cx, f.tl.y - 0.66 * s); ctx.fill(); ctx.fillStyle = '#1A1A1A'; ctx.fillRect(cx - 0.02 * s, f.tl.y - 0.9 * s, 0.04 * s, 0.35 * s);
          ctx.fillStyle = '#B8935A'; ctx.beginPath(); ctx.arc(cx, f.fl.y - 0.35 * s, 0.16 * s, Math.PI, 0); ctx.fill(); }
      } else {
        // a big mossy stone
        const f = box(ctx, c, o.x, 1.15, 1.4, o.z, o.d, name === 'night' ? '#6E6A78' : '#9A958C', name === 'night' ? '#857F90' : '#B5B0A6', name === 'night' ? '#5E5A68' : '#857F76');
        if (f) { const s = f.fl.s; ctx.fillStyle = name === 'night' ? '#2E5236' : '#5DAA58'; ctx.beginPath(); ctx.ellipse(f.tl.x + 0.35 * s, f.tl.y + 0.05 * s, 0.38 * s, 0.12 * s, 0, 0, TAU); ctx.fill(); }
      }
      break;
    }
    case 'low': {
      const b = proj(c, o.x, 0, o.z); if (!b) break; const s = b.s;
      shade(ctx, true);
      if (name === 'city') {
        // a striped road barrier
        ctx.fillStyle = '#3B3B44'; ctx.fillRect(b.x - 0.5 * s, b.y - 0.62 * s, 0.07 * s, 0.62 * s); ctx.fillRect(b.x + 0.43 * s, b.y - 0.62 * s, 0.07 * s, 0.62 * s);
        ctx.fillStyle = '#FFFFFF'; ctx.fillRect(b.x - 0.6 * s, b.y - 0.62 * s, 1.2 * s, 0.24 * s);
        shade(ctx, false); ctx.fillStyle = '#E2412B'; for (let i = 0; i < 4; i++) { ctx.beginPath(); const x0 = b.x - 0.6 * s + i * 0.3 * s; ctx.moveTo(x0, b.y - 0.38 * s); ctx.lineTo(x0 + 0.15 * s, b.y - 0.62 * s); ctx.lineTo(x0 + 0.27 * s, b.y - 0.62 * s); ctx.lineTo(x0 + 0.12 * s, b.y - 0.38 * s); ctx.fill(); }
      } else if (name === 'sea') {
        if (o.seed > 3) {
          // a crab, sidestepping
          const st = Math.sin(t * 16 + o.seed) * 0.08 * s;
          ctx.fillStyle = '#E2412B'; ctx.beginPath(); ctx.ellipse(b.x + st, b.y - 0.25 * s, 0.45 * s, 0.25 * s, 0, 0, TAU); ctx.fill();
          ctx.beginPath(); ctx.arc(b.x - 0.5 * s + st, b.y - 0.5 * s, 0.17 * s, 0, TAU); ctx.arc(b.x + 0.5 * s + st, b.y - 0.5 * s, 0.17 * s, 0, TAU); ctx.fill();
          shade(ctx, false); ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(b.x - 0.12 * s + st, b.y - 0.55 * s, 0.09 * s, 0, TAU); ctx.arc(b.x + 0.12 * s + st, b.y - 0.55 * s, 0.09 * s, 0, TAU); ctx.fill();
          ctx.fillStyle = '#1A1A1A'; ctx.beginPath(); ctx.arc(b.x - 0.12 * s + st, b.y - 0.55 * s, 0.045 * s, 0, TAU); ctx.arc(b.x + 0.12 * s + st, b.y - 0.55 * s, 0.045 * s, 0, TAU); ctx.fill();
        } else {
          ctx.fillStyle = '#9A958C'; ctx.beginPath(); ctx.ellipse(b.x, b.y - 0.05 * s, 0.6 * s, 0.6 * s, 0, Math.PI, 0); ctx.fill(); shade(ctx, false);
          ctx.fillStyle = '#B9B4AA'; ctx.beginPath(); ctx.ellipse(b.x - 0.2 * s, b.y - 0.4 * s, 0.15 * s, 0.07 * s, -0.3, 0, TAU); ctx.fill();
        }
      } else {
        // a thorny bush
        ctx.fillStyle = name === 'night' ? '#24502C' : '#2E6B35';
        ctx.beginPath(); ctx.moveTo(b.x - 0.6 * s, b.y);
        for (let i = 0; i < 6; i++) { const x0 = b.x - 0.6 * s + (i / 6) * 1.2 * s; ctx.lineTo(x0 + 0.1 * s, b.y - (0.5 + ((i * 7 + Math.floor(o.seed * 10)) % 3) * 0.06) * s); ctx.lineTo(x0 + 0.2 * s, b.y - 0.2 * s); }
        ctx.lineTo(b.x + 0.6 * s, b.y); ctx.closePath(); ctx.fill(); shade(ctx, false);
        ctx.strokeStyle = '#1A1A1A'; ctx.lineWidth = Math.max(1, 0.025 * s); ctx.stroke();
      }
      shade(ctx, false);
      break;
    }
    case 'cloud': {
      const bob = Math.sin(t * 3 + o.seed) * 0.04;
      const b = proj(c, o.x, CLOUD_BOTTOM + 0.38 + bob, o.z); if (!b) break; const s = b.s / 40;
      const top = name === 'city' ? '#A2988C' : name === 'night' ? '#6B6890' : '#8D909B';
      const under = name === 'city' ? '#857B70' : name === 'night' ? '#55527A' : '#767985';
      shade(ctx, true); puff(ctx, b.x - 18 * s * 1.3, b.y, s * 1.3, top); shade(ctx, false);
      puff(ctx, b.x - 15 * s * 1.3, b.y + 4 * s, s * 1.1, under);
      ctx.strokeStyle = '#2B2D33'; ctx.lineWidth = Math.max(1, 2.4 * s); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(b.x - 12 * s, b.y - 7 * s); ctx.lineTo(b.x - 4 * s, b.y - 3 * s); ctx.moveTo(b.x + 12 * s, b.y - 7 * s); ctx.lineTo(b.x + 4 * s, b.y - 3 * s);
      ctx.moveTo(b.x - 7 * s, b.y + 7 * s); ctx.quadraticCurveTo(b.x, b.y + 1 * s, b.x + 7 * s, b.y + 7 * s); ctx.stroke();
      // a faint shadow on the path shows which lane it blocks
      const g0 = proj(c, o.x, 0, o.z);
      if (g0) { ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.beginPath(); ctx.ellipse(g0.x, g0.y, 0.55 * g0.s, 0.12 * g0.s, 0, 0, TAU); ctx.fill(); }
      break;
    }
    case 'heart': {
      const b = proj(c, o.x, o.y + Math.sin(t * 5 + o.z) * 0.05, o.z); const hp = P()?.heart; if (!b || !hp) break;
      const k = (0.42 * b.s) / 24;
      ctx.save(); ctx.translate(b.x, b.y); ctx.scale(k, k);
      shade(ctx, true); ctx.fillStyle = '#E2412B'; ctx.fill(hp); shade(ctx, false);
      ctx.strokeStyle = '#1A1A1A'; ctx.lineWidth = 1.6; ctx.stroke(hp); ctx.restore();
      break;
    }
    case 'litter': {
      const b = proj(c, o.x, o.y, o.z); if (!b) break; const k = b.s / 34;
      ctx.save(); ctx.translate(b.x, b.y); ctx.scale(k, k); ctx.rotate(Math.sin(t * 4 + o.seed) * 0.25);
      if (name === 'sea') { ctx.fillStyle = 'rgba(126,200,227,.95)'; ctx.fillRect(-4, -8, 8, 16); ctx.fillRect(-2, -12, 4, 4); ctx.fillStyle = '#2F6FD6'; ctx.fillRect(-2.5, -14, 5, 3); }
      else { ctx.fillStyle = '#D9DDE3'; ctx.fillRect(-5, -7, 10, 14); ctx.fillStyle = '#E2412B'; ctx.fillRect(-5, -3, 10, 6); }
      ctx.strokeStyle = '#1A1A1A'; ctx.lineWidth = 1.2; ctx.strokeRect(-5, -8, 10, 16);
      ctx.rotate(-Math.sin(t * 4 + o.seed) * 0.25);
      ctx.strokeStyle = 'rgba(61,186,92,.8)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(0, 0, 13 + Math.sin(t * 5) * 1.5, 0, TAU); ctx.stroke();
      ctx.restore();
      break;
    }
    case 'power': {
      const b = proj(c, o.x, o.y + Math.sin(t * 3 + o.seed) * 0.08, o.z); if (!b) break; const k = b.s / 34;
      ctx.save(); ctx.translate(b.x, b.y); ctx.scale(k, k);
      ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.strokeStyle = '#1A1A1A'; ctx.lineWidth = 1.6;
      shade(ctx, true); ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); ctx.fill(); shade(ctx, false); ctx.stroke();
      powerIcon(ctx, o.p!, 0, 0, 1);
      ctx.strokeStyle = 'rgba(255,200,74,.85)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 17 + Math.sin(t * 6) * 1.5, 0, TAU); ctx.stroke();
      ctx.restore();
      break;
    }
  }
  ctx.globalAlpha = 1;
}

// ---------- Mylo and the gloom behind him ----------
function drawMylo(ctx: Ctx, c: Cam, g: Game, outfit: Outfit) {
  const hit = g.phase === 'over', s = scaleOf(g), slid = sliding(g) && !hit;
  const sh = proj(c, g.x, 0, 0); if (!sh) return;
  const lift = Math.min(1, g.y / 1.6);
  ctx.fillStyle = `rgba(0,0,0,${0.22 - lift * 0.12})`; ctx.beginPath(); ctx.ellipse(sh.x, sh.y, (0.5 - lift * 0.15) * sh.s * s, 0.13 * sh.s, 0, 0, TAU); ctx.fill();
  const b = proj(c, g.x, g.y, 0)!;
  const k = (1.55 * b.s * s) / 240;   // the drawing box is 240 tall
  if (g.shield && !hit) {
    const u = proj(c, g.x, g.y + (slid ? 0.8 : 1.3) * s, 0)!;
    shade(ctx, true); ctx.fillStyle = '#2F6FD6'; ctx.beginPath(); ctx.arc(u.x, u.y, 0.55 * u.s * s, Math.PI, 0); ctx.closePath(); ctx.fill(); shade(ctx, false);
    ctx.fillStyle = '#7EC8E3'; ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.arc(u.x, u.y, 0.55 * u.s * s, Math.PI * 1.35, Math.PI * 1.65); ctx.fill();
  }
  if (g.magnet > 0 && !hit) {
    ctx.strokeStyle = `rgba(226,65,43,${0.3 + 0.2 * Math.sin(g.t * 10)})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(b.x, b.y - 0.6 * b.s, (0.9 + Math.sin(g.t * 10) * 0.05) * b.s, 0.85 * b.s, 0, 0, TAU); ctx.stroke();
  }
  if (g.invuln > 0 && !hit && Math.floor(g.t * 12) % 2) return;
  ctx.save();
  ctx.translate(b.x, b.y);
  if (g.landed > 0 && !slid) ctx.scale(1.08, 0.92);
  ctx.scale(k, k); ctx.translate(-100, -224);
  if (hit) myloSprite(ctx, { t: g.t, run: false, ground: g.ground, up: false, roll: false, hit: true, blink: false, landed: false, outfit });
  else if (slid) myloSprite(ctx, { t: g.t, run: true, ground: true, up: false, roll: true, hit: false, blink: false, landed: false, outfit });
  else myloBack(ctx, { t: g.t, run: g.phase === 'run', ground: g.ground, outfit, glow: g.big > 0 });
  ctx.restore();
}

function gloom(ctx: Ctx, c: Cam, g: Game) {
  if (g.chase <= 0.02) return;
  const s = 3.2, x = c.W / 2 + Math.sin(g.t * 2) * 10, y = H + 46 - g.chase * 52;
  ctx.globalAlpha = Math.min(1, g.chase * 1.5);
  puff(ctx, x - 52 * s * 0.5 - 24, y, s * 0.9, '#8D909B');
  puff(ctx, x - 52 * s * 0.5 + 20, y + 6, s * 0.8, '#767985');
  ctx.strokeStyle = '#2B2D33'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - 26, y - 18); ctx.lineTo(x - 8, y - 10); ctx.moveTo(x + 26, y - 18); ctx.lineTo(x + 8, y - 10); ctx.stroke();
  ctx.fillStyle = '#2B2D33'; ctx.beginPath(); ctx.ellipse(x, y + 8, 10, 6, 0, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
}

// ---------- the whole frame ----------
export function drawFrame(ctx: Ctx, g: Game, v: { W: number; scale: number; dpr: number }, L: Labels, outfit: Outfit, best: number) {
  const { W, scale, dpr } = v;
  setUnit(dpr * scale);
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
  shade(ctx, false);
  const cam: Cam = { W, f: Math.min(250, W * 0.86), hy: 104, camX: g.x * 0.55, camH: 2.5, camZ: -4.3, curve: g.curve };
  const world = g.worldFade > 0 && g.prevWorld !== g.world && g.worldFade > 0.5 ? g.prevWorld : g.world;
  sky(ctx, cam, world, g);
  ground(ctx, cam, world, g);
  // far to near: things by the path, obstacles, pick-ups, then Mylo
  const items: { z: number; draw: () => void }[] = [];
  for (const pr of props(g, world)) items.push({ z: pr.z, draw: () => drawProp(ctx, cam, pr, world) });
  for (const o of g.things) if (o.z < 74 && o.z + o.d > -0.9) items.push({ z: o.z + (o.k === 'block' ? o.d : 0) + 0.01, draw: () => drawThing(ctx, cam, o, g.t) });
  items.push({ z: 0, draw: () => drawMylo(ctx, cam, g, outfit) });
  items.sort((a, b) => b.z - a.z);
  for (const it of items) it.draw();
  if (g.worldFade > 0 && g.prevWorld !== g.world) { ctx.globalAlpha = 1 - Math.abs(g.worldFade - 0.5) * 2; ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  gloom(ctx, cam, g);
  for (const b of g.bits) {
    const p = proj(cam, b.x, b.y, b.z); if (!p) continue;
    ctx.globalAlpha = Math.max(0, 1 - b.life / b.max);
    if (b.text) { ctx.fillStyle = b.c; ctx.font = `800 ${b.size ?? 15}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.fillText(b.text, p.x, p.y); }
    else { const r = Math.max(1.5, b.r * p.s); ctx.fillStyle = b.c; ctx.fillRect(p.x - r / 2, p.y - r / 2, r, r); }
  }
  ctx.globalAlpha = 1;
  hud(ctx, g, W, L, best);
}

function pill(ctx: Ctx, x: number, y: number, w: number, h: number) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, h / 2); else ctx.rect(x, y, w, h); }

function hud(ctx: Ctx, g: Game, W: number, L: Labels, best: number) {
  const th = THEMES[g.world], pa = P();
  // a soft band behind the numbers so they read on any world
  ctx.fillStyle = 'rgba(255,255,255,.55)'; pill(ctx, W - 104, 6, 98, best > 0 ? 40 : 26); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.55)'; pill(ctx, 6, 6, g.combo > 1 ? 104 : 70, 26); ctx.fill();
  ctx.textAlign = 'right'; ctx.textBaseline = 'top';
  ctx.fillStyle = '#1A1A1A'; ctx.font = '800 17px ui-monospace, Menlo, Consolas, monospace';
  ctx.fillText(String(g.score).padStart(5, '0'), W - 14, 10);
  if (best > 0) { ctx.fillStyle = '#4A453E'; ctx.font = '700 11px ui-monospace, Menlo, Consolas, monospace'; ctx.fillText(`${L.best.toUpperCase()} ${String(best).padStart(5, '0')}`, W - 14, 30); }
  if (pa) { ctx.save(); ctx.translate(20, 17); ctx.scale(0.55, 0.55); ctx.fillStyle = '#E2412B'; ctx.fill(pa.heart); ctx.restore(); }
  ctx.textAlign = 'left'; ctx.fillStyle = '#1A1A1A'; ctx.font = '800 15px system-ui, sans-serif'; ctx.fillText(String(g.hearts), 31, 11);
  if (g.combo > 1) { ctx.fillStyle = '#E2412B'; ctx.font = '900 13px system-ui, sans-serif'; ctx.fillText(`x${Math.min(g.combo, 5)}`, 31 + ctx.measureText(String(g.hearts)).width + 14, 12); }
  let px = 20;
  const bar = (p: string, left: number, max: number) => {
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(px, 46, 11, 0, TAU); ctx.fill();
    powerIcon(ctx, p, px, 46, 0.7);
    if (max > 0) { ctx.strokeStyle = '#1A1A1A'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, 46, 12, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0, left / max)); ctx.stroke(); }
    px += 28;
  };
  if (g.shield) bar('umbrella', 0, 0);
  if (g.magnet > 0) bar('magnet', g.magnet, 8);
  if (g.big > 0) bar('sprout', g.big, 5);
  if (L.daily) { ctx.textAlign = 'left'; ctx.fillStyle = th.soft; ctx.font = '700 11px system-ui, sans-serif'; ctx.fillText(L.daily, px - 8, 41); }

  ctx.textAlign = 'center';
  if (g.banner > 0) {
    ctx.globalAlpha = Math.min(1, g.banner * 2);
    const txt = L.worlds[g.world]; ctx.font = '900 22px system-ui, sans-serif'; const tw = ctx.measureText(txt).width + 28;
    ctx.fillStyle = '#FFC84A'; ctx.strokeStyle = '#1A1A1A'; ctx.lineWidth = 2; pill(ctx, W / 2 - tw / 2, 62, tw, 34); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1A1A1A'; ctx.fillText(txt, W / 2, 68); ctx.globalAlpha = 1;
  } else if (g.flash > 0) {
    ctx.globalAlpha = Math.min(1, g.flash * 2); ctx.fillStyle = g.world === 3 ? '#FFC84A' : '#B83A0B'; ctx.font = '900 26px system-ui, sans-serif';
    ctx.fillText(g.flashText + '!', W / 2, 66 - (1.1 - g.flash) * 12); ctx.globalAlpha = 1;
  }
  if (g.tipT > 0 && g.tip) {
    ctx.globalAlpha = Math.min(1, g.tipT * 2);
    const txt = L.tips[g.tip]; ctx.font = '800 14px system-ui, sans-serif';
    const tw = Math.min(W - 16, ctx.measureText(txt).width + 24);
    ctx.fillStyle = 'rgba(17,17,17,.85)'; pill(ctx, W / 2 - tw / 2, 112, tw, 26); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; ctx.fillText(txt, W / 2, 118, W - 32); ctx.globalAlpha = 1;
  }
  if (g.toastT > 0 && g.toast) {
    ctx.globalAlpha = Math.min(1, g.toastT * 2); ctx.font = '800 13px system-ui, sans-serif';
    const tw = Math.min(W - 16, ctx.measureText(g.toast).width + 24);
    ctx.fillStyle = '#3DBA5C'; ctx.strokeStyle = '#1A1A1A'; ctx.lineWidth = 1.5; pill(ctx, W / 2 - tw / 2, 146, tw, 22); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#111111'; ctx.fillText(g.toast, W / 2, 150, W - 32); ctx.globalAlpha = 1;
  }
  ctx.textBaseline = 'alphabetic';
}
