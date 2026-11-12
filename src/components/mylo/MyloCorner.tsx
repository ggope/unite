'use client';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/i18n/client';
import { fmtN, type Key } from '@/lib/i18n/langs';
import type { Mood } from './art';

// The drawings load only when Mylo actually appears.
const MyloArt = dynamic(() => import('./MyloArt').then((m) => m.MyloArt), { ssr: false });

const DAY_KEY = 'mylo-greeted';
const SKIP = ['/mylo', '/admin', '/moderate', '/login', '/auth', '/reset'];

// Fire this after someone signs: Mylo pops up in the corner and cheers.
export function myloCheer(count?: number) {
  window.dispatchEvent(new CustomEvent('mylo:cheer', { detail: { count } }));
}

type Show = { mood: Mood; title: string; text: string; ms: number };

// Mylo greets you once a day in the corner (never in the middle of the screen),
// and cheers whenever you sign. The feed keeps playing behind him.
export function MyloCorner() {
  const { lang, t } = useT();
  const path = usePathname();
  const [show, setShow] = useState<Show | null>(null);
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const close = useCallback(() => {
    setLeaving(true);
    window.setTimeout(() => { setShow(null); setLeaving(false); }, 300);
  }, []);
  const open = useCallback((s: Show) => {
    window.clearTimeout(timer.current);
    setLeaving(false); setShow(s);
    timer.current = window.setTimeout(close, s.ms);
  }, [close]);

  // once a day, a moment after the page (and the first video) has started
  useEffect(() => {
    if (SKIP.some((p) => path.startsWith(p))) return;
    const today = new Date().toISOString().slice(0, 10);
    try { if (localStorage.getItem(DAY_KEY) === today) return; } catch { return; }
    let gone = false;
    const wait = window.setTimeout(async () => {
      try {
        const r = await fetch('/api/mylo');
        const m = (await r.json()) as { mood: Mood };
        if (gone) return;
        try { localStorage.setItem(DAY_KEY, today); } catch {}
        open({ mood: m.mood, title: t('mylo.hi'), text: t(`mylo.say.${m.mood}` as Key), ms: 9000 });
      } catch { /* Mylo stays home */ }
    }, 1500);
    return () => { gone = true; window.clearTimeout(wait); };
    // only on first arrival
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const on = (e: Event) => {
      const n = (e as CustomEvent<{ count?: number }>).detail?.count;
      open({ mood: 'cheering', title: t('mylo.thanks'), text: typeof n === 'number' && n > 1 ? t('mylo.signedN', { n: fmtN(n, lang) }) : t('mylo.signed'), ms: 5000 });
    };
    window.addEventListener('mylo:cheer', on);
    return () => window.removeEventListener('mylo:cheer', on);
  }, [open, t, lang]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (!show) return null;
  return (
    <div className={`mylo-corner ${leaving ? 'out' : ''}`} role="status" aria-live="polite">
      <div className="bub">
        <button className="x" type="button" aria-label={t('mylo.close')} onClick={close}>×</button>
        <b>{show.title}</b>
        {show.text} <Link href="/mylo" onClick={close}>{t('mylo.see')}</Link>
      </div>
      <Link href="/mylo" onClick={close} aria-label={t('mylo.meet')}>
        <MyloArt mood={show.mood} size={92} id="corner" label={t('mylo.label', { mood: t(`mylo.mood.${show.mood}` as Key) })} />
      </Link>
    </div>
  );
}
