// Mylo's Run: everything drawn on the canvas. Paper-cut style: flat shapes with a small hard shadow.
import { GROUND, H, MX, WORLDS, rolling, scaleOf, type Game, type Thing } from './engine';
import type { Outfit } from './progress';

export type Labels = { best: string; worlds: string[]; tips: Record<'high' | 'low' | 'power', string>; daily?: string };
type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

let paths: Record<string, Path2D> | null = null;
function P() {
  if (!paths && typeof Path2D !== 'undefined') paths = {
    leafA: new Path2D('M100 90 C86 68 94 56 102 54 C110 68 108 82 100 90 Z'),
    leafB: new Path2D('M100 90 C116 74 132 74 138 82 C128 92 112 94 100 90 Z'),
    heart: new Path2D('M0 -3 c-3 -7 -12 -5 -12 2 c0 6 7 10 12 15 c5 -5 12 -9 12 -15 c0 -7 -9 -9 -12 -2 Z'),
  };
  return paths;
}

// shadows are in device pixels, so they are scaled by hand
let unit = 1;
function shade(ctx: Ctx, on: boolean) {
  ctx.shadowColor = on ? 'rgba(0,0,0,.22)' : 'transparent';
  ctx.shadowOffsetX = on ? 1.5 * unit : 0; ctx.shadowOffsetY = on ? 2.5 * unit : 0; ctx.shadowBlur = 0;
}

// ---------- backgrounds ----------
type Theme = { sky: [string, string]; far: string; near: string; ground: string; groundDot: string; ink: string; soft: string };
export const THEMES: Theme[] = [
  { sky: ['#FFF6E6', '#FCE2C2'], far: '#D7E6B8', near: '#B5D592', ground: '#E8D2A6', groundDot: '#C9B48A', ink: '#1A1A1A', soft: '#6B6457' },
  { sky: ['#EEF3F8', '#F9E4CF'], far: '#C9CED8', near: '#A9B1BF', ground: '#D3CEC6', groundDot: '#B2ACA2', ink: '#1A1A1A', soft: '#5C6270' },
  { sky: ['#E3F4FF', '#FFF0D8'], far: '#7EC8E3', near: '#F3DFAE', ground: '#F1D9A0', groundDot: '#D8BC7E', ink: '#1A1A1A', soft: '#5B6B73' },
  { sky: ['#1E2747', '#3F4677'], far: '#2E4637', near: '#3C5C45', ground: '#7D6E52', groundDot: '#655940', ink: '#F7EFE0', soft: '#C9C3E6' },
];

function hills(ctx: Ctx, off: number, base: number, amp: number, k: number, color: string, W: number) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W + 8; x += 8) { const u = x + off; ctx.lineTo(x, base - amp * (0.55 + 0.3 * Math.sin(u * k) + 0.15 * Math.sin(u * k * 2.7 + 1))); }
  ctx.lineTo(W + 8, H); ctx.closePath(); ctx.fill();
}
function puff(ctx: Ctx, x: number, y: number, s: number, fill: string) {
  ctx.fillStyle = fill; ctx.beginPath();
  ctx.arc(x, y, 10 * s, 0, TAU); ctx.arc(x + 12 * s, y - 6 * s, 13 * s, 0, TAU); ctx.arc(x + 26 * s, y, 10 * s, 0, TAU); ctx.rect(x, y - 2 * s, 26 * s, 12 * s); ctx.fill();
}
const wrap = (x: number, span: number) => ((x % span) + span) % span;

