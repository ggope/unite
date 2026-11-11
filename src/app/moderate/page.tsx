import { notFound } from 'next/navigation';
import { currentUser } from '@/lib/supabase/server';
import { review } from './actions';

export const dynamic = 'force-dynamic';

export default async function Moderate() {
  const { sb, user } = await currentUser();
  if (!user) notFound();
  const { data: me } = await sb.from('profiles').select('is_moderator').eq('id', user.id).single();
  if (!me?.is_moderator) notFound();
  const [{ data: pets }, { data: vids }, { data: reports }] = await Promise.all([
    sb.from('petitions').select('id, title, target, region, ask, why, source_url, organiser_name').eq('status', 'pending').order('created_at').limit(30),
    sb.from('videos').select('id, caption, storage_path, petition_id, petitions(title)').eq('status', 'pending').order('created_at').limit(30),
    sb.from('reports').select('id, reason, video_id, petition_id, created_at').order('created_at', { ascending: false }).limit(30),
  ]);
  const urls = vids?.length ? (await sb.storage.from('videos').createSignedUrls(vids.map((v: any) => v.storage_path), 3600)).data ?? [] : [];
  const Buttons = ({ kind, id }: { kind: string; id: string }) => (
    <form action={review} className="row"><input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={id} />
      <input name="note" placeholder="Note (optional)" style={{ flex: 1 }} />
      <button className="btn small primary" name="decision" value="approve">Approve</button><button className="btn small danger" name="decision" value="reject">Reject</button></form>
  );
  return (
    <div className="stack"><h1>Review queue</h1>
      <h2>Petitions ({pets?.length ?? 0})</h2>
      {pets?.map((p: any) => <div className="panel" key={p.id}><b>{p.title}</b><span className="hint">{p.organiser_name} → {p.target} · {p.region}</span><p style={{ margin: 0 }}>{p.ask}</p><p className="hint" style={{ margin: 0 }}>{p.why}</p>{p.source_url && <a href={p.source_url} target="_blank" rel="noopener nofollow">Source</a>}<Buttons kind="petition" id={p.id} /></div>)}
      <h2>Videos ({vids?.length ?? 0})</h2>
      {vids?.map((v: any, i: number) => <div className="panel" key={v.id}><b>{v.caption}</b><span className="hint">For: {v.petitions?.title}</span>{urls[i]?.signedUrl && <video src={urls[i].signedUrl} controls muted style={{ width: '100%', maxHeight: 360 }} />}<Buttons kind="video" id={v.id} /></div>)}
      <h2>Reports</h2>
      {reports?.map((r: any) => <div key={r.id} className="hint">{new Date(r.created_at).toLocaleString('en-GB')} · {r.reason} · {r.video_id ? 'video ' + r.video_id : 'petition ' + r.petition_id}</div>)}
    </div>
  );
}
