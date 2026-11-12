import type { Metadata } from 'next';
import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n/server';
import { fmtN, locale } from '@/lib/i18n/dict';
import { localize } from '@/lib/petitionText';
import { MyloArt } from '@/components/mylo/MyloArt';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t('wins.title')} · UNIER`, description: t('wins.lead') };
}

// Every petition that won, newest first. Proof that asking together works.
export default async function Wins() {
  const [{ lang, t }, sb] = await Promise.all([getT(), supabaseServer()]);
  const { data } = await sb.rpc('recent_wins', { p_limit: 60 });   // empty until 0017 has run
  const wins = ((data ?? []) as any[]).map((w) => localize(w, lang));
  const day = (d: string) => new Date(d).toLocaleDateString(locale(lang), { year: 'numeric', month: 'long', day: 'numeric' });
  return (
    <div className="stack">
      <div className="wins-head">
        <MyloArt mood="cheering" size={120} id="wins" label="" />
        <div className="stack" style={{ gap: 6 }}><h1 style={{ margin: 0 }}>{t('wins.title')}</h1><p className="muted" style={{ margin: 0 }}>{t('wins.lead')}</p></div>
      </div>
      {wins.length ? <ul className="wins">{wins.map((w) => (
        <li className="panel win" key={w.petition_id}>
          <span className="hint"><b className="badge-win">{t('kind.win')}</b> · {t('wins.on', { d: day(w.won_at) })} · {t('wins.signed', { n: fmtN(Number(w.signatures), lang) })}</span>
          <Link href={`/p/${w.petition_id}`}><b>{w.title}</b></Link>
          {w.headline && <span>{w.headline}</span>}
          {w.body && <p className="muted" style={{ margin: 0, whiteSpace: 'pre-line' }}>{w.body.length > 280 ? `${w.body.slice(0, 280)}…` : w.body}</p>}
        </li>))}</ul>
        : <div className="empty"><p>{t('wins.empty')}</p></div>}
      <Link className="btn primary" href="/start" style={{ alignSelf: 'flex-start' }}>{t('wins.start')}</Link>
    </div>
  );
}
