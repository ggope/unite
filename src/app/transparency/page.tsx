import Link from 'next/link';
import type { Metadata } from 'next';
import { publicRpc } from '@/lib/supabase/public';
import { supabaseServer } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n/server';
import { fmtN, type Key } from '@/lib/i18n/dict';
import { LegalLinks } from '@/components/LegalLinks';

export const revalidate = 600;
export async function generateMetadata(): Promise<Metadata> { const { t } = await getT(); return { title: `${t('tr.title')} · UNIER`, description: t('tr.intro') }; }

// The rules and the numbers, in public. Everything here is counted live from the database.
export default async function Transparency() {
  const [{ lang, t }, sb] = await Promise.all([getT(), supabaseServer()]);   // getT first reads the language cookie, so the build never caches build-time numbers
  const [s, { data: ap }] = await Promise.all([publicRpc('transparency_stats', 600) as Promise<Record<string, any> | null>, sb.rpc('appeal_stats')]);   // appeals need 0018
  const n = (k: string) => fmtN(Number(s?.[k] ?? 0), lang);
  const tile = (k: string, label: Key) => <div className="tstat" key={k}><b className="num">{n(k)}</b><span>{t(label)}</span></div>;
  return (
    <div className="stack">
      <h1>{t('tr.title')}</h1>
      <p className="muted" style={{ margin: 0 }}>{t('tr.intro')}</p>

      <section className="panel"><h2>{t('tr.platform')}</h2>
        <div className="tgrid">{tile('petitions_live', 'tr.live')}{tile('signatures', 'tr.sigs')}{tile('people', 'tr.people')}{tile('wins', 'tr.wins')}</div></section>

      <section className="panel"><h2>{t('tr.moderation')}</h2>
        <div className="tgrid">{tile('reports_30d', 'tr.reports')}{tile('reports_resolved_30d', 'tr.resolved')}{tile('reports_open', 'tr.open')}{tile('moderators', 'tr.mods')}</div>
        {s?.median_hours_to_resolve != null && <p className="hint" style={{ margin: 0 }}>{t('tr.median', { h: String(s.median_hours_to_resolve) })}</p>}
        <div className="tgrid">{tile('videos_approved', 'tr.vApproved')}{tile('videos_rejected', 'tr.vRejected')}{tile('videos_pending', 'tr.vPending')}{tile('petitions_removed', 'tr.pRemoved')}</div>
        <p className="hint" style={{ margin: 0 }}>{t('tr.reasons')}</p>
        {ap && <><div className="tgrid">{([['filed_12m', 'tr.aFiled'], ['reversed_12m', 'tr.aReversed'], ['upheld_12m', 'tr.aUpheld'], ['open', 'tr.aOpen']] as const).map(([k, label]) =>
          <div className="tstat" key={k}><b className="num">{fmtN(Number(ap[k] ?? 0), lang)}</b><span>{t(label)}</span></div>)}</div>
          <p className="hint" style={{ margin: 0 }}>{t('tr.appeals')}{ap.median_days != null ? ` ${t('tr.aMedian', { d: String(ap.median_days) })}` : ''}</p></>}</section>

      <section className="panel tsec"><h2>{t('tr.feed')}</h2>
        <ul>{(['tr.f1', 'tr.f2', 'tr.f3', 'tr.f4', 'tr.f5'] as Key[]).map((k) => <li key={k}>{t(k)}</li>)}</ul>
        <Link href="/you">{t('tr.feedControl')} →</Link></section>

      <section className="panel tsec"><h2>{t('tr.privacy')}</h2>
        <ul>{(['tr.p1', 'tr.p2', 'tr.p3', 'tr.p4'] as Key[]).map((k) => <li key={k}>{t(k)}</li>)}</ul>
        <Link href="/privacy">{t('legal.privacy')} →</Link></section>

      <section className="panel tsec"><h2>{t('tr.money')}</h2><p style={{ margin: 0 }}>{t('tr.moneyText')}</p>
        <Link href="/donate">{t('don.link')} →</Link></section>

      <section className="panel tsec"><h2>{t('tr.power')}</h2><p style={{ margin: 0 }}>{t('tr.powerText')}</p>
        <Link href="/targets">{t('board.title')} →</Link></section>

      <section className="panel tsec" id="open-numbers"><h2>{t('od.title')}</h2><p style={{ margin: 0 }}>{t('od.text')}</p>
        <ul className="downloads">{([['totals', 'od.totals'], ['petitions', 'od.petitions'], ['targets', 'od.targets'], ['countries', 'od.countries']] as const).map(([f, k]) => (
          <li key={f}><a href={`/open/${f}.csv`} download>{t(k)}</a> <span className="hint">CSV</span></li>))}</ul></section>
      <LegalLinks />
    </div>
  );
}
