import type { Metadata } from 'next';
import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { loadViewer } from '@/lib/viewer';
import { TOPICS } from '@/lib/topics';
import { getT } from '@/lib/i18n/server';
import { fmtN, locale } from '@/lib/i18n/dict';
import { SignButton } from '@/components/SignButton';
import { FollowButton } from '@/components/FollowButton';
import { PostUpdate, RemoveUpdate } from '@/components/PostUpdate';
import { ReportButton } from '@/components/ReportButton';
import { ShareButton } from '@/components/ShareButton';
import { LinkBar } from '@/components/LinkBar';
import { AnswerLink } from '@/components/AnswerLink';
import { localize, isMachine } from '@/lib/petitionText';
import { after } from 'next/server';
import { needsTranslation, translatePetition } from '@/lib/ai/translate';
import { LANGS, type Lang } from '@/lib/i18n/langs';
import { easyOf } from '@/lib/easy';
import { MyloArt } from '@/components/mylo/MyloArt';
import { headers } from 'next/headers';
import { daysLeft, isEnded, silence, targetAnchor } from '@/lib/lifecycle';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const sb = await supabaseServer();
  const [{ data: p }, { data: st }, { lang, t }] = await Promise.all([
    sb.from('petitions').select('title, ask, target, lang, tr').eq('id', id).maybeSingle(),
    sb.from('petition_stats').select('combined').eq('id', id).maybeSingle(),
    getT(),
  ]);
  if (!p) return {};
  Object.assign(p, localize(p, lang));
  const description = `${fmtN(Number(st?.combined ?? 0), lang)} ${t('p.signatures')} · ${p.ask}`.slice(0, 200);
  return { title: `${p.title} · UNIER`, description, openGraph: { title: p.title, description, type: 'article', siteName: 'UNIER' }, twitter: { card: 'summary_large_image', title: p.title, description } };
}