function backdrop(ctx: Ctx, world: number, d: number, t: number, W: number) {
  const th = THEMES[world];
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
  sky.addColorStop(0, th.sky[0]); sky.addColorStop(1, th.sky[1]);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  const name = WORLDS[world];
  if (name === 'night') {
    ctx.fillStyle = '#FFF4C8';
    for (let i = 0; i < 26; i++) { const sx = wrap(i * 97 - d * 0.03, W + 20), sy = 12 + ((i * 53) % 110); const tw = 0.8 + 0.6 * Math.sin(t * 2 + i); ctx.fillRect(sx, sy, tw * 1.6, tw * 1.6); }
    ctx.fillStyle = '#F6EFCF'; ctx.beginPath(); ctx.arc(W - 150, 44, 17, 0, TAU); ctx.fill();
    ctx.fillStyle = th.sky[0]; ctx.beginPath(); ctx.arc(W - 143, 39, 15, 0, TAU); ctx.fill();
  } else {
    ctx.fillStyle = '#FFC84A'; ctx.beginPath(); ctx.arc(W - 150, 46, 20, 0, TAU); ctx.fill();
    for (let i = 0; i < 3; i++) { const span = W + 160, x = wrap((i * span) / 3 - d * 0.08, span); puff(ctx, x - 40, 40 + i * 18, 0.9 + (i % 2) * 0.3, '#FFFFFF'); }
  }
  if (name === 'city') {
    // two rows of paper buildings
    for (const [par, color, base, win] of [[0.12, th.far, 70, '#E9EDF3'], [0.35, th.near, 46, '#FFE7A8']] as const) {
      const span = 70, off = d * par;
      for (let i = -1; i < W / span + 2; i++) {
        const idx = Math.floor(off / span) + i, x = i * span - wrap(off, span);
        const h = base + ((idx * 37) % 40) + (par > 0.2 ? 0 : 20), w = 44 + ((idx * 13) % 18);
        ctx.fillStyle = color; ctx.fillRect(x, GROUND - h, w, h);
        ctx.fillStyle = win;
        for (let wy = GROUND - h + 8; wy < GROUND - 12; wy += 14) for (let wx = x + 6; wx < x + w - 8; wx += 12) if ((idx + wy + wx) % 3) ctx.fillRect(wx, wy, 5, 6);
      }
    }
  } else if (name === 'sea') {
    ctx.fillStyle = th.far; ctx.fillRect(0, GROUND - 52, W, 52);
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2; ctx.beginPath();
    for (let x = 0; x <= W; x += 6) ctx.lineTo(x, GROUND - 50 + Math.sin((x + d * 0.2 + t * 40) * 0.05) * 2.5);
    ctx.stroke();
    // a little boat far away
    const bx = wrap(W * 0.6 - d * 0.05, W + 80) - 40;
    ctx.fillStyle = '#E2412B'; ctx.beginPath(); ctx.moveTo(bx, GROUND - 46); ctx.lineTo(bx + 30, GROUND - 46); ctx.lineTo(bx + 24, GROUND - 38); ctx.lineTo(bx + 6, GROUND - 38); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.moveTo(bx + 15, GROUND - 47); ctx.lineTo(bx + 15, GROUND - 68); ctx.lineTo(bx + 28, GROUND - 49); ctx.fill();
    hills(ctx, d * 0.4 + 300, GROUND + 4, 16, 0.018, th.near, W);
  } else {
    hills(ctx, d * 0.15, GROUND - 18, 46, 0.012, th.far, W);
    hills(ctx, d * 0.4 + 300, GROUND - 4, 30, 0.021, th.near, W);
    if (name === 'night') {
      ctx.fillStyle = '#FFE873';
      for (let i = 0; i < 7; i++) { const fx = wrap(i * 83 - d * 0.5 + Math.sin(t + i) * 10, W + 40) - 20, fy = GROUND - 30 - ((i * 29) % 70) + Math.sin(t * 2 + i) * 6; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 3 + i * 2); ctx.beginPath(); ctx.arc(fx, fy, 1.8, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
  }
  ctx.fillStyle = th.ground; ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.fillStyle = '#1A1A1A'; ctx.fillRect(0, GROUND - 1, W, 2);
  ctx.fillStyle = th.groundDot;
  if (name === 'city') for (let x = -wrap(d, 60); x < W; x += 60) ctx.fillRect(x, GROUND + 14, 30, 3);
  else for (let x = -wrap(d, 46); x < W; x += 46) { ctx.fillRect(x, GROUND + 9, 10, 2); ctx.fillRect(x + 23, GROUND + 20, 6, 2); }
}

// ---------- things ----------
function cloud(ctx: Ctx, o: Thing, t: number) {
  const low = o.k === 'low', bob = Math.sin(t * 3 + o.seed) * (low ? 1.5 : 3);
  const name = WORLDS[o.world];
  const top = name === 'city' ? '#A2988C' : name === 'night' ? '#6B6890' : '#8D909B';
  const under = name === 'city' ? '#857B70' : name === 'night' ? '#55527A' : '#767985';
  const s = o.w / 40, cy = o.y + bob + o.h * 0.55;
  shade(ctx, true); puff(ctx, o.x + 4, cy, s * 0.92, top); shade(ctx, false);
  puff(ctx, o.x + 4, cy + 4, s * 0.78, under);
  ctx.strokeStyle = '#2B2D33'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  const fx = o.x + o.w / 2, fy = cy - 2;
  ctx.beginPath(); ctx.moveTo(fx - 12, fy - 6); ctx.lineTo(fx - 5, fy - 3); ctx.moveTo(fx + 12, fy - 6); ctx.lineTo(fx + 5, fy - 3);
  ctx.moveTo(fx - 6, fy + 6); ctx.quadraticCurveTo(fx, fy + 1, fx + 6, fy + 6); ctx.stroke();
  if (!low) {
    ctx.fillStyle = '#5E7FB5';
    for (let k = 0; k < 3; k++) { const ry = (t * 90 + k * 13 + o.seed * 10) % 16; ctx.fillRect(o.x + 14 + (k * (o.w - 28)) / 2, cy + 12 + ry, 1.6, 5); }
  }
}

function thing(ctx: Ctx, o: Thing, t: number, heart: Path2D | undefined) {
  ctx.lineJoin = 'round';
  switch (o.k) {
    case 'thorn': {
      const night = WORLDS[o.world] === 'night';
      shade(ctx, true); ctx.fillStyle = night ? '#24502C' : '#2E6B35'; ctx.strokeStyle = '#1A1A1A'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(o.x, GROUND);
      const sp = o.spikes!, n = sp.length, sw = o.w / n;
      sp.forEach((s, i) => { ctx.lineTo(o.x + i * sw + sw / 2, GROUND - o.h * s); ctx.lineTo(o.x + (i + 1) * sw, GROUND - (i < n - 1 ? o.h * 0.35 : 0)); });
      ctx.closePath(); ctx.fill(); shade(ctx, false); ctx.stroke();
      ctx.fillStyle = '#4C9A50';
      sp.forEach((s, i) => { const px = o.x + i * sw + sw / 2; ctx.beginPath(); ctx.moveTo(px - 2, GROUND - o.h * s * 0.5); ctx.lineTo(px - 7, GROUND - o.h * s * 0.62); ctx.lineTo(px - 1, GROUND - o.h * s * 0.42); ctx.fill(); });
      break;
    }
    case 'cone': {
      const n = o.w > 20 ? 2 : 1, cw = o.w / n;
      for (let i = 0; i < n; i++) {
        const x = o.x + i * cw;
        shade(ctx, true); ctx.fillStyle = '#FF7A1A'; ctx.beginPath(); ctx.moveTo(x + 1, GROUND); ctx.lineTo(x + cw / 2, GROUND - o.h); ctx.lineTo(x + cw - 1, GROUND); ctx.closePath(); ctx.fill(); shade(ctx, false);
        ctx.strokeStyle = '#1A1A1A'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x + cw * 0.3, GROUND - o.h * 0.55, cw * 0.4, 4);
        ctx.fillStyle = '#1A1A1A'; ctx.fillRect(x - 1, GROUND - 3, cw + 2, 3);
      }
      break;
    }
    case 'bin': {
      shade(ctx, true); ctx.fillStyle = '#3F7F5A'; ctx.fillRect(o.x + 2, o.y + 5, o.w - 4, o.h - 5); shade(ctx, false);
      ctx.fillStyle = '#2F6447'; ctx.fillRect(o.x, o.y, o.w, 6);
      ctx.strokeStyle = '#1A1A1A'; ctx.lineWidth = 1.5; ctx.strokeRect(o.x + 2, o.y + 5, o.w - 4, o.h - 5); ctx.strokeRect(o.x, o.y, o.w, 6);
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(o.x + o.w / 2, o.y + o.h / 2 + 3, 5, 0.3, 5.6); ctx.stroke();
      break;
    }
    case 'rock': {
      shade(ctx, true); ctx.fillStyle = '#9A958C'; ctx.beginPath();
      ctx.moveTo(o.x, GROUND); ctx.quadraticCurveTo(o.x + 2, o.y + 4, o.x + o.w * 0.45, o.y); ctx.quadraticCurveTo(o.x + o.w, o.y + 2, o.x + o.w, GROUND); ctx.closePath(); ctx.fill(); shade(ctx, false);
      ctx.strokeStyle = '#1A1A1A'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#B9B4AA'; ctx.beginPath(); ctx.ellipse(o.x + o.w * 0.4, o.y + 7, 5, 2.5, -0.3, 0, TAU); ctx.fill();
      break;
    }
    case 'crab': {
      const step = Math.sin(t * 18 + o.seed) * 3, cx = o.x + o.w / 2;
      ctx.strokeStyle = '#B5301F'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (let i = -1; i <= 1; i += 2) for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.moveTo(cx + i * 6, GROUND - 7); ctx.lineTo(cx + i * (12 + j * 3) + (j % 2 ? step : -step) * 0.5, GROUND); ctx.stroke(); }
      shade(ctx, true); ctx.fillStyle = '#E2412B'; ctx.beginPath(); ctx.ellipse(cx, GROUND - 9, 12, 7, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(o.x + 1, GROUND - 14 + step * 0.3, 5, 0, TAU); ctx.arc(o.x + o.w - 1, GROUND - 14 - step * 0.3, 5, 0, TAU); ctx.fill(); shade(ctx, false);
      ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(cx - 4, GROUND - 18, 3, 0, TAU); ctx.arc(cx + 4, GROUND - 18, 3, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1A1A1A'; ctx.beginPath(); ctx.arc(cx - 5, GROUND - 18, 1.5, 0, TAU); ctx.arc(cx + 3, GROUND - 18, 1.5, 0, TAU); ctx.fill();
      break;
    }
    case 'high': case 'low': cloud(ctx, o, t); break;
    case 'heart': {
      if (!heart) break;
      const s = 0.75 + Math.sin(t * 6 + o.x * 0.05) * 0.06;
      ctx.save(); ctx.translate(o.x, o.y); ctx.scale(s, s);
      shade(ctx, true); ctx.fillStyle = '#E2412B'; ctx.fill(heart); shade(ctx, false);
      ctx.strokeStyle = '#1A1A1A'; ctx.lineWidth = 1.6; ctx.stroke(heart); ctx.restore();
      break;
    }
    case 'litter': {
      // a bottle or a can to pick up
      ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(Math.sin(t * 4 + o.seed) * 0.25);
      shade(ctx, true);
      if (WORLDS[o.world] === 'sea') { ctx.fillStyle = 'rgba(126,200,227,.9)'; ctx.fillRect(-4, -8, 8, 16); ctx.fillRect(-2, -12, 4, 4); ctx.fillStyle = '#2F6FD6'; ctx.fillRect(-2.5, -14, 5, 3); }
      else { ctx.fillStyle = '#D9DDE3'; ctx.fillRect(-5, -7, 10, 14); ctx.fillStyle = '#E2412B'; ctx.fillRect(-5, -3, 10, 6); }
      shade(ctx, false); ctx.strokeStyle = '#1A1A1A'; ctx.lineWidth = 1.2; ctx.strokeRect(-5, -8, 10, 16);
      ctx.restore();
      // a tiny green ring says "pick me up"
      ctx.strokeStyle = 'rgba(61,186,92,.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(o.x, o.y, 13 + Math.sin(t * 5) * 1.5, 0, TAU); ctx.stroke();
      break;
    }
    case 'power': {
      const by = o.y + Math.sin(t * 3 + o.seed) * 4;
      ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.strokeStyle = '#1A1A1A'; ctx.lineWidth = 1.6;
      shade(ctx, true); ctx.beginPath(); ctx.arc(o.x, by, 14, 0, TAU); ctx.fill(); shade(ctx, false); ctx.stroke();
      powerIcon(ctx, o.p!, o.x, by, 1);
      ctx.strokeStyle = 'rgba(255,200,74,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(o.x, by, 17 + Math.sin(t * 6) * 1.5, 0, TAU); ctx.stroke();
      break;
    }
  }
}

export function powerIcon(ctx: Ctx, p: string, x: number, y: number, s: number) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (p === 'umbrella') {
    ctx.fillStyle = '#2F6FD6'; ctx.beginPath(); ctx.arc(0, 1, 9, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#1A1A1A'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, 1); ctx.lineTo(0, 8); ctx.quadraticCurveTo(0, 10, -3, 9); ctx.stroke();
  } else if (p === 'magnet') {
    ctx.strokeStyle = '#E2412B'; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.arc(0, -1, 5.5, Math.PI, 0, true); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-5.5, -1); ctx.lineTo(-5.5, -7); ctx.moveTo(5.5, -1); ctx.lineTo(5.5, -7); ctx.stroke();
    ctx.strokeStyle = '#D9DDE3'; ctx.beginPath(); ctx.moveTo(-5.5, -6); ctx.lineTo(-5.5, -8); ctx.moveTo(5.5, -6); ctx.lineTo(5.5, -8); ctx.stroke();
  } else {
    ctx.strokeStyle = '#2F8E45'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 9); ctx.lineTo(0, -1); ctx.stroke();
    ctx.fillStyle = '#4CAF5B'; ctx.beginPath(); ctx.ellipse(-4.5, -3, 5, 3, -0.6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2F8E45'; ctx.beginPath(); ctx.ellipse(4.5, -5, 5, 3, 0.6, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---------- Mylo ----------
export type Pose = { t: number; run: boolean; ground: boolean; up: boolean; roll: boolean; hit: boolean; blink: boolean; landed: boolean; outfit: Outfit; glow?: boolean };

function outfitBack(ctx: Ctx, o: Outfit, p: Pose) {
  if (o === 'cape') {
    const wave = Math.sin(p.t * 14) * 8;
    ctx.fillStyle = '#7B4FC9'; ctx.beginPath(); ctx.moveTo(70, 112); ctx.quadraticCurveTo(10, 140 + wave, 4, 196 + wave); ctx.lineTo(54, 186); ctx.quadraticCurveTo(66, 150, 96, 128); ctx.closePath(); ctx.fill();
  }
  if (o === 'scarf') {
    const wave = Math.sin(p.t * 16) * 6;
    ctx.fillStyle = '#C8322A'; ctx.beginPath(); ctx.moveTo(62, 176); ctx.quadraticCurveTo(30, 178 + wave, 14, 190 + wave); ctx.lineTo(20, 200 + wave); ctx.quadraticCurveTo(40, 188, 64, 188); ctx.closePath(); ctx.fill();
  }
}
function outfitFront(ctx: Ctx, o: Outfit) {
  ctx.lineWidth = 5; ctx.strokeStyle = '#1A1A1A';
  switch (o) {
    case 'cap':
      ctx.fillStyle = '#2F6FD6'; ctx.beginPath(); ctx.arc(100, 104, 36, Math.PI * 1.05, Math.PI * 1.95); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.ellipse(132, 101, 26, 7, 0.08, 0, TAU); ctx.fill();
      ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(100, 70, 6, 0, TAU); ctx.fill();
      break;
    case 'scarf':
      ctx.fillStyle = '#E2412B'; ctx.beginPath(); ctx.moveTo(58, 172); ctx.quadraticCurveTo(100, 196, 142, 172); ctx.lineTo(140, 186); ctx.quadraticCurveTo(100, 208, 60, 186); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#FFFFFF'; for (const x of [76, 100, 124]) ctx.fillRect(x - 3, 182 + (x === 100 ? 6 : 1), 6, 5);
      break;
    case 'glasses':
      ctx.fillStyle = 'rgba(26,26,26,.82)';
      ctx.beginPath(); ctx.ellipse(88, 138, 17, 14, 0, 0, TAU); ctx.ellipse(120, 138, 17, 14, 0, 0, TAU); ctx.fill();
      ctx.fillRect(100, 134, 8, 4); ctx.fillRect(48, 132, 24, 4);
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(80, 130, 6, 3); ctx.fillRect(112, 130, 6, 3);
      break;
    case 'flowers':
      for (const [x, y, c] of [[70, 100, '#FF8CC6'], [100, 88, '#FFC84A'], [130, 100, '#FFFFFF']] as const) {
        ctx.fillStyle = c; for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 7, y + Math.sin(a) * 7, 6, 0, TAU); ctx.fill(); }
        ctx.fillStyle = '#E2412B'; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, TAU); ctx.fill();
      }
      break;
    case 'cape':
      ctx.fillStyle = '#5A35A0'; ctx.beginPath(); ctx.arc(100, 182, 7, 0, TAU); ctx.fill();
      break;
    case 'crown':
      ctx.fillStyle = '#FFC84A'; ctx.beginPath(); ctx.moveTo(66, 100); ctx.lineTo(70, 70); ctx.lineTo(84, 88); ctx.lineTo(100, 62); ctx.lineTo(116, 88); ctx.lineTo(130, 70); ctx.lineTo(134, 100); ctx.closePath(); ctx.fill();
      ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#E2412B'; ctx.beginPath(); ctx.arc(100, 90, 5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2F6FD6'; ctx.beginPath(); ctx.arc(80, 94, 3.5, 0, TAU); ctx.arc(120, 94, 3.5, 0, TAU); ctx.fill();
      break;
  }
}

