'use client';
import { useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { CONSENT_VERSION, DAILY_LIMIT } from '@/lib/topics';
import { useT } from '@/lib/i18n/client';
import { signRpc } from '@/lib/sign';
import { myloCheer } from './mylo/MyloCorner';
import { fmtN, type Key, type T } from '@/lib/i18n/langs';
import { Icon } from './Icon';
import { authError } from '@/lib/authError';
import { savePending } from './PendingSign';
import { PushToggle } from './PushToggle';
import { Turnstile, TURNSTILE_KEY } from './Turnstile';
import { verifyHuman } from '@/lib/human/actions';
import { requestEmailSign } from '@/app/s/actions';

export type Viewer = { loggedIn: boolean; hasConsent: boolean; oneTap: boolean };

const ERRORS: Record<string, Key> = {
  daily_limit_reached: 'sign.errDaily',
  email_not_confirmed: 'sign.errEmail',
  consent_required: 'sign.errConsent',
  petition_not_open: 'sign.errClosed',
  not_signed_in: 'sign.errSignIn',
};
const GUEST_ERRORS: Record<string, Key> = {
  already: 'guest.already', wait: 'guest.wait', daily_limit_reached: 'sign.errDaily', busy: 'guest.busy',
  bad_email: 'guest.badEmail', petition_not_open: 'sign.errClosed', human: 'human.err',
};
const errorText = (t: T, m: string) => t(Object.entries(ERRORS).find(([k]) => m.includes(k))?.[1] ?? 'sign.errOther', { n: DAILY_LIMIT });

export function SignButton({ petitionId, title, signed: initial, viewer, variant = 'button', onChange }: {
  petitionId: string; title: string; signed: boolean; viewer: Viewer; variant?: 'button' | 'reel' | 'small';
  onChange?: (signed: boolean, combined?: number) => void;
}) {
  const sb = supabaseBrowser();
  const { lang, t } = useT();
  const router = useRouter();
  const path = usePathname();
  const [signed, setSigned] = useState(initial);
  const [consented, setConsented] = useState(viewer.hasConsent);
  const [sheet, setSheet] = useState<null | 'form' | 'why' | 'guest' | 'human'>(null);
  const [toast, setToast] = useState(false); const [captcha, setCaptcha] = useState<string | null>(null); const [tsKey, setTsKey] = useState(0);
  const pendingWhy = useRef<string | undefined>(undefined); const needHuman = useRef(false);
  const [undo, setUndo] = useState<number | null>(null);
  const [why, setWhy] = useState(''); const [show, setShow] = useState(true); const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const [email, setEmail] = useState(''); const [sent, setSent] = useState(''); const [sameDevice, setSameDevice] = useState(false);

  async function sign(reason?: string) {
    setBusy(true); setErr('');
    if (!consented) {
      const c = await sb.rpc('give_signature_consent', { p_text_version: lang === 'en' ? CONSENT_VERSION : `${CONSENT_VERSION}-${lang}` });
      if (c.error) { setBusy(false); setErr(errorText(t, c.error.message)); return false; }
      setConsented(true);
    }
    const { data, error } = await signRpc(sb, { petition: petitionId, why: reason || null, show });
    setBusy(false);
    // the bot check is switched on and this account has not passed it lately
    if (error?.message.includes('human_check_required') && TURNSTILE_KEY) { needHuman.current = true; pendingWhy.current = reason; setSheet('human'); return false; }
    if (error) { setErr(errorText(t, error.message)); return false; }
    setSigned(true); onChange?.(true, data as number); myloCheer(typeof data === 'number' ? data : undefined); router.refresh();
    if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) fetch('/api/push', { method: 'POST', keepalive: true }).catch(() => {});
    return true;
  }
  async function start() {
    if (!viewer.loggedIn) { setSheet('guest'); return; }
    if (signed) { router.push(`/p/${petitionId}`); return; }
    if (consented && viewer.oneTap) {                     // one tap, with 5 seconds to undo
      needHuman.current = false;
      if (await sign()) { const t = window.setTimeout(() => setUndo(null), 5000); setUndo(t); } else if (!needHuman.current) setSheet('form');
      return;
    }
    setSheet('form');
  }
  async function undoSign() {
    if (undo) clearTimeout(undo); setUndo(null);
    await sb.from('signatures').delete().eq('petition_id', petitionId);
    setSigned(false); onChange?.(false); router.refresh();
  }
  async function saveWhy() {
    await sb.from('signatures').update({ why: why.trim() || null, show_reason: show && !!why.trim() }).eq('petition_id', petitionId);
    setSheet(null); router.refresh();
  }

  async function passedCheck(token: string | null) {
    if (!token) return;
    setBusy(true); setErr('');
    const r = await verifyHuman(token);
    setBusy(false);
    if (!r.ok) { setErr(t('human.err')); setTsKey((k) => k + 1); return; }
    setSheet(null);
    if (await sign(pendingWhy.current)) afterSign();
  }
  function afterSign() { setToast(true); window.setTimeout(() => setToast(false), 7000); }

  // Signed out: only an email. With UNIER's own mail sender set up, the link confirms the signature without
  // making an account (any device). Otherwise one Supabase sign-in link confirms the person and the signature
  // (finished by PendingSign on this device).
  async function guestSign() {
    setBusy(true); setErr('');
    const clean = email.trim().toLowerCase();
    const r = await requestEmailSign({ petitionId, email: clean, lang, captcha }).catch(() => ({ status: 'fallback' as const }));
    if (r.status !== 'fallback') {
      setBusy(false); setCaptcha(null); setTsKey((k) => k + 1);
      if (r.status === 'sent') setSent(clean);
      else setErr(t(GUEST_ERRORS[r.status] ?? 'sign.errOther', { n: DAILY_LIMIT }));
      return;
    }
    savePending({ petitionId, email: clean, why: '', show: false, lang, at: Date.now() });
    const next = `/p/${petitionId}`;
    const { error } = await sb.auth.signInWithOtp({ email: clean, options: { shouldCreateUser: true, captchaToken: captcha ?? undefined, emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` } });
    setBusy(false); setCaptcha(null); setTsKey((k) => k + 1);
    if (error) { setErr(authError(t, error, 'sign.errOther')); return; }
    setSent(clean); setSameDevice(true);
  }

  const label = signed ? t('sign.signed') : t('sign.sign');
  const button = variant === 'reel'
    ? <button className={`rb sign ${signed ? 'done' : ''}`} onClick={start} aria-label={`${label}: ${title}`}><span className="c"><Icon name={signed ? 'check' : 'petitions'} /></span>{label}</button>
    : <button className={`btn ${signed ? 'signed' : 'primary'} ${variant === 'small' ? 'small' : 'big'}`} onClick={start}>{signed && <Icon name="check" />}{signed ? t('sign.signed') : variant === 'small' ? t('sign.sign') : t('sign.signThis')}</button>;

  return (
    <>
      {button}
      {undo !== null && (
        <div className="undo" role="status">
          <span>{t('sign.signed')}</span>
          <a href={`/api/card/${petitionId}`} target="_blank" rel="noopener">{t('sign.shareCard')}</a>
          <button onClick={() => { if (undo) clearTimeout(undo); setUndo(null); setSheet('why'); }}>{t('sign.addWhy')}</button>
          <button onClick={undoSign}>{t('sign.undo')}</button>
          <PushToggle compact />
        </div>
      )}
      {toast && undo === null && (
        <div className="undo" role="status"><span>{t('sign.signed')}</span><PushToggle compact /></div>
      )}
      {sheet && (
        <div className="backdrop" onClick={(e) => e.target === e.currentTarget && setSheet(null)}>
          {sheet === 'guest' ? (
          <div className="sheet" role="dialog" aria-modal="true" aria-label={t('guest.title')}>
            <div className="row between sheethead"><div><span className="label">{t('guest.title')}</span><h2>{title}</h2></div>
              <button className="btn ghost" onClick={() => setSheet(null)} aria-label={t('common.close')}><Icon name="x" /></button></div>
            {sent ? <p role="status" className="ok">{t(sameDevice ? 'guest.sent' : 'guest.sentAny', { email: sent })}</p> : (<>
              <p className="muted" style={{ margin: 0 }}>{t('guest.text')}</p>
              <form className="stack" style={{ gap: 12 }} onSubmit={(e) => { e.preventDefault(); guestSign(); }}>
                <div className="field"><label htmlFor={`em-${petitionId}`}>{t('login.email')}</label>
                  <input id={`em-${petitionId}`} type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <label className="check"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /><span>{t('guest.age')} {t('consent.text')} <a href="/privacy" target="_blank" rel="noopener">{t('consent.more')}</a></span></label>
                <Turnstile key={tsKey} lang={lang} onToken={setCaptcha} />
                {err && <p className="error">{err}</p>}
                <button className="btn primary big block" disabled={busy || !agree || !email.includes('@') || (!!TURNSTILE_KEY && !captcha)}>{busy ? t('sign.signing') : t('guest.send')}</button>
              </form>
              <a className="hint" href={`/login?next=${encodeURIComponent(path)}`}>{t('guest.haveAccount')}</a>
            </>)}
          </div>
          ) : sheet === 'human' ? (
          <div className="sheet" role="dialog" aria-modal="true" aria-label={t('human.title')}>
            <div className="row between sheethead"><div><span className="label">{t('human.title')}</span><h2>{title}</h2></div>
              <button className="btn ghost" onClick={() => setSheet(null)} aria-label={t('common.close')}><Icon name="x" /></button></div>
            <Turnstile key={tsKey} lang={lang} onToken={passedCheck} />
            {busy && <p className="hint" role="status">{t('sign.signing')}</p>}
            {err && <p className="error">{err}</p>}
          </div>
          ) : (
          <div className="sheet" role="dialog" aria-modal="true" aria-label={sheet === 'why' ? t('sign.addReason') : t('sign.signPetition')}>
            <div className="row between sheethead"><div><span className="label">{sheet === 'why' ? t('sign.youSigned') : t('sign.signPetition')}</span><h2>{title}</h2></div>
              <button className="btn ghost" onClick={() => setSheet(null)} aria-label={t('common.close')}><Icon name="x" /></button></div>
            <div className="field"><label htmlFor={`why-${petitionId}`}>{t('sign.whyLabel')} <span className="muted">{t('sign.optional')}</span></label>
              <input id={`why-${petitionId}`} maxLength={90} value={why} onChange={(e) => setWhy(e.target.value)} placeholder={t('sign.whyPh')} /></div>
            <label className="check"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /><span>{t('sign.showReason')}</span></label>
            {sheet === 'form' && !consented && (
              <label className="check"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /><span>{t('consent.text')} <a href="/privacy" target="_blank" rel="noopener">{t('consent.more')}</a></span></label>
            )}
            {err && <p className="error">{err}</p>}
            {sheet === 'form'
              ? <button className="btn primary big block" disabled={busy || (!consented && !agree)} onClick={async () => { needHuman.current = false; if (await sign(why)) { setSheet(null); afterSign(); } }}>{busy ? t('sign.signing') : t('sign.sign')}</button>
              : <button className="btn primary block" onClick={saveWhy}>{t('common.save')}</button>}
            {sheet === 'form' && !consented && <p className="hint">{t('sign.afterHint')}</p>}
          </div>
          )}
        </div>
      )}
    </>
  );
}

export function SignedCount({ n }: { n: number }) { const { lang } = useT(); return <span className="num">{fmtN(n, lang)}</span>; }
