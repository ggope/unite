import Link from 'next/link';
import { notFound } from 'next/navigation';
import { currentUser } from '@/lib/supabase/server';
import { fmtN } from '@/lib/i18n/dict';
import { review, petitionStatus, unite, separate, resolveReport, setModerator, importNews, newsAction, toggleSource } from './actions';

export const dynamic = 'force-dynamic';
const TABS = [['overview', 'Overview'], ['queue', 'Review queue'], ['reports', 'Reports'], ['petitions', 'Petitions'], ['news', 'News'], ['people', 'People']] as const;
type Tab = (typeof TABS)[number][0];
const when = (d: string) => new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const n = (x: number) => fmtN(x, 'en');

export default async function Admin({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; err?: string }> }) {
  const { sb, user } = await currentUser();
  if (!user) notFound();
  const { data: me } = await sb.from('profiles').select('is_moderator').eq('id', user.id).single();
  if (!me?.is_moderator) notFound();
  const { tab: raw = 'overview', q = '', err } = await searchParams;
  const tab = (TABS.some(([k]) => k === raw) ? raw : 'overview') as Tab;
  const { data: stats } = await sb.rpc('admin_stats');
  const st = (stats ?? {}) as Record<string, number>;
  const badge: Partial<Record<Tab, number>> = { queue: (st.petitions_pending ?? 0) + (st.videos_pending ?? 0), reports: st.reports_open ?? 0 };

  return (
    <div className="stack admin">
      <div className="row between"><h1>Admin</h1><Link className="hint" href="/">← Back to UNIER</Link></div>
      <nav className="chips" aria-label="Admin sections">
        {TABS.map(([k, label]) => <Link key={k} className="chip" aria-pressed={tab === k} href={`/admin?tab=${k}`}>{label}{badge[k] ? ` · ${badge[k]}` : ''}</Link>)}
      </nav>
      {err && <p className="error" role="alert">That did not work: {err}</p>}
      {tab === 'overview' && <Overview st={st} sb={sb} />}
      {tab === 'queue' && <Queue sb={sb} />}
      {tab === 'reports' && <Reports sb={sb} />}
      {tab === 'petitions' && <Petitions sb={sb} q={q} />}
      {tab === 'news' && <News sb={sb} />}
      {tab === 'people' && <People sb={sb} q={q} me={user.id} />}
    </div>
  );
}

async function Overview({ st, sb }: { st: Record<string, number>; sb: any }) {
  const { data: live } = await sb.from('petitions').select('id, title, petition_stats(combined, last_hour)').eq('status', 'live').limit(500);
  const one = (x: any) => (Array.isArray(x) ? x[0] : x) ?? {};
  const hot = (live ?? []).map((p: any) => ({ id: p.id, title: p.title, combined: Number(one(p.petition_stats).combined ?? 0), last_hour: Number(one(p.petition_stats).last_hour ?? 0) }))
    .sort((a: any, b: any) => b.last_hour - a.last_hour || b.combined - a.combined).slice(0, 8);
  const tiles: [string, number, string?][] = [
    ['People', st.people ?? 0, `+${n(st.people_7d ?? 0)} this week`], ['Signatures', st.signatures ?? 0, `+${n(st.signatures_24h ?? 0)} in 24 h`],
    ['Live petitions', st.petitions_live ?? 0], ['Live videos', st.videos_live ?? 0],
    ['Waiting for review', (st.petitions_pending ?? 0) + (st.videos_pending ?? 0)], ['Open reports', st.reports_open ?? 0],
    ['Updates posted', st.updates_7d ?? 0, 'this week'], ['News imported', st.news_24h ?? 0, 'in 24 h'],
  ];
  return (<>
    <div className="tiles">{tiles.map(([k, v, sub]) => <div className="tile" key={k}><span className="label">{k}</span><b className="num">{n(v)}</b>{sub && <span className="hint">{sub}</span>}</div>)}</div>
    <div className="panel"><b>Moving fastest right now</b>
      {hot?.length ? hot.map((h: any) => <div className="row between" key={h.id}><Link href={`/p/${h.id}`} style={{ flex: 1, minWidth: 0 }}>{h.title}</Link><span className="hint num">+{n(h.last_hour)}/h · {n(h.combined)}</span></div>) : <p className="hint" style={{ margin: 0 }}>No live petitions yet.</p>}
    </div>
  </>);
}

const Decide = ({ kind, id }: { kind: string; id: string }) => (
  <form action={review} className="row"><input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={id} />
    <input name="note" placeholder="Reason if not approved (the author sees this)" style={{ flex: 1, minWidth: 0 }} />
    <button className="btn small primary" name="decision" value="approve">Approve</button><button className="btn small danger" name="decision" value="reject">Reject</button></form>
);