// Draws Mylo in his own 200 x 240 drawing box. The caller places and scales it.
export function myloSprite(ctx: Ctx, p: Pose) {
  const pa = P();
  ctx.lineWidth = 6; ctx.strokeStyle = '#1A1A1A'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (p.roll) {
    // rolled up into a ball
    ctx.save(); ctx.translate(100, 172); ctx.rotate(p.t * 16);
    shade(ctx, true);
    ctx.fillStyle = '#FFF7EA'; ctx.beginPath(); ctx.arc(0, 0, 50, 0, TAU); ctx.fill();
    ctx.fillStyle = '#FF8A2A'; ctx.beginPath(); ctx.arc(0, 0, 46, 0, TAU); ctx.fill();
    shade(ctx, false);
    ctx.save(); ctx.translate(-100, -122); if (pa) { ctx.fillStyle = '#4CAF5B'; ctx.fill(pa.leafA); ctx.fillStyle = '#2F8E45'; ctx.fill(pa.leafB); } ctx.restore();
    ctx.strokeStyle = '#E86F12'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 30, 0.4, 2.2); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 30, 3.5, 5.2); ctx.stroke();
    ctx.restore();
    return;
  }
  shade(ctx, true);
  outfitBack(ctx, p.outfit, p);
  const a = p.run ? Math.sin(p.t * 18) * 0.65 : p.ground ? 0 : 0.45;
  for (const [hx, ang] of [[90, a], [110, p.ground ? -a : -0.25]] as const) {
    ctx.save(); ctx.translate(hx, 178); ctx.rotate(ang);
    ctx.fillStyle = '#F7EFE0'; ctx.fillRect(-5, 0, 10, 36); ctx.strokeRect(-5, 0, 10, 36);
    ctx.fillStyle = '#1A1A1A'; ctx.beginPath(); ctx.moveTo(-8, 46); ctx.lineTo(-8, 38); ctx.quadraticCurveTo(-8, 32, 0, 32); ctx.lineTo(8, 32); ctx.quadraticCurveTo(22, 32, 22, 46); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  const arm = p.run ? Math.sin(p.t * 18) * 0.5 : p.ground ? 0 : -0.9;
  ctx.fillStyle = '#FF8A2A';
  for (const [ax, base, s] of [[54, 0.26, 1], [146, -0.26, -1]] as const) {
    ctx.save(); ctx.translate(ax, 158); ctx.rotate(base + arm * s); ctx.beginPath(); ctx.ellipse(0, 12, 7, 17, 0, 0, TAU); ctx.fill(); ctx.restore();
  }
  ctx.fillStyle = p.glow ? '#FFE7A8' : '#FFF7EA'; ctx.beginPath(); ctx.arc(100, 140, 56, 0, TAU); ctx.fill();
  ctx.fillStyle = p.hit ? '#F2B27A' : '#FF8A2A'; ctx.beginPath(); ctx.arc(100, 140, 52, 0, TAU); ctx.fill();
  if (pa) { ctx.fillStyle = '#4CAF5B'; ctx.fill(pa.leafA); ctx.fillStyle = '#2F8E45'; ctx.fill(pa.leafB); }
  shade(ctx, false);
  ctx.fillStyle = '#FF8C8C'; ctx.beginPath(); ctx.arc(70, 160, 7, 0, TAU); ctx.arc(134, 160, 7, 0, TAU); ctx.fill();
  if (p.hit) {
    ctx.lineWidth = 6;
    for (const ex of [88, 118]) { ctx.beginPath(); ctx.moveTo(ex - 8, 128); ctx.lineTo(ex + 8, 144); ctx.moveTo(ex + 8, 128); ctx.lineTo(ex - 8, 144); ctx.stroke(); }
    ctx.fillStyle = '#1A1A1A'; ctx.beginPath(); ctx.ellipse(104, 166, 6, 8, 0, 0, TAU); ctx.fill();
  } else {
    ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.ellipse(88, 136, 14, 16, 0, 0, TAU); ctx.ellipse(118, 136, 14, 16, 0, 0, TAU); ctx.fill();
    const look = p.up ? -3 : 0;
    ctx.fillStyle = '#1A1A1A'; ctx.beginPath(); ctx.arc(93, 138 + look, 6.5, 0, TAU); ctx.arc(123, 138 + look, 6.5, 0, TAU); ctx.fill();
    if (p.blink) { ctx.fillStyle = '#FF8A2A'; ctx.fillRect(72, 118, 62, 36); ctx.fillStyle = '#1A1A1A'; ctx.fillRect(72, 134, 62, 5); }
    ctx.lineWidth = 5;
    if (p.ground) { ctx.beginPath(); ctx.moveTo(94, 160); ctx.quadraticCurveTo(104, 170, 114, 160); ctx.stroke(); }
    else { ctx.fillStyle = '#1A1A1A'; ctx.beginPath(); ctx.ellipse(104, 164, 6, 7, 0, 0, TAU); ctx.fill(); }
  }
  outfitFront(ctx, p.outfit);
}

