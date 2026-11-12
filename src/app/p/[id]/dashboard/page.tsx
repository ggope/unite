import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n/server';
import { fmtN, locale } from '@/lib/i18n/dict';
import { localize } from '@/lib/petitionText';
import { MyloArt } from '@/components/mylo/MyloArt';
import { ShareButton } from '@/components/ShareButton';
import { AnswerLink } from '@/components/AnswerLink';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'UNIER', robots: { index: false, follow: false } };

type Stats = { signatures: number; today: number; week: number; via_share: number; reasons: number; followers: number; videos: number;
  delivered_at: string | null; answered_at: string | null; won_at: string | null; answer_link: boolean; days: { d: string; n: number }[] };

// The organiser's own view: how the petition is doing and one clear next step. Totals only, never names.
export default async function Dashboard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ sb, user }, { lang, t }] = await Promise.all([currentUser(), getT()]);
  if (!user) redirect(`/login?next=${encodeURIComponent(`/p/${id}/dashboard`)}`);
  const [{ data: raw }, { data, error }] = await Promise.all([
    sb.from('petitions').select('id, title, target, status, created_at, created_by, lang, tr').eq('id', id).maybeSingle(),
    sb.rpc('organiser_stats', { p_petition: id }),
  ]);
  if (!raw || (!error && !data)) notFound();   // not theirs, or no such petition
  const p = localize(raw, lang);
  const n = (x: number) => fmtN(Number(x), lang);
  const day = (d: string) => new Date(d).toLocaleDateString(locale(lang), { year: 'numeric', month: 'long', day: 'numeric' });
  const head = (
    <>
      <Link href={`/p/${p.id}`} className="hint">← {p.title}</Link>
      <h1 style={{ margin: 0 }}>{t('dash.title')}</h1>
      <p className="hint" style={{ margin: 0 }}>{t('dash.lead')}</p>
    </>
  );
  if (error) return <div className="stack">{head}<p className="note">{t('dash.soon')}</p></div>;   // before 0017 has run

  const s = data as Stats;
  const live = p.status === 'live';
  // One next step, in the order that usually helps most.
  let next: React.ReactNode;
  if (s.won_at) next = <p style={{ margin: 0 }}>{t('dash.won')}</p>;
  else if (Number(s.signatures) < 25) next = <><p style={{ margin: 0 }}>{t('dash.doShare')}</p><ShareButton path={`/p/${p.id}`} title={p.title} /></>;
  else if (!Number(s.videos) && live) next = <><p style={{ margin: 0 }}>{t('dash.doVideo')}</p><Link className="btn primary" href={`/post?petition=${p.id}`}>{t('common.postVideo')}</Link></>;
  else if (!s.delivered_at) next = <><p style={{ margin: 0 }}>{t('dash.doDeliver', { target: p.target })}</p><Link className="btn primary" href={`/p/${p.id}/report`}>{t('p.report')}</Link></>;
  else if (!s.answer_link && !s.answered_at && live) next = <><p style={{ margin: 0 }}>{t('dash.doAnswer', { target: p.target })}</p><AnswerLink petitionId={p.id} target={p.target} /></>;
  else next = <><p style={{ margin: 0 }}>{t('dash.doUpdate')}</p><Link className="btn primary" href={`/p/${p.id}#updates`}>{t('p.next')}</Link></>;

  const tiles: [string, number][] = [
    [t('dash.total'), s.signatures], [t('dash.today'), s.today], [t('dash.week'), s.week], [t('dash.share'), s.via_share],
    [t('dash.reasons'), s.reasons], [t('dash.followers'), s.followers], [t('dash.videos'), s.videos],
  ];
  // the last 30 days, with empty days filled in so the bars line up with the calendar
  const byDay = new Map(s.days.map((x) => [String(x.d).slice(0, 10), Number(x.n)]));
  const days = [...Array(30)].map((_, k) => { const d = new Date(Date.now() - (29 - k) * 864e5).toISOString().slice(0, 10); return { d, n: byDay.get(d) ?? 0 }; });
  const max = Math.max(1, ...days.map((x) => x.n));
  const steps: [string, string | null][] = [
    ['dash.started', p.created_at], ['dash.delivered', s.delivered_at], ['dash.answered', s.answered_at], ['dash.wonOn', s.won_at],
  ];
  return (
    <div className="stack">
      {head}
      <section className="panel dash-next">
        <MyloArt mood={s.won_at ? 'cheering' : 'growing'} size={84} id="dash" label="" />
        <div className="stack" style={{ gap: 8, flex: 1, minWidth: 0 }}><span className="label">{t('dash.next')}</span>{next}</div>
      </section>
      <div className="tgrid">{tiles.map(([k, v]) => <div className="tile" key={k}><b>{n(v)}</b><span className="hint">{k}</span></div>)}</div>
      <section className="stack" style={{ gap: 8 }}><h2>{t('dash.days')}</h2>
        <div className="spark" role="img" aria-label={days.filter((x) => x.n).map((x) => `${day(x.d)}: ${x.n}`).join(', ') || t('dash.days')}>
          {days.map((x) => <i key={x.d} title={`${day(x.d)}: ${n(x.n)}`} style={{ height: `${Math.max(3, (x.n / max) * 100)}%` }} />)}</div></section>
      <section className="stack" style={{ gap: 8 }}><h2>{t('dash.milestones')}</h2>
        <ol className="milestones">{steps.map(([k, d]) => <li key={k} className={d ? 'done' : ''}>{d ? t(k as 'dash.started', { d: day(d) }) : t(k as 'dash.started', { d: '…' })}</li>)}</ol></section>
    </div>
  );
}
