'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';

type Mode = 'signin' | 'signup' | 'link' | 'forgot';

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/>
    </svg>
  );
}

export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState(initialError || '');
  const [sent, setSent] = useState('');
  const [busy, setBusy] = useState(false);
  const callback = (to: string) => `${location.origin}/auth/callback?next=${encodeURIComponent(to)}`;

  async function google() {
    setBusy(true); setErr('');
    const { error } = await supabaseBrowser().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callback(next) } });
    if (error) { setBusy(false); setErr('Google sign-in is not available right now. Try email instead.'); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    const sb = supabaseBrowser();
    if (mode === 'signin') {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (!error) { router.replace(next); router.refresh(); return; }
      if (/confirm/i.test(error.message)) setErr('Please confirm your email first. Check your inbox for our link.');
      else setErr('Wrong email or password.');
    } else if (mode === 'signup') {
      const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: callback(next) } });
      setBusy(false);
      if (error) { setErr(/password/i.test(error.message) ? error.message : 'Could not create the account. Try again.'); return; }
      if (data.session) { router.replace(next); router.refresh(); return; }
      setSent(`We sent a confirmation link to ${email}. Open it to finish creating your account.`);
    } else if (mode === 'link') {
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: callback(next) } });
      setBusy(false);
      if (error) setErr('Could not send the link. Check the address and try again.');
      else setSent(`We sent a sign-in link to ${email}. Open it on this device.`);
    } else {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: callback('/reset') });
      setBusy(false);
      if (error) setErr('Could not send the reset link. Try again.');
      else setSent(`If ${email} has an account, a link to set a new password is on its way.`);
    }
  }

  if (sent) return (
    <div className="panel"><b>Check your inbox</b><p style={{ margin: 0 }}>{sent}</p>
      <button className="btn ghost" onClick={() => { setSent(''); setMode('signin'); }}>Back to sign in</button></div>
  );

  const needsPassword = mode === 'signin' || mode === 'signup';
  const label = { signin: 'Sign in', signup: 'Create account', link: 'Email me a link', forgot: 'Send reset link' }[mode];

  return (
    <div className="stack">
      {(mode === 'signin' || mode === 'signup') && (
        <div className="seg" role="tablist">
          <button role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'on' : ''} onClick={() => { setMode('signin'); setErr(''); }}>Sign in</button>
          <button role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'on' : ''} onClick={() => { setMode('signup'); setErr(''); }}>Create account</button>
        </div>
      )}
      <div className="panel">
        <button type="button" className="btn big block" onClick={google} disabled={busy}><GoogleLogo /> Continue with Google</button>
        <div className="or"><span>or</span></div>
        <form onSubmit={submit} className="stack">
          <div className="field"><label htmlFor="email">Email</label>
            <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          {needsPassword && (
            <div className="field"><label htmlFor="pw">Password</label>
              <input id="pw" type="password" required minLength={8} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
              {mode === 'signup' && <span className="muted" style={{ fontSize: 13 }}>At least 8 characters.</span>}
            </div>
          )}
          {err && <p className="error" style={{ margin: 0 }}>{err}</p>}
          <button className="btn primary big block" disabled={busy}>{busy ? 'One moment…' : label}</button>
        </form>
        <div className="links">
          {mode === 'signin' && <button className="linkbtn" onClick={() => { setMode('forgot'); setErr(''); }}>Forgot password?</button>}
          {mode !== 'link' && <button className="linkbtn" onClick={() => { setMode('link'); setErr(''); }}>Email me a sign-in link instead</button>}
          {(mode === 'link' || mode === 'forgot') && <button className="linkbtn" onClick={() => { setMode('signin'); setErr(''); }}>Back to password sign-in</button>}
        </div>
      </div>
    </div>
  );
}
