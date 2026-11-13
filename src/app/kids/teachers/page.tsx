import type { Metadata } from 'next';
import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import type { Key } from '@/lib/i18n/dict';
import { MyloBook } from '@/components/mylo/MyloBook';
import { BigScreen } from '@/components/kids/BigScreen';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t('teach.title')} · UNIER`, description: t('teach.lead'), openGraph: { title: t('teach.title'), description: t('teach.lead') } };
}

const GOALS: Key[] = ['teach.goal1', 'teach.goal2', 'teach.goal3'];
const STEPS: Key[] = ['teach.s1', 'teach.s2', 'teach.s3', 'teach.s4', 'teach.s5'];

// The classroom pack: a 45 minute lesson around Mylo's book, two worksheets, and the book for the projector.
export default async function Teachers() {
  const { t } = await getT();
  return (
    <div className="stack kids">
      <Link href="/kids" className="hint">← {t('kids.title')}</Link>
      <h1 style={{ margin: 0 }}>{t('teach.title')}</h1>
      <p className="muted" style={{ margin: 0 }}>{t('teach.lead')}</p>
      <div className="row">
        <Link className="btn primary" href="/kids/teachers/print">🖨️ {t('teach.print')}</Link>
        <Link className="btn" href="/mylo/story/print">{t('teach.printBook')}</Link>
      </div>

      <section className="panel">
        <h2>{t('teach.goals')}</h2>
        <ul className="kids-do">{GOALS.map((k) => <li key={k}>{t(k)}</li>)}</ul>
      </section>

      <section className="panel">
        <h2>{t('teach.plan')}</h2>
        <ol className="teach-steps">{STEPS.map((k) => { const [time, ...rest] = t(k).split(' · '); return <li key={k}><b>{time}</b> {rest.join(' · ')}</li>; })}</ol>
      </section>

      <section className="stack" style={{ gap: 10 }}>
        <h2 style={{ margin: 0 }}>{t('story.title')}</h2>
        <BigScreen label={t('teach.show')}><MyloBook inline /></BigScreen>
      </section>

      <section className="panel">
        <h2>{t('teach.after')}</h2>
        <p className="muted" style={{ margin: 0 }}>{t('teach.afterText')}</p>
        <h2>{t('teach.care')}</h2>
        <p className="muted" style={{ margin: 0 }}>{t('teach.careText')}</p>
      </section>
    </div>
  );
}
