import Link from 'next/link';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { loadViewer } from '@/lib/viewer';
import { localize } from '@/lib/petitionText';
import { getT } from '@/lib/i18n/server';
import { fmtN, LANGS, locale } from '@/lib/i18n/dict';
import { PetitionRow } from '@/components/PetitionRow';

export const dynamic = 'force-dynamic';
export async function generateMetadata(): Promise<Metadata> { const { t } = await getT(); return { title: `${t('nav.near')} · UNIER`, description: t('near.lead') }; }

// Countries people can pick by hand (the approximate country of the connection is chosen by default).
const COUNTRIES = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'AL', 'BA', 'CH', 'GB', 'IS', 'MD', 'ME', 'MK', 'NO', 'RS', 'TR', 'UA', 'AR', 'AU', 'BR', 'CA', 'CL', 'CN', 'CO', 'EG', 'GH', 'IN', 'ID', 'IL', 'JP', 'KE', 'KR', 'MA', 'MX',
  'NG', 'NZ', 'PE', 'PH', 'PK', 'SG', 'TH', 'TN', 'US', 'VN', 'ZA'];

// A country's name in every language UNIER speaks, to match petitions whose region names it.
function countryNames(cc: string) {
  const out = new Set<string>();
  for (const l of Object.keys(LANGS) as (keyof typeof LANGS)[]) { try { const n = new Intl.DisplayNames([locale(l)], { type: 'region' }).of(cc); if (n && n !== cc) out.add(n); } catch {} }
  return [...out];
}
// Text for a PostgREST ilike filter: letters, digits, spaces and dashes only, so commas or brackets cannot break it.
const safe = (s: string) => s.replace(/[^\p{L}\p{N} \-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);

// Near you: petitions about your country or a place you type, and what people in your country are signing.
export default async function Near({ searchParams }: { searchParams: Promise<{ country?: string; place?: string }> }) {
  const { country: asked = '', place: rawPlace = '' } = await searchParams;
  const [{ sb, viewer, signed }, { lang, t }, jar] = await Promise.all([loadViewer(), getT(), cookies()]);
  const fmt = (n: number) => fmtN(n, lang);
  const cc = (/^[A-Za-z]{2}$/.test(asked) ? asked : jar.get('geo')?.value ?? '').toUpperCase();
  const name = (c: string) => { try { return new Intl.DisplayNames([locale(lang)], { type: 'region' }).of(c) ?? c; } catch { return c; } };
  const ccName = cc ? name(cc) : '';
  const place = safe(rawPlace);
  const cols = 'id, title, target, topic, goal, region, status, cluster_id, lang, tr, petition_stats(combined, united_count)';

  // 1. petitions whose place names the town or region typed, or the country
  const names = place ? [place] : cc ? countryNames(cc).map(safe).filter((n) => n.length >= 3) : [];
  const about = names.length
    ? (await sb.from('petitions').select(cols).eq('status', 'live').or(names.map((n) => `region.ilike.*${n}*`).join(',')).order('created_at', { ascending: false }).limit(40)).data ?? []
    : [];
  // 2. what people in this country sign most (only counts of 10 or more are shown, like everywhere else)
  let popular: any[] = [];
  if (cc && !place) {
    const { data: ranked } = await sb.rpc('popular_in', { p_country: cc, p_names: [], p_limit: 30 });
    const ids = ((ranked ?? []) as any[]).filter((r) => r.n != null).map((r) => r.petition_id as string);
    const aboutIds = new Set(about.map((p: any) => p.id));
    if (ids.length) {
      const { data } = await sb.from('petitions').select(cols).in('id', ids.filter((i) => !aboutIds.has(i)));
      popular = (data ?? []).sort((a: any, b: any) => ids.indexOf(a.id) - ids.indexOf(b.id));
    }
  }
  const row = (p: any) => { const q = localize(p, lang); return <PetitionRow key={q.id} p={q} t={t} fmt={fmt} signed={signed.has(q.id)} viewer={viewer} note={<>📍 {q.region}</>} />; };
  const countries = COUNTRIES.map((c) => ({ c, n: name(c) })).sort((a, b) => a.n.localeCompare(b.n, locale(lang)));

  return (
    <div className="stack">
      <div className="stack" style={{ gap: 6 }}><h1 style={{ margin: 0 }}>{t('nav.near')}</h1><p className="muted" style={{ margin: 0 }}>{t('near.lead')}</p></div>
      <form className="panel nearform" action="/near">
        <label className="field"><span className="label">{t('near.country')}</span>
          <select name="country" defaultValue={cc}>
            <option value="">{t('near.pick')}</option>
            {countries.map(({ c, n }) => <option key={c} value={c}>{n}</option>)}
          </select>
        </label>
        <label className="field"><span className="label">{t('near.place')}</span><input name="place" type="search" defaultValue={place} placeholder={t('near.placeHint')} maxLength={60} /></label>
        <button className="btn primary">{t('near.show')}</button>
      </form>
      {!cc && !place ? <div className="empty">{t('near.none')}</div> : (
        <>
          <section className="stack" style={{ gap: 0 }} aria-labelledby="near-about">
            <h2 id="near-about" className="sechead">{t('near.about', { place: place || ccName })}</h2>
            {about.length ? about.map(row) : <div className="empty">{t('near.aboutNone', { place: place || ccName })} <Link href="/start">{t('pet.startOne')}</Link>.</div>}
          </section>
          {cc && !place && (
            <section className="stack" style={{ gap: 0 }} aria-labelledby="near-pop">
              <h2 id="near-pop" className="sechead">{t('near.popular', { country: ccName })}</h2>
              {popular.length ? popular.map(row) : <p className="hint">{t('near.popularNone')}</p>}
            </section>
          )}
        </>
      )}
      <p className="hint">{t('near.privacy')}</p>
    </div>
  );
}
