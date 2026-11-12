'use client';
import Link from 'next/link';
import { Baloo_2 } from 'next/font/google';
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useT } from '@/lib/i18n/client';
import { STORY } from './MyloStory';
import { COVER_SCENE, END_SCENE, SCENES, sceneSvg } from './scenes';
import { ShareButton } from '../ShareButton';

// A rounded, friendly face for the words, like a printed picture book.
const book = Baloo_2({ subsets: ['latin', 'latin-ext'], weight: ['600', '800'], display: 'swap' });

const N = STORY.length;           // story pages; page N is "The end"
const WIDE = 700;                 // from this width the book opens as a two-page spread

const Scene = memo(function Scene({ i, slot }: { i: number; slot: string }) {
  const html = sceneSvg(i < N ? SCENES[i] : END_SCENE, `bk-${i}-${slot}`);
  return <div className="bk-scene" dangerouslySetInnerHTML={{ __html: html }} />;
});

function Cover() {
  const { t } = useT();
  return (
    <span className={`bk-cover ${book.className}`}>
      <span className="bk-cover-title">{t('story.title')}</span>
      <span className="bk-cover-art" dangerouslySetInnerHTML={{ __html: sceneSvg(COVER_SCENE, 'bk-cover') }} />
      <span className="bk-cover-by">{t('book.by')}</span>
    </span>
  );
}

function Words({ i, restart }: { i: number; restart: () => void }) {
  const { t } = useT();
  if (i < N) return <div className="bk-words"><p>{t(STORY[i].text)}</p><span className="bk-num">{i + 1}</span></div>;
  return (
    <div className="bk-words bk-end">
      <p className="bk-the-end">{t('book.end')}</p>
      <div className="bk-end-actions">
        <button type="button" className="btn" onClick={restart}>{t('story.again')}</button>
        <ShareButton path="/mylo/story" title={t('story.title')} />
        <Link className="btn primary" href="/mylo">{t('story.end')}</Link>
      </div>
    </div>
  );
}

// One page on a phone: the picture on top, the words underneath.
function Single({ i, restart, slot }: { i: number; restart: () => void; slot: string }) {
  return <div className="bk-single"><Scene i={i} slot={slot} /><Words i={i} restart={restart} /></div>;
}

type Turn = { dir: 1 | -1; from: number } | null;

