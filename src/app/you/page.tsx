import Link from 'next/link';
import { loadViewer } from '@/lib/viewer';
import { TOPICS, DAILY_LIMIT } from '@/lib/topics';
import { saveSettings, withdraw, revokeConsent, resetFeed, signOut } from './actions';
import { DeleteAccount } from './DeleteAccount';

export const dynamic = 'force-dynamic';

export default async function You() {
  const { sb, user, viewer, settings, weights } = await loadViewer();
  if (!user) return <div className="empty"><h2>You</h2><p>No account needed to watch. To sign, confirm your email once.</p><Link className="btn primary" href="/login?next=/you">Sign in</Link></div>;
  const [{ data: profile }, { data: sigs }, { data: vids }] = await Promise.all([
    sb.from('profiles').select('handle, display_name').eq('id', user.id).single(),
    sb.from('signatures').select('petition_id, why, created_at, petitions(title)').order('created_at', { ascending: false }),
    sb.from('videos').select('id, caption, status, created_at').eq('uploader_id', user.id).order('created_at', { ascending: false }),
  ]);
  const today = (sigs ?? []).filter((s: any) => new Date(s.created_at) >= new Date(new Date().toISOString().slice(0, 10))).length;
  const max = Math.max(1, ...Object.values(weights).map(Math.abs));
  const on = (k: string) => (settings?.[k] ? true : false);
  return (
    <div className="stack">
      <h1>You</h1>
      <form action={saveSettings} className="panel">
        <span className="label">Profile</span><span className="hint">{user.email}</span>
        <div className="field"><label htmlFor="handle">Handle</label><input id="handle" name="handle" defaultValue={profile?.handle ?? ''} placeholder="lowercase letters, numbers, _" /></div>
        <div className="field"><label htmlFor="display_name">Name</label><input id="display_name" name="display_name" defaultValue={profile?.display_name ?? ''} /></div>
        <span className="label">Signing</span>
        <label className="check"><input type="checkbox" name="one_tap" defaultChecked={on('one_tap')} /><span>One-tap signing with Undo</span></label>
        <label className="check"><input type="checkbox" name="share_signatures_with_friends" defaultChecked={on('share_signatures_with_friends')} /><span>Show my signatures to friends</span></label>
        <span className="label">Feed and healthy use</span>
        <label className="check"><input type="checkbox" name="chronological_feed" defaultChecked={on('chronological_feed')} /><span>Show the feed in time order, without personalisation</span></label>
        <label className="check"><input type="checkbox" name="autoplay" defaultChecked={on('autoplay')} /><span>Autoplay videos</span></label>
        <label className="check"><input type="checkbox" name="is_minor" defaultChecked={on('is_minor')} /><span>I am under 18 (no autoplay, more break reminders)</span></label>
        <div className="field"><label htmlFor="br">Break reminder</label><select id="br" name="break_reminder_minutes" defaultValue={settings?.break_reminder_minutes ?? 20}>{[10, 20, 30, 60].map((m) => <option key={m} value={m}>{m} minutes</option>)}</select></div>
        <button className="btn primary">Save</button>
      </form>
      <div className="panel"><span className="label">Today</span><b>{Math.max(0, DAILY_LIMIT - today)} of {DAILY_LIMIT} signatures left</b></div>
      <div className="panel"><span className="label">How your feed learns</span>
        {Object.keys(weights).length ? Object.entries(TOPICS).map(([k, t]) => <div key={k} className="row"><span style={{ width: 110 }}>{t.label}</span><span className="prog"><i style={{ width: `${Math.max(0, weights[k] ?? 0) / max * 100}%`, background: t.b }} /></span></div>)
          : <p className="hint">It starts learning when you watch.</p>}
        <form action={resetFeed}><button className="btn small">Reset what the feed learned</button></form>
      </div>
      <div className="panel"><span className="label">Your signatures</span>
        {sigs?.length ? sigs.map((s: any) => (
          <form key={s.petition_id} action={withdraw} className="row between"><input type="hidden" name="petition_id" value={s.petition_id} />
            <span style={{ flex: 1, minWidth: 0 }}><Link href={`/p/${s.petition_id}`}>{s.petitions?.title}</Link>{s.why && <span className="hint"> · “{s.why}”</span>}</span>
            <button className="btn small">Withdraw</button></form>)) : <p className="hint">Nothing yet.</p>}
        {viewer.hasConsent && <form action={revokeConsent}><button className="btn small danger">Withdraw consent and delete all my signatures</button></form>}
      </div>
      <div className="panel"><span className="label">Your videos</span>
        {vids?.length ? vids.map((v: any) => <div key={v.id} className="row between"><span>{v.caption}</span><span className="hint">{v.status === 'pending' ? 'In review' : v.status === 'approved' ? 'Live' : 'Not approved'}</span></div>) : <p className="hint">No videos yet. <Link href="/post">Post one</Link>.</p>}
      </div>
      <div className="panel"><span className="label">Your data</span>
        <p className="hint" style={{ margin: 0 }}>Signatures show political opinions, so they are private: only totals are public. You can delete everything at any time.</p>
        <DeleteAccount />
        <form action={signOut}><button className="btn small">Sign out</button></form>
      </div>
    </div>
  );
}
