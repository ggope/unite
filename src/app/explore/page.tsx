import Link from 'next/link';
import type { Metadata } from 'next';
import { getT } from '@/lib/i18n/server';
import { MORE } from '@/lib/nav';
import { NavIcon } from '@/components/Nav';
import { LangSwitch } from '@/lib/i18n/client';

export async function generateMetadata(): Promise<Metadata> { const { t } = await getT(); return { title: `${t('nav.explore')} · UNIER` }; }

// Explore: on a phone the left bar does not fit, so every page it links to lives here as a big tile.
export default async function Explore() {
  const { t } = await getT();
  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>{t('nav.explore')}</h1>
      {MORE.map((g) => (
        <section key={g.label} className="stack" style={{ gap: 8 }} aria-labelledby={`ex-${g.label}`}>
          <h2 id={`ex-${g.label}`} className="label">{t(g.label)}</h2>
          <div className="ex-tiles">
            {g.items.map((i) => (
              <Link key={i.href} href={i.href} className="ex-tile"><NavIcon name={i.icon} /><b>{t(i.label)}</b><span>{t(i.hint)}</span></Link>
            ))}
          </div>
        </section>
      ))}
      <div className="panel"><span className="label">{t('lang.label')}</span><LangSwitch /></div>
    </div>
  );
}
