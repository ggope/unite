'use client';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/i18n/client';
import { INTRO } from './MyloStory';

const MyloStory = dynamic(() => import('./MyloStory').then((m) => m.MyloStory), { ssr: false });

export const INTRO_KEY = 'mylo-intro';

// The first time someone opens the feed, Mylo introduces himself in three short pages.
// It never comes back once seen, and people arriving on a petition link go straight to it.
export function MyloIntro() {
  const { t } = useT();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const skip = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (path !== '/') return;
    try {
      if (localStorage.getItem(INTRO_KEY)) return;
      localStorage.setItem(INTRO_KEY, '1');
      localStorage.setItem('mylo-greeted', new Date().toISOString().slice(0, 10));   // no second hello today
    } catch { return; }
    setOpen(true);
    // only on first arrival
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!open) return;
    skip.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);

  if (!open) return null;
  return (
    <div className="backdrop intro" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="sheet intro-sheet" role="dialog" aria-modal="true" aria-label={t('intro.label')}>
        <div className="row between"><span className="label">{t('intro.label')}</span>
          <button ref={skip} type="button" className="btn ghost small" onClick={() => setOpen(false)}>{t('intro.skip')}</button></div>
        <MyloStory pages={INTRO} id="intro" keys end={
          <div className="stack" style={{ gap: 8, alignItems: 'center' }}>
            <button type="button" className="btn primary big" onClick={() => setOpen(false)}>{t('intro.start')}</button>
            <Link href="/mylo/story" onClick={() => setOpen(false)}>{t('intro.whole')}</Link>
          </div>
        } />
      </div>
    </div>
  );
}
