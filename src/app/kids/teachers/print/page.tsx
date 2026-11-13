import type { Metadata } from 'next';
import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { PrintButton } from '@/components/PrintButton';
import { bookFont } from '@/components/mylo/bookFont';
import { MYLO } from '@/components/mylo/scenes';
import { lineArt } from '@/components/mylo/lineart';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t('ws.title')} · ${t('teach.title')} · UNIER`, description: t('ws.lead') };
}

// A small Mylo outline in the corner of each sheet, to colour in when the work is done.
const mylo = (mood: 'cheering' | 'happy') =>
  `<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">${lineArt(`<rect width="300" height="300" fill="#FFFFFF"/>` + MYLO(mood, 40, 10, 220))}</svg>`;
const Lines = ({ n }: { n: number }) => <div className="ws-lines" aria-hidden="true">{Array.from({ length: n }, (_, i) => <span key={i} />)}</div>;

// Two A4 worksheets for the classroom lesson, in the reader's language.
export default async function Worksheets() {
  const { t } = await getT();
  const Head = ({ title }: { title: string }) => (
    <div className="ws-head">
      <div className="ws-mylo" aria-hidden="true" dangerouslySetInnerHTML={{ __html: mylo('cheering') }} />
      <h2 className="pp-title">{title}</h2>
    </div>
  );
  return (
    <div className={`stack print-book ${bookFont.className}`}>
      <div className="stack noprint" style={{ gap: 8 }}>
        <Link href="/kids/teachers" className="hint">← {t('teach.title')}</Link>
        <h1 style={{ margin: 0 }}>{t('ws.title')}</h1>
        <p className="muted" style={{ margin: 0 }}>{t('ws.lead')}</p>
        <div><PrintButton label={t('print.btn')} /></div>
      </div>
      <section className="pp ws">
        <Head title={t('ws.one')} />
        <p className="pp-owner">{t('ws.name')} <span /></p>
        <p className="ws-q">{t('ws.oneDraw')}</p>
        <div className="ws-draw" />
        <p className="ws-q">{t('ws.oneWhy')}</p>
        <Lines n={3} />
      </section>
      <section className="pp ws">
        <Head title={t('ws.two')} />
        <p className="pp-owner">{t('ws.group')} <span /></p>
        <p className="ws-q">{t('ws.twoWho')}</p><Lines n={1} />
        <p className="ws-q">{t('ws.twoWhat')}</p><Lines n={3} />
        <p className="ws-q">{t('ws.twoWhy')}</p><Lines n={3} />
        <p className="ws-q">{t('ws.twoSign')}</p>
        <div className="ws-sign" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <span key={i} />)}</div>
      </section>
    </div>
  );
}
