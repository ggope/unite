import Link from 'next/link';
import { TOPICS } from '@/lib/topics';
import { getT } from '@/lib/i18n/server';
import { fmtN } from '@/lib/i18n/dict';
import { SignButton, type Viewer } from './SignButton';
import { InstallApp } from './InstallApp';
import { LegalLinks } from './LegalLinks';

type P = { id: string; title: string; target: string; topic: keyof typeof TOPICS; goal: number; combined: number };

// What a visitor sees while the feed has no videos yet: what UNIER is, and petitions to sign right away.
export async function Welcome({ petitions, viewer, signed }: { petitions: P[]; viewer: Viewer; signed: string[] }) {
  const { lang, t } = await getT();
  const fmt = (n: number) => fmtN(n, lang);
  return (
    <div className="stack">
      <section className="hero">
        <span className="label">{t('welcome.label')}</span>
        <h1>{t('welcome.title')}</h1>
        <p className="muted">{t('welcome.text')}</p>
        <div className="row"><Link className="btn primary big" href="/petitions">{t('welcome.browse')}</Link><Link className="btn big" href="/post">{t('welcome.postFirst')}</Link></div>
      </section>
      <InstallApp />
      {petitions.length > 0 && (
        <section className="stack" style={{ gap: 0 }}>
          <div className="row between" style={{ marginBottom: 4 }}><h2>{t('welcome.signToday')}</h2><Link href="/petitions">{t('welcome.seeAll')}</Link></div>
          {petitions.map((p) => (
            <div className="prow" key={p.id}>
              <div className="stack" style={{ gap: 6, minWidth: 0 }}>
                <span className="hint"><i className="tdot" style={{ background: TOPICS[p.topic].b }} />{t(`topic.${p.topic}`)} · {t('pet.to', { target: p.target })}</span>
                <h3><Link href={`/p/${p.id}`}>{p.title}</Link></h3>
                <span className="row hint"><b className="num">{fmt(p.combined)}</b> {t('common.of')} {fmt(p.goal)}<span className="prog"><i style={{ width: `${Math.min(100, (p.combined / p.goal) * 100)}%` }} /></span></span>
              </div>
              <SignButton variant="small" petitionId={p.id} title={p.title} signed={signed.includes(p.id)} viewer={viewer} />
            </div>
          ))}
        </section>
      )}
      <section className="panel">
        <h2>{t('welcome.haveSomething')}</h2>
        <p className="muted" style={{ margin: 0 }}>{t('welcome.startText')}</p>
        <div className="row"><Link className="btn primary" href="/start">{t('common.startPetition')}</Link></div>
      </section>
      <LegalLinks />
    </div>
  );
}
