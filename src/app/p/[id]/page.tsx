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

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const sb = await supabaseServer();
  const [{ data: p }, { data: st }, { lang, t }] = await Promise.all([
    sb.from('petitions').select('title, ask, target').eq('id', id).maybeSingle(),
    sb.from('petition_stats').select('combined').eq('id', id).maybeSingle(),
    getT(),
  ]);
  if (!p) return {};
  const description = `${fmtN(Number(st?.combined ?? 0), lang)} ${t('p.signatures')} · ${p.ask}`.slice(0, 200);
  return { title: `${p.title} · UNIER`, description, openGraph: { title: p.title, description, type: 'article', siteName: 'UNIER' }, twitter: { card: 'summary_large_image', title: p.title, description } };
}

export default async function Petition({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ sb, user, viewer, signed, followed }, { lang, t }] = await Promise.all([loadViewer(), getT()]);
  const fmt = (n: number) => fmtN(n, lang);
  const { data: p } = await sb.from('petitions').select('*').eq('id', id).maybeSingle();
  if (!p) notFound();
  const [{ data: st }, { data: members }, { data: updates }, { data: videos }, friends, { data: me }, { data: news }] = await Promise.all([
    sb.from('petition_stats').select('*').eq('id', id).maybeSingle(),
    p.cluster_id ? sb.from('petitions').select('id, title, organiser_name, origin, petition_stats(signatures)').eq('cluster_id', p.cluster_id) : Promise.resolve({ data: [] as any[] }),
    sb.from('petition_updates').select('*').eq('petition_id', id).order('created_at', { ascending: false }),
    sb.from('video_feed').select('id, caption, uploader_handle, role').eq('petition_id', id).limit(20),
    user ? sb.rpc('friends_who_signed', { p_petition: id }) : Promise.resolve({ data: [] as any[] }),
    user ? sb.from('profiles').select('is_moderator').eq('id', user.id).maybeSingle() : Promise.resolve({ data: null as any }),
    sb.from('news_items').select('id, url, title, published_at, news_sources(name)').eq('petition_id', id).order('published_at', { ascending: false }).limit(10),
  ]);
  const combined = Number(st?.combined ?? 0);
  const isFounder = user && p.created_by === user.id;
  const canUpdate = !!user && p.status === 'live' && (isFounder || !!me?.is_moderator);
  const stat = (m: any) => (Array.isArray(m.petition_stats) ? m.petition_stats[0] : m.petition_stats)?.signatures ?? 0;

  return (
    <div className="stack">
      <Link href="/petitions" className="hint">{t('p.back')}</Link>
      {p.status === 'pending' && <p className="note">{t('p.pending')}</p>}
      {p.status === 'removed' && <p className="note">{t('p.removed')}{p.moderation_note ? ` ${t('mod.reason', { r: p.moderation_note })}` : ''}</p>}
      <span className="hint">{t(`topic.${p.topic as keyof typeof TOPICS}`)} · {t('p.startedBy', { name: p.organiser_name })} · {p.region}</span>
      <h1>{p.title}</h1>
      <p className="muted" style={{ margin: 0 }}>{t('p.to', { target: p.target })}</p>
      <div className="panel">
        <div><span className="bignum">{fmt(combined)}</span> <span className="muted">{Number(st?.united_count) > 1 ? t('p.acrossUnited') : t('p.signatures')}</span></div>
        <span className="prog" style={{ height: 14 }}><i style={{ width: `${Math.min(100, combined / p.goal * 100)}%` }} /></span>
        <span className="hint">{t('p.goal', { n: fmt(p.goal) })} · {t('p.lastHour', { n: fmt(Number(st?.last_hour ?? 0)) })}{p.ends_on ? ` · ${t('p.ends', { d: new Date(p.ends_on).toLocaleDateString(locale(lang)) })}` : ''}</span>
        {!!friends.data?.length && <span className="hint">{(() => { const names = friends.data.map((f: any) => f.display_name || '@' + f.handle).slice(0, 3).join(', '); return friends.data.length > 3 ? t('p.friendsMore', { names, n: friends.data.length - 3 }) : t('p.friendsSigned', { names }); })()}</span>}
        <div className="row">
          {p.status === 'live' && <SignButton petitionId={p.id} title={p.title} signed={signed.has(p.id)} viewer={viewer} />}
          <FollowButton petitionId={p.id} following={followed.has(p.id)} loggedIn={viewer.loggedIn} />
          <ShareButton path={`/p/${p.id}`} title={p.title} />
          <a className="btn ghost small" href={`/api/card/${p.id}`} target="_blank" rel="noopener">{t('sign.shareCard')}</a>
          {(p.status === 'live' || p.status === 'closed') && <Link className="btn ghost small" href={`/p/${p.id}/report`}>{t('p.report')}</Link>}
          {!isFounder && p.status === 'live' && <ReportButton petitionId={p.id} loggedIn={viewer.loggedIn} />}
          {(isFounder || signed.has(p.id)) && p.status === 'live' && <Link className="btn ghost small" href={`/post?petition=${p.id}`}>{t('common.postVideo')}</Link>}
        </div>
      </div>
      {p.official_url && p.status === 'live' && (
        <section className="panel official"><b>{t('off.title')}</b><p className="muted" style={{ margin: 0 }}>{t('off.text')}</p>
          <a className="btn small" href={p.official_url} target="_blank" rel="noopener nofollow">{t('off.go')} ↗</a></section>
      )}
      <section className="stack" style={{ gap: 8 }}><h2>{t('p.asks')}</h2><p style={{ margin: 0 }}>{p.ask}</p><h2>{t('p.whyMatters')}</h2><p style={{ margin: 0 }}>{p.why}</p>
        {p.source_url && <a href={p.source_url} target="_blank" rel="noopener nofollow">{t('p.source')}</a>}</section>
      {(members?.length ?? 0) > 1 && (
        <section className="panel"><span className="label">{t('p.unitedLabel')}</span>
          <p style={{ margin: 0 }}>{t('p.unitedText', { n: members!.length })}</p>
          {members!.map((m: any) => <div className="row between" key={m.id}><Link href={`/p/${m.id}`}>{m.title}</Link><span className="num">{fmt(stat(m))}</span></div>)}
        </section>
      )}
      <section className="stack" style={{ gap: 8 }}><h2>{t('p.next')}</h2>
        {canUpdate && <PostUpdate petitionId={p.id} userId={user!.id} />}
        {updates?.length ? updates.map((u: any) => <div key={u.id}><b>{u.title}</b><div className="hint">{t(`kind.${u.kind as 'win'}`)} · {new Date(u.created_at).toLocaleDateString(locale(lang))}</div>{u.body && <p style={{ margin: '4px 0 0' }}>{u.body}</p>}{user && (u.created_by === user.id || me?.is_moderator) && <RemoveUpdate id={u.id} />}</div>)
          : <p className="note">{t('p.noUpdates')}</p>}
      </section>
      {!!news?.length && <section className="stack" style={{ gap: 8 }}><h2>{t('news.title')}</h2>
        {news.map((n: any) => <div key={n.id}><a href={n.url} target="_blank" rel="noopener nofollow"><b>{n.title}</b></a><div className="hint">{n.news_sources?.name} · {new Date(n.published_at).toLocaleDateString(locale(lang))}</div></div>)}</section>}
      {!!videos?.length && <section className="stack" style={{ gap: 8 }}><h2>{t('p.videos')}</h2>
        {videos.map((v: any) => <div key={v.id}><b>{v.caption}</b><div className="hint">{v.uploader_handle ? <Link href={`/u/${v.uploader_handle}`}>@{v.uploader_handle}</Link> : null} <span className={`role ${v.role}`}>({t(`role.${v.role as 'founder' | 'supporter'}`)})</span></div></div>)}</section>}
    </div>
  );
}