// The open book. It starts by swinging its cover open, then turns one page at a time.
export function BookStage({ onClose }: { onClose?: () => void }) {
  const { t } = useT();
  const wrap = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(false);
  const [i, setI] = useState(0);
  const [opening, setOpening] = useState(true);
  const [turn, setTurn] = useState<Turn>(null);
  const reduce = useRef(false);
  const startX = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = wrap.current; if (!el) return;
    reduce.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce.current) setOpening(false);
    const ro = new ResizeObserver(([e]) => setWide(e.contentRect.width >= WIDE));
    ro.observe(el); return () => ro.disconnect();
  }, []);

  const go = useCallback((dir: 1 | -1) => {
    if (opening || turn) return;
    const to = i + dir; if (to < 0 || to > N) return;
    if (reduce.current) { setI(to); return; }
    setTurn({ dir, from: i });
  }, [i, opening, turn]);
  const landed = () => { if (turn) { setI(turn.from + turn.dir); setTurn(null); } else setOpening(false); };
  const restart = () => { setTurn(null); setI(0); };

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1); else if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', on); return () => window.removeEventListener('keydown', on);
  }, [go, onClose]);

  // tap the right side to turn forward, the left side to turn back
  const tap = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('a,button')) return;
    const r = e.currentTarget.getBoundingClientRect();
    go(e.clientX - r.left > r.width / 2 ? 1 : -1);
  };

  const shown = turn ? turn.from : i;
  let body: React.ReactNode;
  if (wide) {
    const left = turn?.dir === -1 ? turn.from - 1 : shown;
    const right = turn?.dir === 1 ? turn.from + 1 : shown;
    body = (
      <>
        <div className="bk-page bk-left">{!opening && <Scene i={left} slot="l" />}</div>
        <div className="bk-page bk-right"><Words i={right} restart={restart} /></div>
        {opening && <div className="bk-leaf bk-leaf-r bk-open" onAnimationEnd={landed}><div className="bk-face"><Cover /></div><div className="bk-face bk-back"><Scene i={0} slot="o" /></div></div>}
        {turn?.dir === 1 && <div className="bk-leaf bk-leaf-r bk-fwd" onAnimationEnd={landed}><div className="bk-face bk-paper"><Words i={turn.from} restart={restart} /></div><div className="bk-face bk-back"><Scene i={turn.from + 1} slot="b" /></div></div>}
        {turn?.dir === -1 && <div className="bk-leaf bk-leaf-l bk-bwd" onAnimationEnd={landed}><div className="bk-face"><Scene i={turn.from} slot="f" /></div><div className="bk-face bk-back bk-paper"><Words i={turn.from - 1} restart={restart} /></div></div>}
      </>
    );
  } else {
    const under = turn?.dir === 1 ? turn.from + 1 : shown;
    body = (
      <>
        <div className="bk-page bk-full"><Single i={under} restart={restart} slot="u" /></div>
        {opening && <div className="bk-leaf bk-leaf-full bk-open1" onAnimationEnd={landed}><div className="bk-face"><Cover /></div><div className="bk-face bk-back bk-paper" /></div>}
        {turn?.dir === 1 && <div className="bk-leaf bk-leaf-full bk-fwd1" onAnimationEnd={landed}><div className="bk-face bk-paper"><Single i={turn.from} restart={restart} slot="f" /></div><div className="bk-face bk-back bk-paper" /></div>}
        {turn?.dir === -1 && <div className="bk-leaf bk-leaf-full bk-bwd1" onAnimationEnd={landed}><div className="bk-face bk-paper"><Single i={turn.from - 1} restart={restart} slot="f" /></div><div className="bk-face bk-back bk-paper" /></div>}
      </>
    );
  }

  return (
    <div className={`bk-stage ${book.className}`} ref={wrap}>
      <div className={`bk-book ${wide ? 'wide' : 'narrow'}`} onClick={tap}
        onPointerDown={(e) => { startX.current = e.clientX; }}
        onPointerUp={(e) => { if (startX.current === null) return; const dx = e.clientX - startX.current; startX.current = null; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); }}
        aria-live="polite">
        {body}
      </div>
      <div className="bk-nav">
        <button type="button" className="btn" onClick={() => go(-1)} disabled={shown === 0 || opening}>{t('story.prev')}</button>
        <span className="bk-count">{t('story.page', { n: Math.min(shown + 1, N), total: N })}</span>
        <button type="button" className="btn primary" onClick={() => go(1)} disabled={shown === N || opening}>{t('story.next')}</button>
      </div>
    </div>
  );
}

// The closed book. Tapping it opens the story, in place or over the page.
export function MyloBook({ inline = false, small = false }: { inline?: boolean; small?: boolean }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const btn = useRef<HTMLButtonElement>(null);
  const was = useRef(false);   // give focus back to the book after closing it, not on first load
  useEffect(() => { if (open) was.current = true; else if (was.current) btn.current?.focus({ preventScroll: true }); }, [open]);
  useEffect(() => {
    if (!open || inline) return;
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open, inline]);

  if (open && inline) return <BookStage />;
  return (
    <>
      <div className={`bk-closed-wrap ${small ? 'small' : ''}`}>
        <button ref={btn} type="button" className="bk-closed" onClick={() => setOpen(true)} aria-label={`${t('story.title')}: ${t('book.tap')}`}>
          <Cover /><span className="bk-edges" aria-hidden="true" />
        </button>
        <span className="hint">{small ? t('story.read') : t('book.tap')}</span>
      </div>
      {open && (
        <div className="bk-overlay" role="dialog" aria-modal="true" aria-label={t('story.title')}>
          <button type="button" className="bk-x" onClick={close} aria-label={t('book.close')}>×</button>
          <BookStage onClose={close} />
        </div>
      )}
    </>
  );
}
