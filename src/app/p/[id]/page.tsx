import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadViewer } from '@/lib/viewer';
import { TOPICS, ROLE_LABEL, fmt } from '@/lib/topics';
import { SignButton } from '@/components/SignButton';
import { FollowButton } from '@/components/FollowButton';

export const dynamic = 'force-dynamic';

export default async function Petition({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sb, user, viewer, signed, followed } = await loadViewer();
  const { data: p } = await sb.from('petitions').select('*').eq('id', id).maybeSingle();
  if (!p) notFound();
  const [{ data: st }, { data: members }, { data: updates }, { data: videos }, friends] = await Promise.all([
    sb.from('petition_stats').select('*').eq('id', id).maybeSingle(),
    p.cluster_id ? sb.from('petitions').select('id, title, organiser_name, origin, petition_stats(signatures)').eq('cluster_id', p.cluster_id) : Promise.resolve({ data: [] as any[] }),
    sb.from('petition_updates').select('*').eq('petition_id', id).order('created_at', { ascending: false }),
    sb.from('video_feed').select('id, caption, uploader_handle, role').eq('petition_id', id).limit(20),
    user ? sb.rpc('friends_who_signed', { p_petition: id }) : Promise.resolve({ data: [] as any[] }),
  ]);
  const combined = Number(st?.combined ?? 0);
  const isFounder = user && p.created_by === user.id;
  const stat = (m: any) => (Array.isArray(m.petition_stats) ? m.petition_stats[0] : m.petition_stats)?.signatures ?? 0;

  return (
    <div className="stack">
      <Link href="/petitions" className="hint">← Petitions</Link>
      {p.status === 'pending' && <p className="note">This petition is waiting for review. Only you can see it until it is approved.</p>}
      <span className="hint">{TOPICS[p.topic as keyof typeof TOPICS].label} · Started by {p.organiser_name} · {p.region}</span>
      <h1>{p.title}</h1>
      <p className="muted" style={{ margin: 0 }}>To: {p.target}</p>
      <div className="panel">
        <div><span className="num" style={{ fontSize: 40, fontWeight: 700 }}>{fmt(combined)}</span> <span className="muted">signatures{Number(st?.united_count) > 1 ? ' across united petitions' : ''}</span></div>
        <span className="prog" style={{ height: 8 }}><i style={{ width: `${Math.min(100, combined / p.goal * 100)}%` }} /></span>
        <span className="hint">Goal {fmt(p.goal)} · +{fmt(Number(st?.last_hour ?? 0))} in the last hour{p.ends_on ? ` · Ends ${p.ends_on}` : ''}</span>
        {!!friends.data?.length && <span className="hint">{friends.data.map((f: any) => f.display_name || '@' + f.handle).slice(0, 3).join(', ')}{friends.data.length > 3 ? ` and ${friends.data.length - 3} more friends` : ''} signed</span>}
        <div className="row">
          {p.status === 'live' && <SignButton petitionId={p.id} title={p.title} signed={signed.has(p.id)} viewer={viewer} />}
          <FollowButton petitionId={p.id} following={followed.has(p.id)} loggedIn={viewer.loggedIn} />
          <a className="btn ghost small" href={`/api/card/${p.id}`} target="_blank" rel="noopener">Share card</a>
          {(isFounder || signed.has(p.id)) && p.status === 'live' && <Link className="btn ghost small" href={`/post?petition=${p.id}`}>Post a video</Link>}
        </div>
      </div>
      <section className="stack" style={{ gap: 8 }}><h2>What it asks for</h2><p style={{ margin: 0 }}>{p.ask}</p><h2>Why it matters</h2><p style={{ margin: 0 }}>{p.why}</p>
        {p.source_url && <a href={p.source_url} target="_blank" rel="noopener nofollow">Source</a>}</section>
      {(members?.length ?? 0) > 1 && (
        <section className="panel"><span className="label">United petition</span>
          <p style={{ margin: 0 }}>{members!.length} petitions ask for the same thing. Each keeps its own signatures; the total is shown above.</p>
          {members!.map((m: any) => <div className="row between" key={m.id}><Link href={`/p/${m.id}`}>{m.title}</Link><span className="num">{fmt(stat(m))}</span></div>)}
        </section>
      )}
      <section className="stack" style={{ gap: 8 }}><h2>What happened next</h2>
        {updates?.length ? updates.map((u: any) => <div key={u.id}><b>{u.title}</b><div className="hint">{u.kind} · {new Date(u.created_at).toLocaleDateString('en-GB')}</div>{u.body && <p style={{ margin: '4px 0 0' }}>{u.body}</p>}</div>)
          : <p className="note">No updates yet. Follow or sign to hear the next step.</p>}
      </section>
      {!!videos?.length && <section className="stack" style={{ gap: 8 }}><h2>Videos from supporters</h2>
        {videos.map((v: any) => <div key={v.id}><b>{v.caption}</b><div className="hint">@{v.uploader_handle} <span className={`role ${v.role}`}>({ROLE_LABEL[v.role as 'founder' | 'supporter']})</span></div></div>)}</section>}
    </div>
  );
}
