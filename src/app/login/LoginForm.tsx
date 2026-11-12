'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useT } from '@/lib/i18n/client';
import { authError } from '@/lib/authError';

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
  const { t } = useT();
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
    if (error) { setBusy(false); setErr(t('login.errGoogle')); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    const sb = supabaseBrowser();
    if (mode === 'signin') {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (!error) { router.replace(next); router.refresh(); return; }
      if (/confirm/i.test(error.message)) setErr(t('login.errConfirm'));
      else setErr(t('login.errWrong'));
    } else if (mode === 'signup') {
      const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: callback(next) } });
      setBusy(false);
      if (error) { setErr(authError(t, error, 'login.errCreate')); return; }
      if (data.session) { router.replace(next); router.refresh(); return; }
      setSent(t('login.sentConfirm', { email }));
    } else if (mode === 'link') {
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: callback(next) } });
      setBusy(false);
      if (error) setErr(authError(t, error, 'login.errSend'));
      else setSent(t('login.sentLink', { email }));
    } else {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: callback('/reset') });
      setBusy(false);
      if (error) setErr(authError(t, error, 'login.errReset'));
      else setSent(t('login.sentReset', { email }));
    }
  }

  if (sent) return (
    <div className="panel"><b>{t('login.inbox')}</b><p style={{ margin: 0 }}>{sent}</p>
      <button className="btn ghost" onClick={() => { setSent(''); setMode('signin'); }}>{t('login.back')}</button></div>
  );

  const needsPassword = mode === 'signin' || mode === 'signup';
  const label = { signin: t('login.btnSignIn'), signup: t('login.btnSignUp'), link: t('login.btnLink'), forgot: t('login.btnForgot') }[mode];

  return (
    <div className="stack">
      {(mode === 'signin' || mode === 'signup') && (
        <div className="seg" role="tablist">
          <button role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'on' : ''} onClick={() => { setMode('signin'); setErr(''); }}>{t('login.tabSignIn')}</button>
          <button role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'on' : ''} onClick={() => { setMode('signup'); setErr(''); }}>{t('login.tabSignUp')}</button>
        </div>
      )}
      <div className="panel">
        {process.env.NEXT_PUBLIC_GOOGLE_LOGIN === "on" && <><button type="button" className="btn big block" onClick={google} disabled={busy}><GoogleLogo /> {t('login.google')}</button>
        <div className="or"><span>{t('login.or')}</span></div></>}
        <form onSubmit={submit} className="stack">
          <div className="field"><label htmlFor="email">{t('login.email')}</label>
            <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          {needsPassword && (
            <div className="field"><label htmlFor="pw">{t('login.password')}</label>
              <input id="pw" type="password" required minLength={8} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
              {mode === 'signup' && <span className="muted" style={{ fontSize: 13 }}>{t('login.pwHint')}</span>}
            </div>
          )}
          {err && <p className="error" style={{ margin: 0 }}>{err}</p>}
          <button className="btn primary big block" disabled={busy}>{busy ? t('login.wait') : label}</button>
        </form>
        <div className="links">
          {mode === 'signin' && <button className="linkbtn" onClick={() => { setMode('forgot'); setErr(''); }}>{t('login.forgot')}</button>}
          {mode !== 'link' && <button className="linkbtn" onClick={() => { setMode('link'); setErr(''); }}>{t('login.useLink')}</button>}
          {(mode === 'link' || mode === 'forgot') && <button className="linkbtn" onClick={() => { setMode('signin'); setErr(''); }}>{t('login.usePassword')}</button>}
        </div>
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>{t('login.agree')} <Link href="/terms">{t('login.termsLink')}</Link>. {t('login.dataHow')} <Link href="/privacy">{t('login.privacyLink')}</Link>.</p>
      </div>
    </div>
  );
}
