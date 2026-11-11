'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState(''); const [sent, setSent] = useState(false); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  async function send(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    const { error } = await supabaseBrowser().auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` } });
    setBusy(false); if (error) setErr('Could not send the link. Check the address and try again.'); else setSent(true);
  }
  if (sent) return <div className="panel"><b>Check your inbox</b><p style={{ margin: 0 }}>We sent a link to {email}. Open it on this device to continue.</p></div>;
  return (
    <form onSubmit={send} className="panel">
      <div className="field"><label htmlFor="email">Email</label><input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      {err && <p className="error">{err}</p>}
      <button className="btn primary big" disabled={busy}>{busy ? 'Sending…' : 'Email me a link'}</button>
    </form>
  );
}
