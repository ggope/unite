import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { supabaseServer } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n/server';
import { fmtN, locale } from '@/lib/i18n/dict';
import { PrintButton } from '@/components/PrintButton';

export const dynamic = 'force-dynamic';
type Report = { verified: number; imported: number; first_at: string | null; last_at: string | null; last_7d: number; reasons: number; countries: { c: string; n: number }[]; other: number; days: { d: string; n: number }[]; generated: string };

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params; const { t } = await getT();
  const { data } = await (await supabaseServer()).from('petitions').select('title').eq('id', id).maybeSingle();
  return data ? { title: `${t('rep.title')}: ${data.title} · UNIER` } : {};
}

// A page the organiser hands to the target: totals only, how people were confirmed, never a name.
export default async function DeliveryReport({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await supabaseServer();
  const [{ data: p }, { data: r }, { lang, t }, h] = await Promise.all([
    sb.from('petitions').select('id, title, target, ask, organiser_name, region').eq('id', id).maybeSingle(),
    sb.rpc('petition_report', { p_petition: id }),
    getT(), headers(),
  ]);
  if (!p || !r) notFound();
  const rep = r as Report;
  const loc = locale(lang); const n = (x: number) => fmtN(Number(x), lang);
  const day = (d: string | null) => (d ? new Date(d).toLocaleDateString(loc, { year: 'numeric', month: 'long', day: 'numeric' }) : '–');
  const regionName = (() => { try { const dn = new Intl.DisplayNames([loc], { type: 'region' }); return (c: string) => dn.of(c) ?? c; } catch { return (c: string) => c; } })();
  const site = process.env.NEXT_PUBLIC_SITE_URL || `https://${h.get('host')}`;
  const live = `${site}/p/${p.id}/report`;
  const rows = [...rep.countries, ...(rep.other ? [{ c: '', n: rep.other }] : [])];
  const top = Math.max(1, ...rows.map((x) => Number(x.n)));
  const dayMax = Math.max(1, ...rep.days.map((x) => Number(x.n)));

  return (
    <article className="stack report">
      <div className="row between noprint"><Link className="hint" href={`/p/${p.id}`}>← {p.title}</Link><PrintButton label={t('rep.print')} /></div>
      <span className="label">UNIER · {t('rep.title')}</span>
      <h1 style={{ margin: 0 }}>{p.title}</h1>
      <p className="muted" style={{ margin: 0 }}>{t('rep.to', { target: p.target })} · {p.region} · {t('p.startedBy', { name: p.organiser_name })}</p>

      <div className="panel">
        <div><span className="bignum">{n(rep.verified)}</span> <span className="muted">{t('rep.verified')}</span></div>
        {rep.imported > 0 && <span className="hint">{t('rep.imported', { n: n(rep.imported) })}</span>}
        <span className="hint">{t('rep.first', { d: day(rep.first_at) })} · {t('rep.last', { d: day(rep.last_at) })} · {t('rep.week', { n: n(rep.last_7d) })}{rep.reasons ? ` · ${t('rep.reasons', { n: n(rep.reasons) })}` : ''}</span>
      </div>

      <section className="stack" style={{ gap: 6 }}><h2>{t('rep.ask')}</h2><p style={{ margin: 0 }}>{p.ask}</p></section>

      <section className="panel" style={{ gap: 8 }}><h2 style={{ margin: 0 }}>{t('rep.how')}</h2>
        <ul className="ticks">{(['rep.h1', 'rep.h2', 'rep.h3', 'rep.h4'] as const).map((k) => <li key={k}>{t(k)}</li>)}</ul>
      </section>

      {rows.length > 0 && <section className="stack" style={{ gap: 8 }}><h2>{t('rep.countries')}</h2>
        <div className="bars">{rows.map((x) => <div className="bar" key={x.c || 'other'}><span>{x.c ? regionName(x.c) : t('rep.other')}</span><i style={{ width: `${(Number(x.n) / top) * 100}%` }} /><b className="num">{n(x.n)}</b></div>)}</div>
        <span className="hint">{t('rep.countriesHint')}</span></section>}

      {rep.days.length > 0 && <section className="stack" style={{ gap: 8 }}><h2>{t('rep.days')}</h2>
        <div className="spark" role="img" aria-label={rep.days.map((x) => `${day(x.d)}: ${x.n}`).join(', ')}>{rep.days.map((x) => <i key={x.d} title={`${day(x.d)}: ${n(x.n)}`} style={{ height: `${Math.max(4, (Number(x.n) / dayMax) * 100)}%` }} />)}</div></section>}

      <p className="hint" style={{ margin: 0 }}>{t('rep.generated', { d: day(rep.generated) })} <a href={live}>{live.replace(/^https:\/\//, '')}</a></p>
      <p className="note noprint">{t('rep.forOrganisers')}</p>
    </article>
  );
}