async function Queue({ sb }: { sb: any }) {
  const [{ data: pets }, { data: vids }] = await Promise.all([
    sb.from('petitions').select('id, title, target, region, ask, why, source_url, organiser_name, topic, goal, created_at').eq('status', 'pending').order('created_at').limit(30),
    sb.from('videos').select('id, caption, storage_path, petition_id, created_at, blur_faces, audience, petitions(title)').eq('status', 'pending').order('created_at').limit(30),
  ]);
  const urls = vids?.length ? (await sb.storage.from('videos').createSignedUrls(vids.map((v: any) => v.storage_path), 3600)).data ?? [] : [];
  return (<>
    <h2>Petitions ({pets?.length ?? 0})</h2>
    {pets?.length ? pets.map((p: any) => <div className="panel" key={p.id}><b>{p.title}</b><span className="hint">{p.organiser_name} → {p.target} · {p.region} · {p.topic} · goal {n(p.goal)} · {when(p.created_at)}</span><p style={{ margin: 0 }}>{p.ask}</p><p className="hint" style={{ margin: 0 }}>{p.why}</p>{p.source_url && <a href={p.source_url} target="_blank" rel="noopener nofollow">Source</a>}<Decide kind="petition" id={p.id} /></div>) : <p className="hint">Nothing waiting.</p>}
    <h2>Videos ({vids?.length ?? 0})</h2>
    {vids?.length ? vids.map((v: any, i: number) => <div className="panel" key={v.id}><b>{v.caption}</b><span className="hint">For: {v.petitions?.title} · {v.audience === 'friends' ? 'friends only · ' : ''}{when(v.created_at)}</span>{v.blur_faces && <p className="error" style={{ margin: 0 }}>The uploader says other people can be recognised. Approve only if they clearly agreed to be filmed or cannot be identified.</p>}{urls[i]?.signedUrl && <video src={urls[i].signedUrl} controls muted playsInline style={{ width: '100%', maxHeight: 420, background: '#000', borderRadius: 10 }} />}<Decide kind="video" id={v.id} /></div>) : <p className="hint">Nothing waiting.</p>}
  </>);
}

async function Reports({ sb }: { sb: any }) {
  const { data: reports } = await sb.from('reports').select('id, reason, video_id, petition_id, created_at, videos(caption, storage_path), petitions(title)').eq('status', 'open').order('created_at').limit(50);
  return (<>
    <p className="hint" style={{ margin: 0 }}>Removing something sends your reason to its author. Dismiss keeps it online.</p>
    {reports?.length ? reports.map((r: any) => (
      <div className="panel" key={r.id}>
        <span className="hint">{when(r.created_at)} · {r.video_id ? 'Video' : 'Petition'}</span>
        <b>{r.video_id ? r.videos?.caption : <Link href={`/p/${r.petition_id}`}>{r.petitions?.title}</Link>}</b>
        <p style={{ margin: 0 }}>“{r.reason}”</p>
        <form action={resolveReport} className="row"><input type="hidden" name="report_id" value={r.id} /><input type="hidden" name="video_id" value={r.video_id ?? ''} /><input type="hidden" name="petition_id" value={r.petition_id ?? ''} />
          <input name="note" placeholder="Reason shown to the author if removed" style={{ flex: 1, minWidth: 0 }} />
          <button className="btn small" name="action" value="dismiss">Dismiss</button><button className="btn small danger" name="action" value="remove">Remove</button></form>
      </div>)) : <p className="hint">No open reports.</p>}
  </>);
}

async function Petitions({ sb, q }: { sb: any; q: string }) {
  let query = sb.from('petitions').select('id, title, status, cluster_id, organiser_name, created_at, petition_stats(combined)').order('created_at', { ascending: false }).limit(60);
  if (q) query = query.ilike('title', `%${q}%`);
  const [{ data: ps }, { data: all }] = await Promise.all([query, sb.from('petitions').select('id, title').eq('status', 'live').order('title').limit(500)]);
  return (<>
    <LiveList items={all} />
    <form className="field" action="/admin"><input type="hidden" name="tab" value="petitions" /><input name="q" type="search" defaultValue={q} placeholder="Search petitions" aria-label="Search petitions" /></form>
    {ps?.map((p: any) => (
      <div className="panel" key={p.id} style={{ gap: 8 }}>
        <div className="row between"><Link href={`/p/${p.id}`} style={{ flex: 1, minWidth: 0 }}><b>{p.title}</b></Link><span className="hint">{p.status} · {n(Number((Array.isArray(p.petition_stats) ? p.petition_stats[0] : p.petition_stats)?.combined ?? 0))}{p.cluster_id ? ' · united' : ''}</span></div>
        <form action={petitionStatus} className="row"><input type="hidden" name="id" value={p.id} />
          <input name="note" placeholder="Reason if removing" style={{ flex: 1, minWidth: 0 }} />
          {p.status !== 'live' && <button className="btn small" name="status" value="live">Make live</button>}
          {p.status === 'live' && <button className="btn small" name="status" value="closed">Close</button>}
          {p.status !== 'removed' && <button className="btn small danger" name="status" value="removed">Remove</button>}</form>
        {p.status === 'live' && <form action={unite} className="row"><input type="hidden" name="id" value={p.id} />
          <input name="with" list="live-petitions" required placeholder="Unite with… (type a title or paste a link)" style={{ flex: 1, minWidth: 0 }} />
          <button className="btn small">Unite</button></form>}
        {p.cluster_id && <form action={separate}><input type="hidden" name="id" value={p.id} /><button className="btn ghost small">Separate from its group</button></form>}
      </div>))}
  </>);
}

