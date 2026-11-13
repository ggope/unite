'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/i18n/client';

// "Mylo's Run": a small endless runner for bored moments. Mylo hops over thorns, stays low under
// gloomy clouds and catches hearts. Everything runs in the browser; the best score stays on this
// device (localStorage `mylo-run-best`). The world is 240 units tall and as wide as the screen allows.

type Phase = 'ready' | 'run' | 'pause' | 'over';
type Thorn = { k: 'thorn'; x: number; w: number; h: number; spikes: number[] };
type Cloud = { k: 'cloud'; x: number; w: number; y: number; seed: number };
type Heart = { k: 'heart'; x: number; y: number; got: boolean };
type Thing = Thorn | Cloud | Heart;
type Bit = { x: number; y: number; vx: number; vy: number; life: number; max: number; c: string; r: number; text?: string };

const H = 240, GROUND = 206, MX = 52;
const GRAV = 2300, JUMP = 770, CUT = 300, DROP = 1100;
const BEST_KEY = 'mylo-run-best';

const P = (d: string) => (typeof Path2D === 'undefined' ? null : new Path2D(d));
const LEAF_A = 'M100 90 C86 68 94 56 102 54 C110 68 108 82 100 90 Z';
const LEAF_B = 'M100 90 C116 74 132 74 138 82 C128 92 112 94 100 90 Z';
const HEART = 'M0 -3 c-3 -7 -12 -5 -12 2 c0 6 7 10 12 15 c5 -5 12 -9 12 -15 c0 -7 -9 -9 -12 -2 Z';

const readBest = () => { try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; } };
const saveBest = (n: number) => { try { localStorage.setItem(BEST_KEY, String(n)); } catch {} };
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function freshWorld() {
  return {
    phase: 'ready' as Phase, t: 0, dist: 0, speed: 280, hearts: 0, score: 0,
    y: 0, vy: 0, air: 0, ground: true, holding: false, buffered: -1, coyote: 0, landed: 0,
    things: [] as Thing[], bits: [] as Bit[], sinceSpawn: 0, gap: 420, heartIn: 1.4, dust: 0,
    blink: 2, flash: 0, flashText: '', hitAt: 0, nextMilestone: 100,
  };
}
type World = ReturnType<typeof freshWorld>;

