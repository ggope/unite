import { getT } from '@/lib/i18n/server';
import { LEGAL } from '@/lib/legal';
import { LegalLinks } from './LegalLinks';

export async function LegalPage({ doc }: { doc: keyof typeof LEGAL }) {
  const { lang, t } = await getT();
  const d = LEGAL[doc][lang] ?? LEGAL[doc].en;   // German, Spanish and French readers get the English text for now
  return (
    <article className="stack doc">
      <h1>{d.title}</h1>
      <p className="note" style={{ margin: 0 }}>{t('legal.draft')}{d.updated ? ` ${d.updated}` : ''}</p>
      {!LEGAL[doc][lang] && <p className="hint" lang={lang} style={{ margin: 0 }}>{t('legal.englishOnly')}</p>}
      <div lang={LEGAL[doc][lang] ? lang : 'en'}>{d.body}</div>
      <LegalLinks />
    </article>
  );
}
