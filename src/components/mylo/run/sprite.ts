// Mylo himself, his outfits and the power-up icons, drawn in a 200 x 240 box. Paper-cut style: flat shapes with a small hard shadow.
import type { Outfit } from './progress';

type Ctx = CanvasRenderingContext2D;
export const TAU = Math.PI * 2;

let paths: Record<string, Path2D> | null = null;
export function P() {
  if (!paths && typeof Path2D !== 'undefined') paths = {
    leafA: new Path2D('M100 90 C86 68 94 56 102 54 C110 68 108 82 100 90 Z'),
    leafB: new Path2D('M100 90 C116 74 132 74 138 82 C128 92 112 94 100 90 Z'),
    heart: new Path2D('M0 -3 c-3 -7 -12 -5 -12 2 c0 6 7 10 12 15 c5 -5 12 -9 12 -15 c0 -7 -9 -9 -12 -2 Z'),
  };
  return paths;
}

// shadows are in device pixels, so the caller says how big one unit is
let unit = 1;
export const setUnit = (u: number) => { unit = u; };
export function shade(ctx: Ctx, on: boolean) {
  ctx.shadowColor = on ? 'rgba(0,0,0,.22)' : 'transparent';
  ctx.shadowOffsetX = on ? 1.5 * unit : 0; ctx.shadowOffsetY = on ? 2.5 * unit : 0; ctx.shadowBlur = 0;
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


// Mylo seen from behind, running into the screen. Same 200 x 240 box; feet at the bottom middle (100, 224).
export function myloBack(ctx: Ctx, p: { t: number; run: boolean; ground: boolean; outfit: Outfit; glow?: boolean }) {
  const pa = P(), o = p.outfit;
  ctx.lineWidth = 6; ctx.strokeStyle = '#1A1A1A'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const ph = p.run ? Math.sin(p.t * 17) : 0;
  shade(ctx, true);
  // legs: one lifts while the other pushes, soles towards us
  for (const [hx, k] of [[86, 1], [114, -1]] as const) {
    const lift = p.ground ? Math.max(0, ph * k) : 0.7;
    const len = 36 - lift * 16;
    ctx.fillStyle = '#F7EFE0'; ctx.fillRect(hx - 5, 180, 10, len); ctx.strokeRect(hx - 5, 180, 10, len);
    ctx.fillStyle = '#1A1A1A'; ctx.beginPath(); ctx.ellipse(hx, 182 + len, 11, 7 + lift * 3, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#5B5B5B'; ctx.beginPath(); ctx.ellipse(hx, 183 + len, 6, 3 + lift * 2, 0, 0, TAU); ctx.fill();
  }
  // arms swing forwards and back
  ctx.fillStyle = '#E8761E';
  for (const [ax, s] of [[46, 1], [154, -1]] as const) {
    ctx.save(); ctx.translate(ax, 150 + ph * s * 8); ctx.rotate(0.25 * s); ctx.beginPath(); ctx.ellipse(0, 10, 8, 17, 0, 0, TAU); ctx.fill(); ctx.restore();
  }
  if (o === 'cape') {
    const wave = Math.sin(p.t * 12) * 6;
    ctx.fillStyle = '#7B4FC9'; ctx.beginPath(); ctx.moveTo(62, 104); ctx.quadraticCurveTo(100, 92, 138, 104); ctx.lineTo(150 + wave, 206); ctx.quadraticCurveTo(100, 216 - wave, 50 - wave, 206); ctx.closePath(); ctx.fill();
  }
  // body
  ctx.fillStyle = p.glow ? '#FFE7A8' : '#FFF7EA'; ctx.beginPath(); ctx.arc(100, 140, 56, 0, TAU); ctx.fill();
  ctx.fillStyle = '#FF8A2A'; ctx.beginPath(); ctx.arc(100, 140, 52, 0, TAU); ctx.fill();
  shade(ctx, false);
  if (o === 'cape') {
    const wave = Math.sin(p.t * 12) * 6;
    ctx.fillStyle = '#7B4FC9'; ctx.beginPath(); ctx.moveTo(66, 108); ctx.quadraticCurveTo(100, 98, 134, 108); ctx.lineTo(144 + wave, 204); ctx.quadraticCurveTo(100, 212 - wave, 56 - wave, 204); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5A35A0'; ctx.fillRect(66, 104, 68, 8);
  } else {
    // a little shine and the round dimple at the back of the orange
    ctx.fillStyle = '#FFA757'; ctx.beginPath(); ctx.ellipse(80, 118, 16, 10, -0.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#E8761E'; ctx.beginPath(); ctx.arc(100, 150, 3, 0, TAU); ctx.arc(110, 158, 2, 0, TAU); ctx.arc(90, 160, 2, 0, TAU); ctx.fill();
  }
  if (pa) { ctx.fillStyle = '#4CAF5B'; ctx.fill(pa.leafA); ctx.fillStyle = '#2F8E45'; ctx.fill(pa.leafB); }
  ctx.lineWidth = 5;
  switch (o) {
    case 'cap':
      ctx.fillStyle = '#2F6FD6'; ctx.beginPath(); ctx.arc(100, 106, 36, Math.PI * 1.05, Math.PI * 1.95); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#FF8A2A'; ctx.beginPath(); ctx.arc(100, 102, 7, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#1F4FA6'; ctx.fillRect(92, 100, 16, 3);
      break;
    case 'scarf': {
      const wave = Math.sin(p.t * 14) * 7;
      ctx.fillStyle = '#E2412B'; ctx.beginPath(); ctx.moveTo(56, 168); ctx.quadraticCurveTo(100, 186, 144, 168); ctx.lineTo(144, 182); ctx.quadraticCurveTo(100, 200, 56, 182); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(108, 184); ctx.quadraticCurveTo(118 + wave, 205, 112 + wave, 226); ctx.lineTo(126 + wave, 224); ctx.quadraticCurveTo(128 + wave, 202, 122, 182); ctx.closePath(); ctx.fill();
      break;
    }
    case 'glasses':
      ctx.fillStyle = '#1A1A1A'; ctx.fillRect(44, 132, 14, 4); ctx.fillRect(142, 132, 14, 4);
      break;
    case 'flowers':
      for (const [x, y, c] of [[66, 104, '#FF8CC6'], [100, 92, '#FFC84A'], [134, 104, '#FFFFFF']] as const) {
        ctx.fillStyle = c; for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 7, y + Math.sin(a) * 7, 6, 0, TAU); ctx.fill(); }
        ctx.fillStyle = '#E2412B'; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, TAU); ctx.fill();
      }
      break;
    case 'crown':
      ctx.fillStyle = '#FFC84A'; ctx.beginPath(); ctx.moveTo(66, 102); ctx.lineTo(70, 72); ctx.lineTo(84, 90); ctx.lineTo(100, 64); ctx.lineTo(116, 90); ctx.lineTo(130, 72); ctx.lineTo(134, 102); ctx.closePath(); ctx.fill();
      ctx.lineWidth = 3; ctx.stroke();
      break;
  }
}