async function News({ sb }: { sb: any }) {
  const [{ data: sources }, { data: news }, { data: live }] = await Promise.all([
    sb.from('news_sources').select('*').order('lang').order('name'),
    sb.from('news_items').select('id, url, title, topic, lang, status, petition_id, published_at, news_sources(name)').gte('published_at', new Date(Date.now() - 48 * 3.6e6).toISOString()).order('published_at', { ascending: false }).limit(80),
    sb.from('petitions').select('id, title').eq('status', 'live').order('title').limit(500),
  ]);
  return (<>
    <LiveList items={live} />
    <form action={importNews} className="row"><button className="btn primary">Import news now</button><span className="hint">Also runs on its own every morning.</span></form>
    <div className="panel" style={{ gap: 6 }}><b>Sources</b>
      {sources?.map((s: any) => <form key={s.id} action={toggleSource} className="row between"><input type="hidden" name="id" value={s.id} /><input type="hidden" name="active" value={String(!s.active)} />
        <span style={{ flex: 1, minWidth: 0 }}>{s.active ? '' : '⏸ '}{s.name} <span className="hint">({s.lang}) · {s.last_fetched_at ? `${when(s.last_fetched_at)} · ${s.last_status} · +${s.last_count}` : 'never fetched'}</span></span>
        <button className="btn ghost small">{s.active ? 'Pause' : 'Resume'}</button></form>)}
    </div>
    <div className="panel" style={{ gap: 12 }}><b>Last 48 hours ({news?.length ?? 0})</b>
      {news?.map((x: any) => (
        <div key={x.id} className="stack" style={{ gap: 4, opacity: x.status === 'hidden' ? 0.45 : 1 }}>
          <a href={x.url} target="_blank" rel="noopener nofollow"><b>{x.title}</b></a>
          <span className="hint">{x.news_sources?.name} · {x.topic} · {x.lang} · {when(x.published_at)}{x.status === 'hidden' ? ' · hidden' : ''}</span>
          <form action={newsAction} className="row"><input type="hidden" name="id" value={x.id} />
            <input name="petition_id" list="live-petitions" defaultValue={x.petition_id ?? ''} placeholder="Attach a petition (type a title)" style={{ flex: 1, minWidth: 0 }} />
            <button className="btn small" name="do" value="attach">Attach</button>
            {x.status !== 'hidden' && <button className="btn small danger" name="do" value="hide">Hide</button>}</form>
        </div>))}
    </div>
  </>);
}

// One shared list of live petitions for every "unite" and "attach" box (typing a title suggests the match).
const LiveList = ({ items }: { items: any[] | null }) => <datalist id="live-petitions">{items?.map((o) => <option key={o.id} value={o.id} label={o.title} />)}</datalist>;

async function People({ sb, q, me }: { sb: any; q: string; me: string }) {
  const { data: people } = await sb.rpc('admin_find_people', { p_query: q });
  return (<>
    <form className="field" action="/admin"><input type="hidden" name="tab" value="people" /><input name="q" type="search" defaultValue={q} placeholder="Search by email, handle or name" aria-label="Search people" /></form>
    <p className="hint" style={{ margin: 0 }}>{q ? 'Results' : 'Moderators'}. Signatures stay private, even here.</p>
    {people?.map((p: any) => (
      <form action={setModerator} key={p.id} className="panel row between" style={{ gap: 8 }}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="on" value={String(!p.is_moderator)} />
        <span style={{ flex: 1, minWidth: 0 }}><b>{p.display_name || (p.handle ? '@' + p.handle : p.email)}</b><span className="hint" style={{ display: 'block' }}>{p.email} · joined {when(p.created_at)}{p.is_moderator ? ' · moderator' : ''}</span></span>
        {p.id !== me && <button className={`btn small ${p.is_moderator ? 'danger' : ''}`}>{p.is_moderator ? 'Remove moderator' : 'Make moderator'}</button>}
      </form>))}
  </>);
}
