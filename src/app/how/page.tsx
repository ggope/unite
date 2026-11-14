import Link from 'next/link';
import type { Metadata } from 'next';
import { getT } from '@/lib/i18n/server';
import { MyloArt } from '@/components/mylo/MyloArt';
import type { Mood } from '@/components/mylo/art';
import type { Key } from '@/lib/i18n/langs';

export async function generateMetadata(): Promise<Metadata> { const { t } = await getT(); return { title: `${t('nav.how')} · UNIER`, description: t('how.lead') }; }

const STEPS: { mood: Mood; n: 1 | 2 | 3 | 4 | 5 }[] = [{ mood: 'worried', n: 1 }, { mood: 'fired', n: 2 }, { mood: 'growing', n: 3 }, { mood: 'calm', n: 4 }, { mood: 'cheering', n: 5 }];
const PROMISES = ['privacy', 'fair', 'open', 'free'] as const;

// How it works: the five steps from a video to an answer, and the promises UNIER keeps along the way.
export default async function How() {
  const { t } = await getT();
  return (
    <div className="stack how">
      <div className="stack" style={{ gap: 6 }}><h1 style={{ margin: 0 }}>{t('nav.how')}</h1><p className="muted" style={{ margin: 0 }}>{t('how.lead')}</p></div>
      <ol className="how-steps">
        {STEPS.map(({ mood, n }) => (
          <li key={n} className="panel how-step">
            <MyloArt mood={mood} size={72} id={`how-${n}`} label="" />
            <div className="stack" style={{ gap: 4, minWidth: 0 }}>
              <span className="label">{t('how.step', { n })}</span>
              <h2>{t(`how.s${n}` as Key)}</h2>
              <p style={{ margin: 0 }}>{t(`how.s${n}Text` as Key)}</p>
            </div>
          </li>
        ))}
      </ol>
      <h2 className="sechead">{t('how.promises')}</h2>
      <div className="how-promises">
        {PROMISES.map((k) => <div key={k} className="panel"><b>{t(`how.p.${k}` as Key)}</b><p className="hint" style={{ margin: '4px 0 0' }}>{t(`how.p.${k}Text` as Key)}</p></div>)}
      </div>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <Link className="btn primary" href="/petitions">{t('how.cta')}</Link>
        <Link className="btn" href="/start">{t('common.startPetition')}</Link>
        <Link className="btn ghost" href="/transparency">{t('tr.title')}</Link>
        <Link className="btn ghost" href="/privacy">{t('how.privacyLink')}</Link>
      </div>
    </div>
  );
}