function drawMylo(ctx: Ctx, g: Game, outfit: Outfit) {
  const feet = GROUND + g.y, hit = g.phase === 'over', run = g.phase === 'run' && g.ground;
  const s = scaleOf(g), roll = rolling(g) && !hit;
  const lift = Math.min(1, -g.y / 130);
  ctx.fillStyle = `rgba(0,0,0,${0.18 - lift * 0.1})`;
  ctx.beginPath(); ctx.ellipse(MX + 25 * s, GROUND + 2, (16 - lift * 6) * s, 3.5, 0, 0, TAU); ctx.fill();
  // umbrella above Mylo while the shield is on
  if (g.shield && !hit) {
    ctx.save(); ctx.translate(MX + 25 * s, feet - (roll ? 34 : 62) * s);
    shade(ctx, true); ctx.fillStyle = '#2F6FD6'; ctx.beginPath(); ctx.arc(0, 0, 22 * s, Math.PI, 0); ctx.closePath(); ctx.fill(); shade(ctx, false);
    ctx.strokeStyle = '#1A1A1A'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#7EC8E3'; ctx.beginPath(); ctx.arc(0, 0, 22 * s, Math.PI * 1.35, Math.PI * 1.65); ctx.lineTo(0, 0); ctx.fill();
    ctx.restore();
  }
  if (g.magnet > 0 && !hit) {
    ctx.strokeStyle = `rgba(226,65,43,${0.25 + 0.2 * Math.sin(g.t * 10)})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(MX + 25 * s, feet - 26 * s, 30 + Math.sin(g.t * 10) * 3, 0, TAU); ctx.stroke();
  }
  // blink while protected after a hit
  if (g.invuln > 0 && !hit && Math.floor(g.t * 12) % 2) return;
  ctx.save();
  const bob = run && !roll ? Math.abs(Math.sin(g.t * 16)) * -2.5 : 0;
  ctx.translate(MX, feet - 56 * s + bob);
  if (g.landed > 0 && !roll) { ctx.translate(25 * s, 56 * s); ctx.scale(1.08, 0.92); ctx.translate(-25 * s, -56 * s); }
  if (hit) { ctx.translate(25, 35); ctx.rotate(-0.25); ctx.translate(-25, -35); }
  ctx.scale(0.25 * s, 0.25 * s);
  myloSprite(ctx, { t: g.t, run, ground: g.ground, up: !g.ground, roll, hit, blink: g.blink < 0, landed: g.landed > 0, outfit, glow: g.big > 0 });
  ctx.restore();
}

// ---------- the whole frame ----------
export function drawFrame(ctx: Ctx, g: Game, v: { W: number; scale: number; dpr: number }, L: Labels, outfit: Outfit, best: number) {
  const { W, scale, dpr } = v;
  unit = dpr * scale;
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
  shade(ctx, false);
  const pa = P();
  backdrop(ctx, g.prevWorld === g.world || g.worldFade <= 0 ? g.world : g.prevWorld, g.dist, g.t, W);
  if (g.worldFade > 0 && g.prevWorld !== g.world) { ctx.globalAlpha = 1 - g.worldFade; backdrop(ctx, g.world, g.dist, g.t, W); ctx.globalAlpha = 1; }
  for (const o of g.things) thing(ctx, o, g.t, pa?.heart);
  drawMylo(ctx, g, outfit);
  for (const b of g.bits) {
    ctx.globalAlpha = Math.max(0, 1 - b.life / b.max);
    if (b.text) { ctx.fillStyle = b.c; ctx.font = `800 ${b.size ?? 13}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.fillText(b.text, b.x, b.y); }
    else { ctx.fillStyle = b.c; ctx.fillRect(b.x - b.r / 2, b.y - b.r / 2, b.r, b.r); }
  }
  ctx.globalAlpha = 1;

  // score and best
  const th = THEMES[g.world];
  ctx.textAlign = 'right'; ctx.textBaseline = 'top';
  ctx.fillStyle = th.ink; ctx.font = '800 17px ui-monospace, Menlo, Consolas, monospace';
  ctx.fillText(String(g.score).padStart(5, '0'), W - 12, 10);
  if (best > 0) { ctx.fillStyle = th.soft; ctx.font = '700 11px ui-monospace, Menlo, Consolas, monospace'; ctx.fillText(`${L.best.toUpperCase()} ${String(best).padStart(5, '0')}`, W - 12, 30); }
  // hearts and combo
  if (pa) { ctx.save(); ctx.translate(20, 20); ctx.scale(0.55, 0.55); ctx.fillStyle = '#E2412B'; ctx.fill(pa.heart); ctx.restore(); }
  ctx.textAlign = 'left'; ctx.fillStyle = th.ink; ctx.font = '800 15px system-ui, sans-serif'; ctx.fillText(String(g.hearts), 31, 12);
  if (g.combo > 1) { ctx.fillStyle = '#E2412B'; ctx.font = '900 13px system-ui, sans-serif'; ctx.fillText(`x${Math.min(g.combo, 5)}`, 31 + ctx.measureText(String(g.hearts)).width + 18, 13); }
  // power-ups in use
  let px = 20;
  const bar = (p: string, left: number, max: number) => {
    ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.arc(px, 46, 10, 0, TAU); ctx.fill();
    powerIcon(ctx, p, px, 46, 0.7);
    if (max > 0) { ctx.strokeStyle = '#1A1A1A'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, 46, 11, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0, left / max)); ctx.stroke(); }
    px += 26;
  };
  if (g.shield) bar('umbrella', 0, 0);
  if (g.magnet > 0) bar('magnet', g.magnet, 8);
  if (g.big > 0) bar('sprout', g.big, 5);
  if (L.daily) { ctx.textAlign = 'left'; ctx.fillStyle = th.soft; ctx.font = '700 11px system-ui, sans-serif'; ctx.fillText(L.daily, px - 8, 41); }

  ctx.textAlign = 'center';
  if (g.banner > 0) {
    ctx.globalAlpha = Math.min(1, g.banner * 2);
    const txt = L.worlds[g.world];
    ctx.font = '900 22px system-ui, sans-serif'; const tw = ctx.measureText(txt).width + 28;
    ctx.fillStyle = '#FFC84A'; ctx.strokeStyle = '#1A1A1A'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect?.(W / 2 - tw / 2, 54, tw, 34, 17); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1A1A1A'; ctx.fillText(txt, W / 2, 60);
    ctx.globalAlpha = 1;
  } else if (g.flash > 0) {
    ctx.globalAlpha = Math.min(1, g.flash * 2); ctx.fillStyle = g.world === 3 ? '#FFC84A' : '#B83A0B'; ctx.font = '900 26px system-ui, sans-serif';
    ctx.fillText(g.flashText + '!', W / 2, 64 - (1.1 - g.flash) * 12); ctx.globalAlpha = 1;
  }
  if (g.tipT > 0 && g.tip) {
    ctx.globalAlpha = Math.min(1, g.tipT * 2);
    const txt = L.tips[g.tip]; ctx.font = '800 14px system-ui, sans-serif';
    const tw = Math.min(W - 20, ctx.measureText(txt).width + 24);
    ctx.fillStyle = 'rgba(17,17,17,.85)'; ctx.beginPath(); ctx.roundRect?.(W / 2 - tw / 2, 96, tw, 26, 13); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; ctx.fillText(txt, W / 2, 102, W - 36); ctx.globalAlpha = 1;
  }
  if (g.toastT > 0 && g.toast) {
    ctx.globalAlpha = Math.min(1, g.toastT * 2);
    ctx.font = '800 13px system-ui, sans-serif';
    const tw = Math.min(W - 20, ctx.measureText(g.toast).width + 24);
    ctx.fillStyle = '#3DBA5C'; ctx.strokeStyle = '#1A1A1A'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect?.(W / 2 - tw / 2, H - 28, tw, 22, 11); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#111111'; ctx.fillText(g.toast, W / 2, H - 24, W - 36); ctx.globalAlpha = 1;
  }
  ctx.textBaseline = 'alphabetic';
}
