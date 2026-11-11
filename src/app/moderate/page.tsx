import { notFound } from 'next/navigation';
import { currentUser } from '@/lib/supabase/server';
import { review, importNews, newsAction, toggleSource } from './actions';

export const dynamic = 'force-dynamic';

export default async function Moderate() {
  const { sb, user } = await currentUser();
  if (!user) notFound();
  const { data: me } = await sb.from('profiles').select('is_moderator').eq('id', user.id).single();
  if (!me?.is_moderator) notFound();
  const [{ data: pets }, { data: vids }, { data: reports }, { data: sources }, { data: news }, { data: live }] = await Promise.all([
    sb.from('petitions').select('id, title, target, region, ask, why, source_url, organiser_name').eq('status', 'pending').order('created_at').limit(30),
    sb.from('videos').select('id, caption, storage_path, petition_id, petitions(title)').eq('status', 'pending').order('created_at').limit(30),
    sb.from('reports').select('id, reason, video_id, petition_id, created_at').order('created_at', { ascending: false }).limit(30),
    sb.from('news_sources').select('*').order('lang').order('name'),
    sb.from('news_items').select('id, url, title, topic, lang, status, petition_id, published_at, news_sources(name)').gte('published_at', new Date(Date.now() - 48 * 3.6e6).toISOString()).order('published_at', { ascending: false }).limit(60),
    sb.from('petitions').select('id, title').eq('status', 'live').order('created_at', { ascending: false }).limit(200),
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
      <h2>News</h2>
      <form action={importNews}><button className="btn primary">Import news now</button> <span className="hint">Also runs on its own once a day.</span></form>
      <div className="panel" style={{ gap: 6 }}><b>Sources</b>
        {sources?.map((s: any) => <form key={s.id} action={toggleSource} className="row between"><input type="hidden" name="id" value={s.id} /><input type="hidden" name="active" value={String(!s.active)} />
          <span style={{ flex: 1, minWidth: 0 }}>{s.active ? '' : '⏸ '}{s.name} <span className="hint">({s.lang}) · {s.last_fetched_at ? `${new Date(s.last_fetched_at).toLocaleString('en-GB')} · ${s.last_status} · +${s.last_count}` : 'never fetched'}</span></span>
          <button className="btn ghost small">{s.active ? 'Pause' : 'Resume'}</button></form>)}
      </div>
      <div className="panel" style={{ gap: 10 }}><b>Last 48 hours ({news?.length ?? 0})</b>
        {news?.map((n: any) => (
          <div key={n.id} className="stack" style={{ gap: 4, opacity: n.status === 'hidden' ? 0.45 : 1 }}>
            <a href={n.url} target="_blank" rel="noopener nofollow"><b>{n.title}</b></a>
            <span className="hint">{n.news_sources?.name} · {n.topic} · {n.lang} · {new Date(n.published_at).toLocaleString('en-GB')}{n.status === 'hidden' ? ' · hidden' : ''}</span>
            <form action={newsAction} className="row"><input type="hidden" name="id" value={n.id} />
              <select name="petition_id" defaultValue={n.petition_id ?? ''} style={{ flex: 1, minWidth: 0 }}><option value="">No petition attached</option>{live?.map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
              <button className="btn small" name="do" value="attach">Attach</button>
              {n.status !== 'hidden' && <button className="btn small danger" name="do" value="hide">Hide</button>}</form>
          </div>))}
      </div>
      <h2>Reports</h2>
      {reports?.map((r: any) => <div key={r.id} className="hint">{new Date(r.created_at).toLocaleString('en-GB')} · {r.reason} · {r.video_id ? 'video ' + r.video_id : 'petition ' + r.petition_id}</div>)}
    </div>
  );
}