export default async function Petition({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ orig?: string }> }) {
  const [{ id }, { orig }] = await Promise.all([params, searchParams]);
  const [{ sb, user, viewer, signed, followed }, { lang, t }] = await Promise.all([loadViewer(), getT()]);
  const fmt = (n: number) => fmtN(n, lang);
  const { data: raw } = await sb.from('petitions').select('*').eq('id', id).maybeSingle();
  if (!raw) notFound();
  // automatic translations (0026): label them, and let the reader switch to the original
  const machine = isMachine(raw, lang); const showOrig = machine && orig === '1';
  const p = showOrig ? raw : localize(raw, lang);
  const textLang = showOrig || (raw.lang !== lang && p.title === raw.title) ? (raw.lang ?? 'en') : lang;   // for screen readers
  if (needsTranslation(raw)) after(() => translatePetition(raw).then(() => undefined, () => undefined));
  const easy = easyOf(raw, lang);   // the easy-read version for kids (0019)
  const [{ data: st }, { data: members }, { data: updates }, { data: videos }, friends, { data: me }, { data: news }, { data: reasons }] = await Promise.all([
    sb.from('petition_stats').select('*').eq('id', id).maybeSingle(),
    p.cluster_id ? sb.from('petitions').select('id, title, organiser_name, origin, petition_stats(signatures)').eq('cluster_id', p.cluster_id) : Promise.resolve({ data: [] as any[] }),
    sb.from('petition_updates').select('*').eq('petition_id', id).order('created_at', { ascending: false }),
    sb.from('video_feed').select('id, caption, uploader_handle, role').eq('petition_id', id).limit(20),
    user ? sb.rpc('friends_who_signed', { p_petition: id }) : Promise.resolve({ data: [] as any[] }),
    user ? sb.from('profiles').select('is_moderator').eq('id', user.id).maybeSingle() : Promise.resolve({ data: null as any }),
    sb.from('news_items').select('id, url, title, published_at, news_sources(name)').eq('petition_id', id).order('published_at', { ascending: false }).limit(10),
    sb.rpc('public_reasons', { p_petition: id, p_limit: 8 }),   // empty until 0016 has run; the report flag needs 0017
  ]);
  const { data: sources } = p.origin === 'team' ? await sb.from('petition_sources').select('url, outlet, title, published_at').eq('petition_id', id).order('published_at', { ascending: false }) : { data: null };   // 0023
  const combined = Number(st?.combined ?? 0);
  const isFounder = user && p.created_by === user.id;
  // after the end date signing stops, but the organiser keeps posting what happened next
  const ended = isEnded(p); const open = p.status === 'live' && !ended;
  const canUpdate = !!user && (p.status === 'live' || p.status === 'closed') && (isFounder || !!me?.is_moderator);
  const left = open ? daysLeft(p.ends_on) : null;
  const sil = silence(updates);
  const date = (d: string) => new Date(d).toLocaleDateString(locale(lang), { year: 'numeric', month: 'long', day: 'numeric' });
  const stat = (m: any) => (Array.isArray(m.petition_stats) ? m.petition_stats[0] : m.petition_stats)?.signatures ?? 0;

  const h = await headers(); const origin = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}`;
  return (
    <div className="stack">
      <Link href="/petitions" className="hint">{t('p.back')}</Link>
      {p.status === 'pending' && <p className="note">{t('p.pending')}</p>}
      {p.status === 'removed' && <p className="note">{t('p.removed')}{p.moderation_note ? ` ${t('mod.reason', { r: p.moderation_note })}` : ''}{isFounder && <> <Link href={`/appeal?kind=petition&id=${p.id}`}>{t('appeal.ask')}</Link></>}</p>}
      <span className="hint">{t(`topic.${p.topic as keyof typeof TOPICS}`)} · {t('p.startedBy', { name: p.organiser_name })} · {p.region}</span>
      <h1 lang={textLang}>{p.title}</h1>
      {machine && <p className="mt-note hint" lang={lang}><span>{showOrig ? t('tr.original', { lang: LANGS[(raw.lang ?? 'en') as Lang] ?? raw.lang }) : t('tr.machine', { lang: LANGS[(raw.lang ?? 'en') as Lang] ?? raw.lang })}</span>
        <Link href={showOrig ? `/p/${p.id}` : `/p/${p.id}?orig=1`} replace scroll={false}>{showOrig ? t('tr.showTranslation') : t('tr.showOriginal')}</Link></p>}
      {p.origin === 'team' && <span className="team-tag">{t('team.by')}</span>}
      <p className="muted" style={{ margin: 0 }}>{t('p.to', { target: p.target })}</p>
      {easy && (
        <aside className="easy-box" lang={lang} aria-labelledby="easy-h">
          <MyloArt mood="happy" size={56} id="easy" label="" />
          <div className="stack" style={{ gap: 4 }}>
            <span className="label" id="easy-h">{t('p.easy')}</span>
            <b>{easy.title}</b>
            <span>{easy.text}</span>
            <Link className="hint" href="/kids">{t('p.easyKids')} →</Link>
          </div>
        </aside>
      )}
      <div className="panel">
        <div><span className="bignum">{fmt(combined)}</span> <span className="muted">{Number(st?.united_count) > 1 ? t('p.acrossUnited') : t('p.signatures')}</span></div>
        <span className="prog" style={{ height: 14 }} role="progressbar" aria-label={t('p.goal', { n: fmt(p.goal) })} aria-valuemin={0} aria-valuemax={p.goal} aria-valuenow={Math.min(combined, p.goal)} aria-valuetext={`${fmt(combined)} / ${fmt(p.goal)}`}><i style={{ width: `${Math.min(100, combined / p.goal * 100)}%` }} /></span>
        <span className="hint">{t('p.goal', { n: fmt(p.goal) })} · {t('p.lastHour', { n: fmt(Number(st?.last_hour ?? 0)) })}{left != null ? ` · ${left === 0 ? t('life.lastDay') : left === 1 ? t('life.tomorrow', { d: date(p.ends_on) }) : t('life.daysLeft', { n: left, d: date(p.ends_on) })}` : ''}</span>
        {!!friends.data?.length && <span className="hint">{(() => { const names = friends.data.map((f: any) => f.display_name || '@' + f.handle).slice(0, 3).join(', '); return friends.data.length > 3 ? t('p.friendsMore', { names, n: friends.data.length - 3 }) : t('p.friendsSigned', { names }); })()}</span>}
        {/* one clear main action; the rest is folded under "More" */}
        {open && <div className="sign-main"><SignButton petitionId={p.id} title={p.title} signed={signed.has(p.id)} viewer={viewer} /></div>}
        <div className="row p-actions">
          <FollowButton petitionId={p.id} following={followed.has(p.id)} loggedIn={viewer.loggedIn} />
          <ShareButton path={`/p/${p.id}`} title={p.title} />
          {(isFounder || !!me?.is_moderator) && <Link className="btn small" href={`/p/${p.id}/dashboard`}>{t('dash.open')}</Link>}
        </div>
        <details className="more-actions">
          <summary className="btn ghost small">{t('p.more')}</summary>
          <div className="row">
            {(isFounder || signed.has(p.id)) && open && <Link className="btn ghost small" href={`/post?petition=${p.id}`}>{t('common.postVideo')}</Link>}
            <a className="btn ghost small" href={`/api/card/${p.id}`} target="_blank" rel="noopener">{t('sign.shareCard')}</a>
            {(p.status === 'live' || p.status === 'closed') && <Link className="btn ghost small" href={`/p/${p.id}/report`}>{t('p.report')}</Link>}
            {!isFounder && (p.status === 'live' || p.status === 'closed') && <ReportButton petitionId={p.id} loggedIn={viewer.loggedIn} />}
          </div>
        </details>
      </div>
      {ended && <section className="panel life-closed" role="status"><b>{t('life.closed', { d: date(p.closed_at ?? p.ends_on ?? p.created_at), n: fmt(combined) })}</b>
        {!sil.delivered && <span className="hint">{isFounder ? t('life.deliverYou', { target: p.target }) : t('life.deliverNext', { target: p.target })}</span>}
        {isFounder && !sil.delivered && <Link className="btn primary small" href={`/p/${p.id}/report`}>{t('p.report')}</Link>}</section>}
      {sil.silentDays != null && <section className="panel silence">
        <div className="silence-n"><span className="bignum num">{fmt(sil.silentDays)}</span><b>{t('sil.label', { target: p.target })}</b></div>
        <span className="hint">{t('sil.since', { d: date(sil.delivered!), target: p.target })}</span>
        <Link href={`/targets#${targetAnchor(raw.target)}`}>{t('sil.board')} →</Link></section>}
      {sil.answeredAfter != null && <p className="hint" style={{ margin: 0 }}>{sil.answeredAfter === 0 ? t('sil.answeredSameDay', { target: p.target }) : sil.answeredAfter === 1 ? t('sil.answeredNextDay', { target: p.target }) : t('sil.answeredAfter', { n: sil.answeredAfter, target: p.target })}</p>}
      {p.link_url && <LinkBar url={p.link_url} cta={p.link_cta} />}
      {p.official_url && p.status === 'live' && (
        <section className="panel official"><b>{t('off.title')}</b><p className="muted" style={{ margin: 0 }}>{t('off.text')}</p>
          <a className="btn small" href={p.official_url} target="_blank" rel="noopener nofollow">{t('off.go')} ↗</a></section>
      )}
      <section className="stack" style={{ gap: 8 }}><h2>{t('p.asks')}</h2><p style={{ margin: 0 }} lang={textLang}>{p.ask}</p><h2>{t('p.whyMatters')}</h2><p style={{ margin: 0 }} lang={textLang}>{p.why}</p>
        {sources?.length ? <><h2>{t('team.sources')}</h2><p className="hint" style={{ margin: 0 }}>{t('team.about')}</p>
          <ul className="team-sources">{sources.map((s: any) => <li key={s.url}><a href={s.url} target="_blank" rel="noopener nofollow">{s.title || s.outlet}</a> <span className="hint">· {s.outlet}{s.published_at ? ` · ${date(s.published_at)}` : ''}</span></li>)}</ul></>
          : p.source_url && <a href={p.source_url} target="_blank" rel="noopener nofollow">{t('p.source')}</a>}</section>
      {(members?.length ?? 0) > 1 && (
        <section className="panel"><span className="label">{t('p.unitedLabel')}</span>
          <p style={{ margin: 0 }}>{t('p.unitedText', { n: members!.length })}</p>
          {members!.map((m: any) => <div className="row between" key={m.id}><Link href={`/p/${m.id}`}>{m.title}</Link><span className="num">{fmt(stat(m))}</span></div>)}
        </section>
      )}
      <section className="stack" style={{ gap: 8 }} id="updates"><h2>{t('p.next')}</h2>
        {canUpdate && <PostUpdate petitionId={p.id} userId={user!.id} />}
        {updates?.length ? updates.map((u: any) => <div key={u.id} className={u.via_link ? 'official-answer' : undefined}>{u.via_link && <div className="upd-head"><span className="badge-answer">{t('ans.badge')}</span><ReportButton updateId={u.id} loggedIn={!!user} variant="mini" /></div>}<b>{u.title}</b><div className="hint">{u.via_link ? t('ans.via') : t(`kind.${u.kind as 'win'}`)} · {new Date(u.created_at).toLocaleDateString(locale(lang))}</div>{u.body && <p style={{ margin: '4px 0 0', whiteSpace: 'pre-line' }}>{u.body}</p>}{user && (u.created_by === user.id || me?.is_moderator) && <RemoveUpdate id={u.id} />}</div>)
          : <p className="note">{t('p.noUpdates')}</p>}
      </section>
      {canUpdate && <AnswerLink petitionId={p.id} target={p.target} />}
      {!!reasons?.length && <section className="stack" style={{ gap: 8 }}><h2>{t('p.reasons')}</h2>
        <ul className="reasons">{reasons.map((r: any, k: number) => <li key={r.rid ?? k}><span>“{r.why}”</span>{r.rid && <ReportButton reasonKey={r.rid} loggedIn={!!user} variant="mini" />}</li>)}</ul></section>}
      {!!news?.length && <section className="stack" style={{ gap: 8 }}><h2>{t('news.title')}</h2>
        {news.map((n: any) => <div key={n.id}><a href={n.url} target="_blank" rel="noopener nofollow"><b>{n.title}</b></a><div className="hint">{n.news_sources?.name} · {new Date(n.published_at).toLocaleDateString(locale(lang))}</div></div>)}</section>}
      {!!videos?.length && <section className="stack" style={{ gap: 8 }}><h2>{t('p.videos')}</h2>
        {videos.map((v: any) => <div key={v.id}><b>{v.caption}</b><div className="hint">{v.uploader_handle ? <Link href={`/u/${v.uploader_handle}`}>@{v.uploader_handle}</Link> : null} <span className={`role ${v.role}`}>({t(`role.${v.role as 'founder' | 'supporter'}`)})</span></div></div>)}</section>}
      {(p.status === 'live' || p.status === 'closed') && (
        <details className="panel embed"><summary>{t('embed.title')}</summary>
          <p className="hint" style={{ margin: 0 }}>{t('embed.hint')}</p>
          <textarea readOnly rows={3} aria-label={t('embed.title')} value={`<iframe src="${origin}/embed/${p.id}?lang=${lang}" width="100%" height="250" style="border:0;max-width:480px" title="${p.title.replace(/"/g, '&quot;')} · UNIER" loading="lazy"></iframe>`} />
        </details>)}
    </div>
  );
}
