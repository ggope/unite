'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/i18n/client';
import type { Key } from '@/lib/i18n/langs';
import { MyloArt } from './MyloArt';
import type { Mood } from './art';

export type Page = { mood: Mood; text: Key };

// "Why is Mylo trapped?": short enough to read to a small child, true enough for anyone.
export const STORY: Page[] = [
  { mood: 'happy', text: 'story.p1' },
  { mood: 'worried', text: 'story.p2' },
  { mood: 'scared', text: 'story.p3' },
  { mood: 'fired', text: 'story.p4' },
  { mood: 'growing', text: 'story.p5' },
  { mood: 'cheering', text: 'story.p6' },
];
export const INTRO: Page[] = [
  { mood: 'happy', text: 'intro.p1' },
  { mood: 'worried', text: 'intro.p2' },
  { mood: 'fired', text: 'intro.p3' },
];

// A picture book: one big drawing and a sentence or two per page.
// Tap Next or Back, swipe, or use the arrow keys. `end` is what shows under the last page.
export function MyloStory({ pages, id, end, big = false, keys = false, again = false }: {
  pages: Page[]; id: string; end?: React.ReactNode; big?: boolean; keys?: boolean; again?: boolean;
}) {
  const { t } = useT();
  const [i, setI] = useState(0);
  const last = i === pages.length - 1;
  const go = useCallback((d: number) => setI((x) => Math.min(pages.length - 1, Math.max(0, x + d))), [pages.length]);
  const startX = useRef<number | null>(null);

  useEffect(() => {
    if (!keys) return;
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input,textarea,select')) return;
      if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [keys, go]);

  const p = pages[i];
  return (
    <div className={`story ${big ? 'big' : ''}`}
      onPointerDown={(e) => { startX.current = e.clientX; }}
      onPointerUp={(e) => { if (startX.current === null) return; const dx = e.clientX - startX.current; startX.current = null; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); }}>
      <div className="story-page" key={i}>
        <MyloArt mood={p.mood} size={big ? 230 : 170} id={`${id}-${i}`} label="" />
        <p className="story-text" aria-live="polite">{t(p.text)}</p>
      </div>
      <div className="story-dots" aria-label={t('story.page', { n: i + 1, total: pages.length })} role="img">
        {pages.map((_, k) => <i key={k} className={k === i ? 'on' : ''} />)}
      </div>
      <div className="row story-nav">
        <button type="button" className="btn ghost" onClick={() => go(-1)} disabled={i === 0}>{t('story.prev')}</button>
        {!last && <button type="button" className="btn primary" onClick={() => go(1)} autoFocus={big}>{t('story.next')}</button>}
        {last && again && <button type="button" className="btn" onClick={() => setI(0)}>{t('story.again')}</button>}
      </div>
      {last && end}
    </div>
  );
}
