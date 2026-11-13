import type { Metadata } from 'next';
import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import type { Key } from '@/lib/i18n/dict';
import { LegalLinks } from '@/components/LegalLinks';
import { donateConfig, prettyIban } from '@/lib/donate';
import { GiveBox } from './GiveBox';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('don.link'), description: t('don.intro') };
}

// Donations go through hosted payment links (Stripe), so UNIER never touches card data.
// All settings (links, amounts, currency, bank details) are environment variables: see src/lib/donate.ts.
export default async function Donate() {
  const { t } = await getT();
  const cfg = donateConfig();
  const list = (keys: Key[]) => <ul className="ticks">{keys.map((k) => <li key={k}>{t(k)}</li>)}</ul>;
  const faq: [Key, Key][] = [['don.q1', 'don.a1'], ['don.q2', 'don.a2'], ['don.q3', 'don.a3'], ['don.q4', 'don.a4'], ['don.q5', 'don.a5'], ['don.q6', 'don.a6']];

  return (
    <div className="stack donate">
      <header className="stack" style={{ gap: 8 }}>
        <span className="label">{t('don.link')}</span>
        <h1 style={{ margin: 0 }}>{t('don.title')}</h1>
        <p className="muted" style={{ margin: 0 }}>{t('don.intro')}</p>
      </header>

      <GiveBox cfg={cfg} />

      <section className="stack" style={{ gap: 10 }} aria-labelledby="don-why">
        <h2 id="don-why">{t('don.why')}</h2>
        <div className="why-grid">
          {(['1', '2', '3'] as const).map((n) => (
            <div className="why" key={n}><b>{t(`don.why${n}h` as Key)}</b><span>{t(`don.why${n}` as Key)}</span></div>))}
        </div>
      </section>

      <section className="panel" style={{ gap: 8 }} aria-labelledby="don-where">
        <h2 id="don-where" style={{ margin: 0 }}>{t('don.where')}</h2>
        {list(['don.w1', 'don.w2', 'don.w3', 'don.w4'])}
      </section>

      <section className="panel" style={{ gap: 8 }} aria-labelledby="don-promise">
        <h2 id="don-promise" style={{ margin: 0 }}>{t('don.promise')}</h2>
        {list(['don.p1', 'don.p2', 'don.p3', 'don.p4'])}
        <div className="row" style={{ flexWrap: 'wrap', gap: 14 }}>
          <Link href="/transparency">{t('don.seeNumbers')} →</Link>
          <Link href="/transparency#open-numbers">{t('don.openData')} →</Link>
        </div>
      </section>

      <section className="stack" style={{ gap: 10 }} aria-labelledby="don-other">
        <h2 id="don-other">{t('don.otherWays')}</h2>
        <div className="ways">
          {cfg.bank && (
            <div className="panel way">
              <b>{t('don.bank')}</b>
              <span className="hint">{t('don.bankHint')}</span>
              <dl className="bank">
                {cfg.bank.name && <><dt>{t('don.bankName')}</dt><dd>{cfg.bank.name}</dd></>}
                <dt>IBAN</dt><dd className="num">{prettyIban(cfg.bank.iban)}</dd>
                {cfg.bank.bic && <><dt>BIC</dt><dd className="num">{cfg.bank.bic}</dd></>}
                <dt>{t('don.bankRef')}</dt><dd>UNIER</dd>
              </dl>
            </div>)}
          {cfg.email && (
            <div className="panel way">
              <b>{t('don.org')}</b>
              <span>{t('don.orgText')}</span>
              <a href={`mailto:${cfg.email}`}>{cfg.email}</a>
            </div>)}
          <div className="panel way">
            <b>{t('don.share')}</b>
            <span>{t('don.noMoney')}</span>
            <Link href="/petitions">{t('nav.petitions')} →</Link>
          </div>
          <div className="panel way">
            <b>{t('don.start')}</b>
            <span>{t('don.startText')}</span>
            <Link href="/start">{t('don.startLink')} →</Link>
          </div>
        </div>
      </section>

      <section className="stack faq" style={{ gap: 8 }} aria-labelledby="don-faq">
        <h2 id="don-faq">{t('don.faq')}</h2>
        {faq.map(([q, a]) => (
          <details key={q}><summary>{t(q)}</summary><p>{t(a)}</p></details>))}
        {cfg.email && <p className="hint" style={{ margin: 0 }}>{t('don.askUs')} <a href={`mailto:${cfg.email}`}>{cfg.email}</a></p>}
      </section>

      <LegalLinks />
    </div>
  );
}
