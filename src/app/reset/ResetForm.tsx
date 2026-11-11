'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
export function ResetForm() {
  const router = useRouter();
  const [pw, setPw] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    const { error } = await supabaseBrowser().auth.updateUser({ password: pw });
    setBusy(false);
    if (error) setErr(error.message); else { router.replace('/you'); router.refresh(); }
  }
  return (
    <form onSubmit={save} className="panel">
      <div className="field"><label htmlFor="pw">New password</label>
        <input id="pw" type="password" required minLength={8} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
      {err && <p className="error" style={{ margin: 0 }}>{err}</p>}
      <button className="btn primary big block" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
    </form>
  );
}