export function MyloRun({ signHref, signTitle }: { signHref: string; signTitle?: string }) {
  const { t } = useT();
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const w = useRef<World>(freshWorld());
  const view = useRef({ W: 400, scale: 1, dpr: 1 });
  const [phase, setPhaseState] = useState<Phase>('ready');
  const [best, setBest] = useState(0);
  const [result, setResult] = useState({ score: 0, hearts: 0, newBest: false });
  const [live, setLive] = useState('');
  const bestRef = useRef(0);
  const paths = useRef<{ leafA: Path2D | null; leafB: Path2D | null; heart: Path2D | null } | null>(null);

  const setPhase = useCallback((p: Phase) => { w.current.phase = p; setPhaseState(p); }, []);

  useEffect(() => { bestRef.current = readBest(); setBest(bestRef.current); }, []);

  const start = useCallback(() => {
    const keep = w.current;
    w.current = freshWorld();
    w.current.blink = keep.blink;
    setPhase('run'); setLive('');
    wrap.current?.focus({ preventScroll: true });
  }, [setPhase]);

  const pause = useCallback(() => { if (w.current.phase === 'run') setPhase('pause'); }, [setPhase]);
  const resume = useCallback(() => { if (w.current.phase === 'pause') { setPhase('run'); wrap.current?.focus({ preventScroll: true }); } }, [setPhase]);

  const press = useCallback(() => {
    const g = w.current;
    if (g.phase === 'ready') { start(); g.buffered = 0.12; return; }
    if (g.phase === 'over') { if (performance.now() - g.hitAt > 650) start(); return; }
    if (g.phase === 'pause') { resume(); return; }
    g.holding = true;
    g.buffered = 0.12;   // a press just before landing still counts
  }, [start, resume]);
  const release = useCallback(() => { w.current.holding = false; }, []);
  const drop = useCallback(() => { const g = w.current; if (g.phase === 'run' && !g.ground) g.vy = Math.max(g.vy, DROP); }, []);

  // keyboard: Space / Up / W jump, Down / S drop, P or Escape pause
  useEffect(() => {
    const typing = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el) return false;
      if (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return true;
      // let Space/Enter press a focused button or link when the game is not running
      return w.current.phase !== 'run' && /^(BUTTON|A)$/.test(el.tagName);
    };
    const down = (e: KeyboardEvent) => {
      if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key, phase = w.current.phase;
      const onStage = document.activeElement === wrap.current;
      if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W' || (k === 'Enter' && onStage && phase !== 'run')) {
        e.preventDefault(); if (!e.repeat) press();
      } else if (k === 'ArrowDown' || k === 's' || k === 'S') {
        if (w.current.phase === 'run') { e.preventDefault(); drop(); }
      } else if (k === 'p' || k === 'P' || k === 'Escape') {
        if (w.current.phase === 'run') { e.preventDefault(); pause(); } else if (w.current.phase === 'pause' && k !== 'Escape') resume();
      }
    };
    const up = (e: KeyboardEvent) => { if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') release(); };
    const hide = () => { if (document.hidden) pause(); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', hide);
    return () => {
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up);
      window.removeEventListener('blur', pause); document.removeEventListener('visibilitychange', hide);
    };
  }, [press, release, drop, pause, resume]);

  // size the canvas to its box, sharp on high-density phone screens
  useEffect(() => {
    const box = wrap.current, c = canvas.current;
    if (!box || !c) return;
    const fit = () => {
      const cssW = box.clientWidth;
      const cssH = Math.round(Math.max(210, Math.min(300, cssW * 0.5, window.innerHeight * 0.55)));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.style.height = cssH + 'px';
      c.width = Math.round(cssW * dpr); c.height = Math.round(cssH * dpr);
      const scale = cssH / H;
      view.current = { W: cssW / scale, scale, dpr };
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(box);
    window.addEventListener('resize', fit);
    return () => { ro.disconnect(); window.removeEventListener('resize', fit); };
  }, []);

  // the game loop
  useEffect(() => {
    const c = canvas.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    paths.current = { leafA: P(LEAF_A), leafB: P(LEAF_B), heart: P(HEART) };
    let raf = 0, last = performance.now();

    const burst = (x: number, y: number, n: number, colors: string[]) => {
      const g = w.current;
      for (let i = 0; i < n; i++) g.bits.push({ x, y, vx: rnd(-140, 140), vy: rnd(-260, -60), life: 0, max: rnd(0.4, 0.8), c: colors[i % colors.length], r: rnd(2, 4) });
    };

    const gameOver = () => {
      const g = w.current;
      g.hitAt = performance.now();
      g.vy = -380; g.ground = false;
      const score = g.score, isBest = score > bestRef.current;
      if (isBest) { bestRef.current = score; saveBest(score); setBest(score); }
      setResult({ score, hearts: g.hearts, newBest: isBest });
      setLive(t('game.result', { n: score, best: bestRef.current }));
      if (navigator.vibrate) try { navigator.vibrate(60); } catch {}
      setPhase('over');
    };

    const spawn = () => {
      const g = w.current, { W } = view.current, x = W + 30;
      const clouds = g.t > 18;
      if (clouds && Math.random() < 0.28) {
        // a gloomy cloud at head height: stay on the ground and it passes over Mylo
        g.things.push({ k: 'cloud', x, w: rnd(60, 80), y: GROUND - 92, seed: Math.random() * 6 });
      } else {
        const n = Math.random() < Math.min(0.5, g.t / 60) ? (Math.random() < 0.35 ? 3 : 2) : 1;
        const sw = rnd(15, 19), h = rnd(22, 34) + (n > 1 ? 0 : 4);
        const spikes = Array.from({ length: n * 2 }, () => rnd(0.75, 1));
        g.things.push({ k: 'thorn', x, w: sw * n, h, spikes });
        if (Math.random() < 0.45) g.things.push({ k: 'heart', x: x + (sw * n) / 2, y: GROUND - h - 60, got: false });
      }
      const air = (2 * JUMP) / GRAV;   // seconds in the air on a full jump
      const min = g.speed * air * 0.95 + 110;
      g.gap = rnd(min, min * 2.1);
    };

    const step = (dt: number) => {
      const g = w.current, { W } = view.current;
      g.blink -= dt; if (g.blink < -0.12) g.blink = rnd(2, 5);
      if (g.flash > 0) g.flash -= dt;
      // bits keep moving even after a crash
      for (const b of g.bits) { b.life += dt; b.x += b.vx * dt; b.y += b.vy * dt; if (!b.text) b.vy += 900 * dt; }
      g.bits = g.bits.filter((b) => b.life < b.max);

      if (g.phase === 'over') {
        if (!g.ground) { g.vy += GRAV * dt; g.y += g.vy * dt; if (g.y >= 0) { g.y = 0; g.vy = 0; g.ground = true; } }
        return;
      }
      if (g.phase !== 'run') return;

      g.t += dt;
      g.speed = Math.min(640, 280 + g.t * 7.5);
      const dx = g.speed * dt;
      g.dist += dx;

      // jumping (y is height above the ground, up is negative)
      if (g.buffered > 0) g.buffered -= dt;
      if (g.ground) g.coyote = 0.08; else g.coyote -= dt;
      if (g.buffered > 0 && g.coyote > 0 && g.vy >= 0) {
        g.vy = -JUMP; g.ground = false; g.buffered = -1; g.coyote = 0; g.air = 0;
      }
      if (!g.ground) {
        g.air += dt;
        // letting go early gives a smaller hop, but even a quick tap clears a thorn
        if (!g.holding && g.air > 0.07 && g.vy < -CUT) g.vy = -CUT;
        g.vy += GRAV * dt; g.y += g.vy * dt;
        if (g.y >= 0) { g.y = 0; g.vy = 0; g.ground = true; g.landed = 0.12; burst(MX + 25, GROUND, 4, ['#C9B48A', '#A8936A']); }
      }
      if (g.landed > 0) g.landed -= dt;

      // dust behind the feet
      g.dust -= dt;
      if (g.ground && g.dust <= 0) { g.dust = 0.09; g.bits.push({ x: MX + 14, y: GROUND - 2, vx: -g.speed * 0.4, vy: rnd(-60, -20), life: 0, max: 0.35, c: '#CDB78E', r: rnd(1.5, 3) }); }

      // spawning
      g.sinceSpawn += dx;
      if (g.sinceSpawn >= g.gap) { g.sinceSpawn = 0; spawn(); }
      g.heartIn -= dt;
      if (g.heartIn <= 0) {
        g.heartIn = rnd(1.1, 2.4);
        const x = W + 30;
        const near = g.things.some((o) => o.k === 'cloud' && Math.abs(o.x - x) < 120);
        if (!near) g.things.push({ k: 'heart', x, y: GROUND - rnd(28, 135), got: false });
      }

      // move and test
      const feet = GROUND + g.y;
      const cx = MX + 25, cy = feet - 23, r = 13;   // Mylo's round body
      const legs = { x: MX + 18, y: feet - 12, w: 14, h: 12 };
      const hitRect = (x: number, y: number, rw: number, rh: number) => {
        const nx = Math.max(x, Math.min(cx, x + rw)), ny = Math.max(y, Math.min(cy, y + rh));
        const circle = (nx - cx) ** 2 + (ny - cy) ** 2 < r * r;
        const box = legs.x < x + rw && legs.x + legs.w > x && legs.y < y + rh && legs.y + legs.h > y;
        return circle || box;
      };
      for (const o of g.things) {
        o.x -= dx;
        if (o.k === 'thorn') {
          // the spikes are triangles; a slightly smaller box keeps near misses fair
          if (hitRect(o.x + 4, GROUND - o.h + 6, o.w - 8, o.h - 6)) return gameOver();
        } else if (o.k === 'cloud') {
          const bob = Math.sin(g.t * 3 + o.seed) * 3;
          if (hitRect(o.x + 8, o.y - 28 + bob, o.w - 16, 42)) return gameOver();
        } else if (!o.got) {
          if ((o.x - cx) ** 2 + (o.y - cy) ** 2 < (r + 11) ** 2) {
            o.got = true; g.hearts++;
            burst(o.x, o.y, 6, ['#E2412B', '#FF8C8C', '#FFC84A']);
            g.bits.push({ x: o.x, y: o.y - 8, vx: 0, vy: -50, life: 0, max: 0.7, c: '#B83A0B', r: 0, text: '+5' });
          }
        }
      }
      g.things = g.things.filter((o) => o.x > -100 && !(o.k === 'heart' && o.got));
      g.score = Math.floor(g.dist / 14) + g.hearts * 5;
      if (g.score >= g.nextMilestone) {
        g.flash = 1.1; g.flashText = String(g.nextMilestone); g.nextMilestone += 100;
        burst(cx, cy - 20, 8, ['#2F6FD6', '#E2412B', '#FFC84A', '#3DBA5C']);
      }
    };

    // ---------- drawing ----------
    const shade = (on: boolean) => {
      const { dpr, scale } = view.current;
      ctx.shadowColor = on ? 'rgba(0,0,0,.22)' : 'transparent';
      ctx.shadowOffsetX = on ? 1.5 * dpr * scale : 0; ctx.shadowOffsetY = on ? 2.5 * dpr * scale : 0; ctx.shadowBlur = 0;
    };
    const hills = (off: number, base: number, amp: number, k: number, color: string, W: number) => {
      ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W + 8; x += 8) {
        const u = x + off;
        ctx.lineTo(x, base - amp * (0.55 + 0.3 * Math.sin(u * k) + 0.15 * Math.sin(u * k * 2.7 + 1)));
      }
      ctx.lineTo(W + 8, H); ctx.closePath(); ctx.fill();
    };
    const puff = (x: number, y: number, s: number, fill: string) => {
      ctx.fillStyle = fill; ctx.beginPath();
      ctx.arc(x, y, 10 * s, 0, Math.PI * 2); ctx.arc(x + 12 * s, y - 6 * s, 13 * s, 0, Math.PI * 2);
      ctx.arc(x + 26 * s, y, 10 * s, 0, Math.PI * 2); ctx.rect(x, y - 2 * s, 26 * s, 12 * s); ctx.fill();
    };

    const drawMylo = (g: World) => {
      const pa = paths.current!;
      const feet = GROUND + g.y, hit = g.phase === 'over';
      const run = g.phase === 'run' && g.ground;
      // shadow on the ground, smaller when high up
      const lift = Math.min(1, -g.y / 130);
      ctx.fillStyle = `rgba(0,0,0,${0.18 - lift * 0.1})`;
      ctx.beginPath(); ctx.ellipse(MX + 25, GROUND + 2, 16 - lift * 6, 3.5, 0, 0, Math.PI * 2); ctx.fill();

      ctx.save();
      const bob = run ? Math.abs(Math.sin(g.t * 16)) * -2.5 : 0;
      ctx.translate(MX, feet - 56 + bob);
      if (g.landed > 0) { ctx.translate(25, 56); ctx.scale(1.08, 0.92); ctx.translate(-25, -56); }
      if (hit) { ctx.translate(25, 35); ctx.rotate(-0.25); ctx.translate(-25, -35); }
      ctx.scale(0.25, 0.25);
      ctx.lineWidth = 6; ctx.strokeStyle = '#1A1A1A'; ctx.lineJoin = 'round';
      shade(true);
      // legs and shoes
      const a = run ? Math.sin(g.t * 18) * 0.65 : g.ground ? 0 : 0.45;
      for (const [hx, ang] of [[90, a], [110, g.ground ? -a : -0.25]] as const) {
        ctx.save(); ctx.translate(hx, 178); ctx.rotate(ang);
        ctx.fillStyle = '#F7EFE0'; ctx.fillRect(-5, 0, 10, 36); ctx.strokeRect(-5, 0, 10, 36);
        ctx.fillStyle = '#1A1A1A'; ctx.beginPath(); ctx.moveTo(-8, 46); ctx.lineTo(-8, 38); ctx.quadraticCurveTo(-8, 32, 0, 32); ctx.lineTo(8, 32); ctx.quadraticCurveTo(22, 32, 22, 46); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      // arms swing opposite to the legs
      const arm = run ? Math.sin(g.t * 18) * 0.5 : g.ground ? 0 : -0.9;
      ctx.fillStyle = '#FF8A2A';
      for (const [ax, base, s] of [[54, 0.26, 1], [146, -0.26, -1]] as const) {
        ctx.save(); ctx.translate(ax, 158); ctx.rotate(base + arm * s); ctx.beginPath(); ctx.ellipse(0, 12, 7, 17, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      // body
      ctx.fillStyle = '#FFF7EA'; ctx.beginPath(); ctx.arc(100, 140, 56, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = hit ? '#F2B27A' : '#FF8A2A'; ctx.beginPath(); ctx.arc(100, 140, 52, 0, Math.PI * 2); ctx.fill();
      if (pa.leafA && pa.leafB) { ctx.fillStyle = '#4CAF5B'; ctx.fill(pa.leafA); ctx.fillStyle = '#2F8E45'; ctx.fill(pa.leafB); }
      shade(false);
      // face, looking ahead
      ctx.fillStyle = '#FF8C8C';
      ctx.beginPath(); ctx.arc(70, 160, 7, 0, Math.PI * 2); ctx.arc(134, 160, 7, 0, Math.PI * 2); ctx.fill();
      if (hit) {
        ctx.lineWidth = 6; ctx.lineCap = 'round';
        for (const ex of [88, 118]) { ctx.beginPath(); ctx.moveTo(ex - 8, 128); ctx.lineTo(ex + 8, 144); ctx.moveTo(ex + 8, 128); ctx.lineTo(ex - 8, 144); ctx.stroke(); }
        ctx.fillStyle = '#1A1A1A'; ctx.beginPath(); ctx.ellipse(104, 166, 6, 8, 0, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.ellipse(88, 136, 14, 16, 0, 0, Math.PI * 2); ctx.ellipse(118, 136, 14, 16, 0, 0, Math.PI * 2); ctx.fill();
        const look = g.ground ? 0 : -3;
        ctx.fillStyle = '#1A1A1A'; ctx.beginPath(); ctx.arc(93, 138 + look, 6.5, 0, Math.PI * 2); ctx.arc(123, 138 + look, 6.5, 0, Math.PI * 2); ctx.fill();
        if (g.blink < 0) { ctx.fillStyle = '#FF8A2A'; ctx.fillRect(72, 118, 62, 36); ctx.fillStyle = '#1A1A1A'; ctx.fillRect(72, 134, 62, 5); }
        ctx.lineWidth = 5; ctx.lineCap = 'round';
        if (g.ground) { ctx.beginPath(); ctx.moveTo(94, 160); ctx.quadraticCurveTo(104, 170, 114, 160); ctx.stroke(); }
        else { ctx.fillStyle = '#1A1A1A'; ctx.beginPath(); ctx.ellipse(104, 164, 6, 7, 0, 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.restore();
    };

    const draw = () => {
      const g = w.current, { W, scale, dpr } = view.current;
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
      shade(false);
      // sky and sun
      const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
      sky.addColorStop(0, '#FFF6E6'); sky.addColorStop(1, '#FCE2C2');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#FFC84A'; ctx.beginPath(); ctx.arc(W - 70, 46, 20, 0, Math.PI * 2); ctx.fill();
      // paper clouds and hills, slower further away
      const d = g.dist;
      for (let i = 0; i < 3; i++) {
        const span = W + 160, x = ((i * span) / 3 - d * 0.08) % span;
        puff((x < -80 ? x + span : x) - 40, 40 + i * 18, 0.9 + (i % 2) * 0.3, '#FFFFFF');
      }
      hills(d * 0.15, GROUND - 18, 46, 0.012, '#D7E6B8', W);
      hills(d * 0.4 + 300, GROUND - 4, 30, 0.021, '#B5D592', W);
      // ground
      ctx.fillStyle = '#E8D2A6'; ctx.fillRect(0, GROUND, W, H - GROUND);
      ctx.fillStyle = '#1A1A1A'; ctx.fillRect(0, GROUND - 1, W, 2);
      ctx.fillStyle = '#C9B48A';
      for (let x = -(d % 46); x < W; x += 46) { ctx.fillRect(x, GROUND + 9, 10, 2); ctx.fillRect(x + 23, GROUND + 20, 6, 2); }

      // things
      for (const o of g.things) {
        if (o.k === 'thorn') {
          shade(true);
          ctx.fillStyle = '#2E6B35'; ctx.strokeStyle = '#1A1A1A'; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
          ctx.beginPath(); ctx.moveTo(o.x, GROUND);
          const n = o.spikes.length, sw = o.w / n;
          o.spikes.forEach((s, i) => { ctx.lineTo(o.x + i * sw + sw / 2, GROUND - o.h * s); ctx.lineTo(o.x + (i + 1) * sw, GROUND - (i < n - 1 ? o.h * 0.35 : 0)); });
          ctx.closePath(); ctx.fill(); shade(false); ctx.stroke();
          ctx.fillStyle = '#4C9A50';
          o.spikes.forEach((s, i) => { const px = o.x + i * sw + sw / 2; ctx.beginPath(); ctx.moveTo(px - 2, GROUND - o.h * s * 0.5); ctx.lineTo(px - 7, GROUND - o.h * s * 0.62); ctx.lineTo(px - 1, GROUND - o.h * s * 0.42); ctx.fill(); });
        } else if (o.k === 'cloud') {
          const bob = Math.sin(g.t * 3 + o.seed) * 3, y = o.y + bob, s = o.w / 40;
          shade(true); puff(o.x + 4, y, s * 0.95, '#8D909B'); shade(false);
          puff(o.x + 4, y + 4, s * 0.8, '#767985');
          // grumpy face
          ctx.strokeStyle = '#2B2D33'; ctx.lineWidth = 2; ctx.lineCap = 'round';
          const fx = o.x + o.w / 2;
          ctx.beginPath(); ctx.moveTo(fx - 12, y - 6); ctx.lineTo(fx - 5, y - 3); ctx.moveTo(fx + 12, y - 6); ctx.lineTo(fx + 5, y - 3);
          ctx.moveTo(fx - 6, y + 6); ctx.quadraticCurveTo(fx, y + 1, fx + 6, y + 6); ctx.stroke();
          // a few rain drops that drift behind it
          ctx.fillStyle = '#5E7FB5';
          for (let k = 0; k < 3; k++) { const ry = ((g.t * 90 + k * 13 + o.seed * 10) % 16); ctx.fillRect(o.x + 14 + k * (o.w - 28) / 2, y + 10 + ry, 1.6, 5); }
        } else {
          const p = paths.current!.heart; if (!p) continue;
          const s = 0.75 + Math.sin(g.t * 6 + o.x * 0.05) * 0.06;
          ctx.save(); ctx.translate(o.x, o.y); ctx.scale(s, s);
          shade(true); ctx.fillStyle = '#E2412B'; ctx.fill(p); shade(false);
          ctx.strokeStyle = '#1A1A1A'; ctx.lineWidth = 1.6; ctx.stroke(p);
          ctx.restore();
        }
      }
      drawMylo(g);
      // bits
      for (const b of g.bits) {
        const fade = 1 - b.life / b.max; ctx.globalAlpha = Math.max(0, fade);
        if (b.text) { ctx.fillStyle = b.c; ctx.font = '800 13px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(b.text, b.x, b.y); }
        else { ctx.fillStyle = b.c; ctx.fillRect(b.x - b.r / 2, b.y - b.r / 2, b.r, b.r); }
      }
      ctx.globalAlpha = 1;

      // score
      ctx.textAlign = 'right'; ctx.textBaseline = 'top';
      ctx.fillStyle = '#1A1A1A'; ctx.font = '800 17px ui-monospace, Menlo, Consolas, monospace';
      ctx.fillText(String(g.score).padStart(5, '0'), W - 12, 10);
      if (bestRef.current > 0) { ctx.fillStyle = '#6B6457'; ctx.font = '700 11px ui-monospace, Menlo, Consolas, monospace'; ctx.fillText(`${t('game.best').toUpperCase()} ${String(bestRef.current).padStart(5, '0')}`, W - 12, 30); }
      // hearts caught
      const hp = paths.current!.heart;
      if (hp) { ctx.save(); ctx.translate(20, 20); ctx.scale(0.55, 0.55); ctx.fillStyle = '#E2412B'; ctx.fill(hp); ctx.restore(); }
      ctx.textAlign = 'left'; ctx.fillStyle = '#1A1A1A'; ctx.font = '800 15px system-ui, sans-serif'; ctx.fillText(String(g.hearts), 31, 12);
      if (g.flash > 0) {
        ctx.globalAlpha = Math.min(1, g.flash * 2); ctx.textAlign = 'center'; ctx.fillStyle = '#B83A0B'; ctx.font = '900 26px system-ui, sans-serif';
        ctx.fillText(g.flashText + '!', W / 2, 46 - (1.1 - g.flash) * 12); ctx.globalAlpha = 1;
      }
      ctx.textBaseline = 'alphabetic';
    };

    const frame = (now: number) => {
      let dt = (now - last) / 1000; last = now;
      if (dt > 0.25) dt = 0;   // came back from a pause or a hidden tab
      // small fixed steps keep fast speeds from skipping through thin thorns
      while (dt > 0) { const s = Math.min(dt, 1 / 120); step(s); dt -= s; }
      draw();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [t, setPhase]);

  const shownBest = Math.max(best, result.newBest ? result.score : 0);
  return (
    <div className="mrun">
      <div
        ref={wrap}
        className={`mrun-stage ${phase}`}
        tabIndex={0}
        role="group"
        aria-roledescription={t('game.role')}
        aria-label={t('game.label')}
        onPointerDown={(e) => { if ((e.target as HTMLElement).closest('button,a')) return; e.preventDefault(); wrap.current?.focus({ preventScroll: true }); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); press(); }}
        onPointerUp={release}
        onPointerCancel={release}
        onContextMenu={(e) => e.preventDefault()}
      >
        <canvas ref={canvas} aria-hidden="true" />
        {phase === 'run' && (
          <button type="button" className="mrun-pausebtn" onClick={pause} aria-label={t('game.pauseBtn')}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="2" width="4" height="12" rx="1" fill="currentColor" /><rect x="9" y="2" width="4" height="12" rx="1" fill="currentColor" /></svg>
          </button>
        )}
        {phase === 'ready' && (
          <div className="mrun-over">
            <b className="mrun-big">{t('game.title')}</b>
            <button type="button" className="btn primary big" onClick={start}>{t('game.start')}</button>
            <span className="mrun-tip">{t('game.tapHint')}</span>
          </div>
        )}
        {phase === 'pause' && (
          <div className="mrun-over">
            <b className="mrun-big">{t('game.paused')}</b>
            <button type="button" className="btn primary" onClick={resume}>{t('game.resume')}</button>
          </div>
        )}
        {phase === 'over' && (
          <div className="mrun-over">
            {result.newBest && <span className="mrun-badge">{t('game.newBest')}</span>}
            <b className="mrun-big">{t('game.score')} {result.score}</b>
            <span className="mrun-tip">{t('game.caught', { n: result.hearts })} · {t('game.best')} {shownBest}</span>
            <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
              <button type="button" className="btn primary" onClick={start}>{t('game.again')}</button>
              <Link className="btn" href={signHref}>{t('game.signReal')} →</Link>
            </div>
          </div>
        )}
      </div>
      <p className="mrun-live" aria-live="polite">{live}</p>
      {phase === 'over' && signTitle && (
        <p className="mrun-nudge"><span>{t('game.nudge')}</span> <Link href={signHref}><b>{signTitle}</b></Link></p>
      )}
    </div>
  );
}
