import Link from 'next/link';
import { loadViewer } from '@/lib/viewer';

export const dynamic = 'force-dynamic';
const KIND: Record<string, string> = { milestone: 'Milestone', response: 'Official reply', delivered: 'Delivered', win: 'Win' };

export default async function Updates() {
  const { sb, user, signed, followed } = await loadViewer();
  if (!user) return <div className="empty"><h2>Updates</h2><p>Sign in to hear what happens next on petitions you sign or follow.</p><Link className="btn primary" href="/login?next=/updates">Sign in</Link></div>;
  const ids = [...new Set([...signed, ...followed])];
  const { data } = ids.length
    ? await sb.from('petition_updates').select('id, kind, title, body, created_at, petition_id, petitions(title)').in('petition_id', ids).order('created_at', { ascending: false }).limit(50)
    : { data: [] as any[] };
  return (
    <div className="stack"><h1>Updates</h1><p className="muted" style={{ margin: 0 }}>What happened next on petitions you signed or follow.</p>
      {data?.length ? data.map((u: any) => (
        <div className="panel" key={u.id} style={{ gap: 4 }}>
          <span className="hint">{KIND[u.kind]} · {new Date(u.created_at).toLocaleDateString('en-GB')}</span>
          <b>{u.title}</b>
          <Link href={`/p/${u.petition_id}`}>{u.petitions?.title}</Link>
          {u.body && <p style={{ margin: 0 }} className="muted">{u.body}</p>}
        </div>)) : <div className="empty">No updates yet. Sign or follow a petition and you will hear what happens next.</div>}
    </div>
  );
}
