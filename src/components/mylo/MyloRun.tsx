'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/i18n/client';
import type { Key } from '@/lib/i18n/langs';
import { H, WORLDS, hashStr, newGame, press as pressG, release as releaseG, rollDown, rollUp, step, type Game, type GameEvent, type Mod } from './run/engine';
import { drawFrame, myloSprite, type Labels } from './run/draw';
import { OUTFITS, PRICE, buy, dailyMod, finishRun, freshRun, level, load, reward, save, startRun, today, track, type Mission, type Outfit, type Progress, type RunStats } from './run/progress';

// "Mylo's Run": a small endless runner for bored moments, playable with one thumb.
// Jump (tap, again in the air for a double jump), roll (swipe down), four worlds, power-ups, missions,
// outfits and a daily challenge. Everything is kept in this browser only.

type Mode = 'endless' | 'daily';
type Result = { score: number; hearts: number; gain: number; gift: number; isBest: boolean; dailyBest: boolean; missions: Mission[]; mode: Mode };

export function MyloRun({ signHref, signTitle }: { signHref: string; signTitle?: string }) {
  const { t } = useT();
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const g = useRef<Game>(newGame());
  const view = useRef({ W: 400, scale: 1, dpr: 1 });
  const prog = useRef<Progress | null>(null);
  const run = useRef<RunStats>(freshRun());
  const finishedNow = useRef<Mission[]>([]);
  const modeRef = useRef<Mode>('endless');
  const [, setVer] = useState(0);
  const bump = () => setVer((v) => v + 1);
  const [phase, setPhaseState] = useState<'ready' | 'run' | 'pause' | 'over'>('ready');
  const [mode, setModeState] = useState<Mode>('endless');
  const [result, setResult] = useState<Result | null>(null);
  const [live, setLive] = useState('');
  const swipe = useRef<{ id: number; y: number; done: boolean } | null>(null);

  const p = prog.current;
  const setPhase = useCallback((ph: Game['phase']) => { g.current.phase = ph; setPhaseState(ph); }, []);
  const mText = useCallback((m: Mission) => t(`game.m.${m.kind}` as Key, { n: m.n }), [t]);

  useEffect(() => { prog.current = load(); g.current = newGame({ tips: prog.current.tips }); bump(); }, []);

  const setMode = (m: Mode) => {
    if (g.current.phase === 'run') return;
    modeRef.current = m; setModeState(m);
    g.current = newGame({ tips: prog.current?.tips, ...(m === 'daily' ? { seed: hashStr('mylo-' + today()), mod: dailyMod(today()) } : {}) });
    setResult(null); setPhase('ready');
  };

  const start = useCallback(() => {
    const pr = prog.current; if (!pr) return;
    const daily = modeRef.current === 'daily';
    g.current = newGame({ tips: pr.tips, ...(daily ? { seed: hashStr('mylo-' + today()), mod: dailyMod(today()) } : {}) });
    run.current = freshRun(); finishedNow.current = [];
    startRun(pr);
    finishedNow.current.push(...track(pr, run.current, { t: 'start' }));
    setResult(null); setLive('');
    setPhase('run');
    wrap.current?.focus({ preventScroll: true });
  }, [setPhase]);
  const pause = useCallback(() => { if (g.current.phase === 'run') setPhase('pause'); }, [setPhase]);
  const resume = useCallback(() => { if (g.current.phase === 'pause') { setPhase('run'); wrap.current?.focus({ preventScroll: true }); } }, [setPhase]);

  const press = useCallback(() => {
    const ph = g.current.phase;
    if (ph === 'ready') { start(); return; }
    if (ph === 'over') { if (performance.now() - g.current.hitAt > 700) start(); return; }
    if (ph === 'pause') { resume(); return; }
    pressG(g.current);
  }, [start, resume]);

  // keyboard: Space / Up / W jump (again in the air for a double jump), Down / S roll, P or Escape pause
  useEffect(() => {
    const typing = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el) return false;
      if (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return true;
      return g.current.phase !== 'run' && /^(BUTTON|A)$/.test(el.tagName);
    };
    const down = (e: KeyboardEvent) => {
      if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key, ph = g.current.phase, onStage = document.activeElement === wrap.current;
      if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W' || (k === 'Enter' && onStage && ph !== 'run')) {
        e.preventDefault(); if (!e.repeat) press();
      } else if (k === 'ArrowDown' || k === 's' || k === 'S') {
        if (ph === 'run') { e.preventDefault(); if (!e.repeat) rollDown(g.current, true); }
      } else if (k === 'p' || k === 'P' || k === 'Escape') {
        if (ph === 'run') { e.preventDefault(); pause(); } else if (ph === 'pause' && k !== 'Escape') resume();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') releaseG(g.current);
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') rollUp(g.current);
    };
    const hide = () => { if (document.hidden) pause(); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    window.addEventListener('blur', pause); document.addEventListener('visibilitychange', hide);
    return () => {
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up);
      window.removeEventListener('blur', pause); document.removeEventListener('visibilitychange', hide);
    };
  }, [press, pause, resume]);

  // size the canvas to its box, sharp on phone screens
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
    const labels: Labels = {
      best: t('game.best'),
      worlds: WORLDS.map((w) => t(`game.w.${w}` as Key)),
      tips: { high: t('game.tip.high'), low: t('game.tip.low'), power: t('game.tip.power') },
    };
    const onEvent = (e: GameEvent | { t: 'score'; score: number }) => {
      const gm = g.current, pr = prog.current; if (!pr) return;
      if (e.t === 'tip') { gm.tip = e.tip; gm.tipT = 2.6; pr.tips[e.tip] = true; return; }
      if (e.t === 'over') {
        track(pr, run.current, { t: 'score', score: gm.score });
        const daily = modeRef.current === 'daily';
        const r = finishRun(pr, { score: gm.score, hearts: gm.hearts, litter: gm.litter, daily });
        save(pr);
        const res: Result = { score: gm.score, hearts: gm.hearts, ...r, missions: [...finishedNow.current], mode: modeRef.current };
        setResult(res);
        setLive(t('game.result', { n: gm.score, best: daily ? pr.daily.best : pr.best }));
        try { navigator.vibrate?.(60); } catch {}
        setPhase('over');
        return;
      }
      const done = track(pr, run.current, e);
      if (done.length) {
        finishedNow.current.push(...done);
        gm.toast = `✓ ${mText(done[0])}  +${reward(done[0])}`; gm.toastT = 2.4;
        save(pr);
      }
    };
    let raf = 0, last = performance.now(), scoreSeen = 0;
    const frame = (now: number) => {
      let dt = (now - last) / 1000; last = now;
      if (dt > 0.25) dt = 0;   // back from a pause or a hidden tab
      const gm = g.current, { W } = view.current;
      // small fixed steps keep fast speeds from skipping through thin obstacles
      while (dt > 0) { const s = Math.min(dt, 1 / 120); step(gm, s, W, onEvent); dt -= s; }
      if (gm.phase === 'run' && gm.score - scoreSeen >= 10) { scoreSeen = gm.score; onEvent({ t: 'score', score: gm.score }); }
      const pr = prog.current;
      const daily = modeRef.current === 'daily';
      drawFrame(ctx, gm, view.current, { ...labels, daily: daily ? t(`game.mod.${gm.mod}` as Key) : undefined }, pr?.outfit ?? 'none', (daily ? pr?.daily.best : pr?.best) ?? 0);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [t, setPhase, mText]);

  // touch: tap to jump, swipe down to roll
  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button,a')) return;
    e.preventDefault(); wrap.current?.focus({ preventScroll: true });
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    swipe.current = { id: e.pointerId, y: e.clientY, done: false };
    const was = g.current.phase;
    press();
    if (was === 'run' && e.pointerType !== 'mouse') g.current.touchJump = 0.2;
  };
  const onMove = (e: React.PointerEvent) => {
    const s = swipe.current;
    if (!s || s.id !== e.pointerId || s.done) return;
    if (e.clientY - s.y > 26) { s.done = true; releaseG(g.current); rollDown(g.current, false); }
  };
  const onUp = (e: React.PointerEvent) => { if (swipe.current?.id === e.pointerId) swipe.current = null; releaseG(g.current); };

  const mod = dailyMod(today());
  const dailyBest = p?.daily.day === today() ? p.daily.best : 0;
  const shownBest = mode === 'daily' ? dailyBest : p?.best ?? 0;
  return (
    <div className="mrun">
      <div className="mrun-modes" role="group" aria-label={t('game.modes')}>
        <button type="button" aria-pressed={mode === 'endless'} disabled={phase === 'run'} onClick={() => setMode('endless')}>{t('game.endless')}</button>
        <button type="button" aria-pressed={mode === 'daily'} disabled={phase === 'run'} onClick={() => setMode('daily')}>
          {t('game.daily')} <span className="mrun-mod">{t(`game.mod.${mod}` as Key)}</span>{p?.daily.played && <span aria-label={t('game.dailyDone')}> ✓</span>}
        </button>
      </div>
      <div
        ref={wrap}
        className={`mrun-stage ${phase}`}
        tabIndex={0}
        role="group"
        aria-roledescription={t('game.role')}
        aria-label={t('game.label')}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
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
            <b className="mrun-big">{mode === 'daily' ? t('game.daily') : t('game.title')}</b>
            {mode === 'daily' && <span className="mrun-tip">{t(`game.modText.${mod}` as Key)}</span>}
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
        {phase === 'over' && result && (
          <div className="mrun-over">
            {(result.isBest || result.dailyBest) && <span className="mrun-badge">{result.mode === 'daily' && !result.isBest ? t('game.newDailyBest') : t('game.newBest')}</span>}
            <b className="mrun-big">{t('game.score')} {result.score}</b>
            <span className="mrun-tip">
              {t('game.earned', { n: result.gain + result.gift + result.missions.reduce((a, m) => a + reward(m), 0) })} · {t('game.best')} {shownBest}
            </span>
            {result.missions.length > 0 && <span className="mrun-done">✓ {result.missions.map(mText).join(' · ')}</span>}
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
      {p && <Locker p={p} mText={mText} running={phase === 'run'} onChange={() => { save(p); bump(); }} />}
    </div>
  );
}

// Level, hearts to spend, the three missions, the daily streak and Mylo's outfits.
function Locker({ p, mText, running, onChange }: { p: Progress; mText: (m: Mission) => string; running: boolean; onChange: () => void }) {
  const { t } = useT();
  return (
    <section className="panel mrun-locker" aria-label={t('game.locker')}>
      <div className="mrun-stats">
        <span className="mrun-chip"><b>{t('game.level', { n: level(p) })}</b></span>
        <span className="mrun-chip" aria-label={t('game.bank', { n: p.bank })}><span aria-hidden="true" style={{ color: '#E2412B' }}>♥</span> <b>{p.bank}</b></span>
        <span className="mrun-chip">{p.streak.n > 0 ? t('game.streak', { n: p.streak.n }) : t('game.noStreak')}</span>
      </div>
      <div>
        <h2 className="mrun-h">{t('game.missions')}</h2>
        <ul className="mrun-missions">
          {p.missions.map((m) => (
            <li key={m.kind + m.n}>
              <span className="mrun-mtext">{mText(m)}</span>
              <span className="mrun-mbar" role="progressbar" aria-valuemin={0} aria-valuemax={m.n} aria-valuenow={Math.min(m.have, m.n)} aria-label={mText(m)}><i style={{ width: `${Math.min(100, (m.have / m.n) * 100)}%` }} /></span>
              <span className="hint">{Math.min(m.have, m.n)}/{m.n} · +{reward(m)} ♥</span>
            </li>
          ))}
        </ul>
        <p className="hint" style={{ margin: '6px 0 0' }}>{t('game.missionsHint')}</p>
      </div>
      <div>
        <h2 className="mrun-h">{t('game.outfits')}</h2>
        <div className="mrun-outfits">
          {OUTFITS.map((o) => {
            const own = p.owned.includes(o), on = p.outfit === o, can = own || p.bank >= PRICE[o];
            return (
              <button key={o} type="button" className="mrun-outfit" aria-pressed={on} disabled={running || !can}
                onClick={() => { if (buy(p, o)) onChange(); }}>
                <OutfitPic outfit={o} />
                <span>{t(`game.o.${o}` as Key)}</span>
                <span className="hint">{on ? t('game.wearing') : own ? t('game.wear') : <>♥ {PRICE[o]}</>}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function OutfitPic({ outfit }: { outfit: Outfit }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; const ctx = c?.getContext('2d'); if (!c || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = 50 * dpr; c.height = 60 * dpr;
    ctx.setTransform(dpr * 0.25, 0, 0, dpr * 0.25, 0, 0);
    ctx.clearRect(0, 0, 200, 240);
    myloSprite(ctx, { t: 0.4, run: false, ground: true, up: false, roll: false, hit: false, blink: false, landed: false, outfit });
  }, [outfit]);
  return <canvas ref={ref} aria-hidden="true" style={{ width: 50, height: 60 }} />;
}
