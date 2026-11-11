import type { Metadata } from 'next';
import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { LegalLinks } from '@/components/LegalLinks';

export const metadata: Metadata = { title: 'Support UNIER' };

// Donations go through hosted payment links (Stripe), so UNIER never touches card data.
// Set NEXT_PUBLIC_DONATE_URL (one-off, "customer chooses amount") and optionally NEXT_PUBLIC_DONATE_MONTHLY_URL.
export default async function Donate() {
  const { t } = await getT();
  const once = process.env.NEXT_PUBLIC_DONATE_URL;
  const monthly = process.env.NEXT_PUBLIC_DONATE_MONTHLY_URL;
  return (
    <div className="stack donate">
      <span className="label">{t('don.link')}</span>
      <h1 style={{ margin: 0 }}>{t('don.title')}</h1>
      <p className="muted" style={{ margin: 0 }}>{t('don.intro')}</p>
      <div className="panel" style={{ gap: 10 }}>
        {once || monthly ? (<>
          <div className="row">
            {once && <a className="btn primary big" href={once} target="_blank" rel="noopener">{t('don.once')}</a>}
            {monthly && <a className="btn big" href={monthly} target="_blank" rel="noopener">{t('don.monthly')}</a>}
          </div>
          <span className="hint">{t('don.secure')}</span>
        </>) : <p style={{ margin: 0 }}><b>{t('don.soon')}</b></p>}
      </div>
      <section className="panel" style={{ gap: 8 }}><h2 style={{ margin: 0 }}>{t('don.promise')}</h2>
        <ul className="ticks">{(['don.p1', 'don.p2', 'don.p3'] as const).map((k) => <li key={k}>{t(k)}</li>)}</ul></section>
      <section className="stack" style={{ gap: 8 }}><h2>{t('don.where')}</h2>
        <ul className="ticks">{(['don.w1', 'don.w2', 'don.w3', 'don.w4'] as const).map((k) => <li key={k}>{t(k)}</li>)}</ul></section>
      <p className="note" style={{ margin: 0 }}>{t('don.noMoney')} <Link href="/petitions">{t('nav.petitions')} →</Link></p>
      <LegalLinks />
    </div>
  );
}
