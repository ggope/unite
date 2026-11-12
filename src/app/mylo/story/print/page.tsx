import type { Metadata } from 'next';
import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import type { Key } from '@/lib/i18n/langs';
import { PrintButton } from '@/components/PrintButton';
import { bookFont } from '@/components/mylo/bookFont';
import { ALT, COVER_SCENE, END_SCENE, MYLO, SCENES, sceneSvg } from '@/components/mylo/scenes';
import { lineArt } from '@/components/mylo/lineart';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t('print.title')} · ${t('story.title')} · UNIER`, description: t('print.lead') };
}

const TEXT: Key[] = ['story.p1', 'story.p2', 'story.p3', 'story.p4', 'story.p5', 'story.p6'];
// The colouring pages: Mylo on his own, then three scenes from the book.
const COLOUR: { draw: () => string; alt: Key }[] = [
  { draw: () => `<rect width="300" height="300" fill="#FFFFFF"/>` + MYLO('cheering', 40, 10, 220), alt: 'print.colour' },
  { draw: SCENES[0], alt: ALT[0] },
  { draw: SCENES[3], alt: ALT[3] },
  { draw: COVER_SCENE, alt: 'book.altCover' },
];
const art = (html: string, label: string, cls = 'pp-art') => <div className={cls} role="img" aria-label={label} dangerouslySetInnerHTML={{ __html: html }} />;
const line = (draw: () => string) => `<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">${lineArt(draw())}</svg>`;

// Mylo's book on paper: the cover, six pages, the end, then pages to colour in. One sheet of A4 per page.
export default async function PrintBook() {
  const { t } = await getT();
  return (
    <div className={`stack print-book ${bookFont.className}`}>
      <div className="stack noprint" style={{ gap: 8 }}>
        <Link href="/mylo/story" className="hint">← {t('story.title')}</Link>
        <h1 style={{ margin: 0 }}>{t('print.title')}</h1>
        <p className="muted" style={{ margin: 0 }}>{t('print.lead')}</p>
        <div><PrintButton label={t('print.btn')} /></div>
      </div>
      <section className="pp pp-cover">
        <h2 className="pp-title">{t('story.title')}</h2>
        {art(sceneSvg(COVER_SCENE, 'pr-cover'), t('book.altCover'))}
        <p className="pp-by">{t('book.by')}</p>
        <p className="pp-owner">{t('print.owner')} <span /></p>
      </section>
      {TEXT.map((k, i) => (
        <section className="pp" key={k}>
          {art(sceneSvg(SCENES[i], `pr-${i}`), t(ALT[i]))}
          <p className="pp-text">{t(k)}</p>
          <span className="pp-num">{i + 1}</span>
        </section>))}
      <section className="pp">
        {art(sceneSvg(END_SCENE, 'pr-end'), t(ALT[6]))}
        <p className="pp-text pp-end">{t('book.end')}</p>
      </section>
      {COLOUR.map((c, i) => (
        <section className="pp pp-colour" key={i}>
          <h2 className="pp-title">{t('print.colour')}</h2>
          {art(line(c.draw), t(c.alt), 'pp-art pp-line')}
        </section>))}
    </div>
  );
}
