import Link from 'next/link';
import { loadViewer } from '@/lib/viewer';
import { TOPICS, TOPIC_KEYS, fmt } from '@/lib/topics';
import { SignButton } from '@/components/SignButton';

export const dynamic = 'force-dynamic';

export default async function Petitions({ searchParams }: { searchParams: Promise<{ q?: string; topic?: string; sort?: string }> }) {
  const { q = '', topic = '', sort = 'recent' } = await searchParams;
  const { sb, viewer, signed } = await loadViewer();
  let query = sb.from('petitions').select('id, title, target, topic, goal, cluster_id, created_at, petition_stats(signatures, combined, united_count)').eq('status', 'live').limit(50);
  if (q.trim()) query = query.textSearch('search', q.trim().split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean).join(' & '), { config: 'simple' });
  if (topic && topic in TOPICS) query = query.eq('topic', topic);
  const { data } = await query.order('created_at', { ascending: false });
  // one row per united group
  const seen = new Set<string>();
  let rows = (data ?? []).filter((p: any) => !p.cluster_id || (!seen.has(p.cluster_id) && seen.add(p.cluster_id)));
  const stat = (p: any) => (Array.isArray(p.petition_stats) ? p.petition_stats[0] : p.petition_stats) ?? { combined: 0, united_count: 1 };
  if (sort === 'signed') rows = rows.sort((a: any, b: any) => stat(b).combined - stat(a).combined);
  const href = (o: Record<string, string>) => '/petitions?' + new URLSearchParams({ q, topic, sort, ...o }).toString();

  return (
    <div className="stack">
      <div className="row between"><h1>Petitions</h1><Link className="btn primary" href="/start">Start a petition</Link></div>
      <form className="field" action="/petitions"><input name="q" type="search" defaultValue={q} placeholder="Search petitions" aria-label="Search petitions" /><input type="hidden" name="topic" value={topic} /></form>
      <div className="chips">
        <Link className="chip" aria-pressed={!topic} href={href({ topic: '' })}>All</Link>
        {TOPIC_KEYS.map((k) => <Link key={k} className="chip" aria-pressed={topic === k} href={href({ topic: k })}>{TOPICS[k].label}</Link>)}
      </div>
      <div className="row"><Link className="chip" aria-pressed={sort === 'recent'} href={href({ sort: 'recent' })}>Most recent</Link><Link className="chip" aria-pressed={sort === 'signed'} href={href({ sort: 'signed' })}>Most signed</Link></div>
      <div>
        {rows.length ? rows.map((p: any) => (
          <div className="prow" key={p.id}>
            <div className="stack" style={{ gap: 6, minWidth: 0 }}>
              <span className="hint">{TOPICS[p.topic as keyof typeof TOPICS].label} · To {p.target} {stat(p).united_count > 1 && <span className="united">United · {stat(p).united_count}</span>}</span>
              <h3><Link href={`/p/${p.id}`}>{p.title}</Link></h3>
              <span className="row hint"><b className="num">{fmt(stat(p).combined)}</b> of {fmt(p.goal)}<span className="prog"><i style={{ width: `${Math.min(100, stat(p).combined / p.goal * 100)}%` }} /></span></span>
            </div>
            <SignButton variant="small" petitionId={p.id} title={p.title} signed={signed.has(p.id)} viewer={viewer} />
          </div>
        )) : <div className="empty">No petitions match. <Link href="/start">Start one</Link>.</div>}
      </div>
    </div>
  );
}
