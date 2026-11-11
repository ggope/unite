import Link from 'next/link';
import { TOPICS, fmt } from '@/lib/topics';
import { SignButton, type Viewer } from './SignButton';
import { InstallApp } from './InstallApp';

type P = { id: string; title: string; target: string; topic: keyof typeof TOPICS; goal: number; combined: number };

// What a visitor sees while the feed has no videos yet: what UNIER is, and petitions to sign right away.
export function Welcome({ petitions, viewer, signed }: { petitions: P[]; viewer: Viewer; signed: string[] }) {
  return (
    <div className="stack">
      <section className="hero">
        <span className="label">Welcome to UNIER</span>
        <h1>See what is happening. Sign what matters. Hear what happened next.</h1>
        <p className="muted">Short videos about real problems, each with a petition attached. Sign in one tap, and get an update when something changes.</p>
        <div className="row"><Link className="btn primary big" href="/petitions">Browse petitions</Link><Link className="btn big" href="/post">Post the first video</Link></div>
      </section>
      <InstallApp />
      {petitions.length > 0 && (
        <section className="stack" style={{ gap: 0 }}>
          <div className="row between" style={{ marginBottom: 4 }}><h2>Sign today</h2><Link href="/petitions">See all</Link></div>
          {petitions.map((p) => (
            <div className="prow" key={p.id}>
              <div className="stack" style={{ gap: 6, minWidth: 0 }}>
                <span className="hint"><i className="tdot" style={{ background: TOPICS[p.topic].b }} />{TOPICS[p.topic].label} · To {p.target}</span>
                <h3><Link href={`/p/${p.id}`}>{p.title}</Link></h3>
                <span className="row hint"><b className="num">{fmt(p.combined)}</b> of {fmt(p.goal)}<span className="prog"><i style={{ width: `${Math.min(100, (p.combined / p.goal) * 100)}%` }} /></span></span>
              </div>
              <SignButton variant="small" petitionId={p.id} title={p.title} signed={signed.includes(p.id)} viewer={viewer} />
            </div>
          ))}
        </section>
      )}
      <section className="panel">
        <h2>Have something to change?</h2>
        <p className="muted" style={{ margin: 0 }}>Start a petition in a few minutes. Then film a short video about it, so people see why it matters.</p>
        <div className="row"><Link className="btn primary" href="/start">Start a petition</Link></div>
      </section>
    </div>
  );
}
