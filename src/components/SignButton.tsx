'use client';
import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { CONSENT_TEXT, CONSENT_VERSION, DAILY_LIMIT, fmt } from '@/lib/topics';
import { Icon } from './Icon';

export type Viewer = { loggedIn: boolean; hasConsent: boolean; oneTap: boolean };

const ERRORS: Record<string, string> = {
  daily_limit_reached: `You have used your ${DAILY_LIMIT} signatures for today. The limit resets at midnight.`,
  email_not_confirmed: 'Confirm your email first. Check your inbox for the link.',
  consent_required: 'Please give consent first.',
  petition_not_open: 'This petition is not open for signatures.',
  not_signed_in: 'Sign in to sign.',
};
const errorText = (m: string) => Object.entries(ERRORS).find(([k]) => m.includes(k))?.[1] ?? 'Something went wrong. Try again.';

export function SignButton({ petitionId, title, signed: initial, viewer, variant = 'button', onChange }: {
  petitionId: string; title: string; signed: boolean; viewer: Viewer; variant?: 'button' | 'reel' | 'small';
  onChange?: (signed: boolean, combined?: number) => void;
}) {
  const sb = supabaseBrowser();
  const router = useRouter();
  const path = usePathname();
  const [signed, setSigned] = useState(initial);
  const [consented, setConsented] = useState(viewer.hasConsent);
  const [sheet, setSheet] = useState<null | 'form' | 'why'>(null);
  const [undo, setUndo] = useState<number | null>(null);
  const [why, setWhy] = useState(''); const [show, setShow] = useState(true); const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');

  async function sign(reason?: string) {
    setBusy(true); setErr('');
    if (!consented) {
      const c = await sb.rpc('give_signature_consent', { p_text_version: CONSENT_VERSION });
      if (c.error) { setBusy(false); setErr(errorText(c.error.message)); return false; }
      setConsented(true);
    }
    const { data, error } = await sb.rpc('sign_petition', { p_petition: petitionId, p_why: reason || null, p_show_reason: show });
    setBusy(false);
    if (error) { setErr(errorText(error.message)); return false; }
    setSigned(true); onChange?.(true, data as number); router.refresh();
    return true;
  }
  async function start() {
    if (!viewer.loggedIn) { router.push(`/login?next=${encodeURIComponent(path)}`); return; }
    if (signed) { router.push(`/p/${petitionId}`); return; }
    if (consented && viewer.oneTap) {                     // one tap, with 5 seconds to undo
      if (await sign()) { const t = window.setTimeout(() => setUndo(null), 5000); setUndo(t); } else setSheet('form');
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

  const label = signed ? 'Signed' : 'Sign';
  const button = variant === 'reel'
    ? <button className={`rb sign ${signed ? 'done' : ''}`} onClick={start} aria-label={`${label}: ${title}`}><span className="c"><Icon name={signed ? 'check' : 'petitions'} /></span>{label}</button>
    : <button className={`btn ${signed ? 'signed' : 'primary'} ${variant === 'small' ? 'small' : 'big'}`} onClick={start}>{signed && <Icon name="check" />}{signed ? 'Signed' : variant === 'small' ? 'Sign' : 'Sign this petition'}</button>;

  return (
    <>
      {button}
      {undo !== null && (
        <div className="undo" role="status">
          <span>Signed</span>
          <a href={`/api/card/${petitionId}`} target="_blank" rel="noopener">Share card</a>
          <button onClick={() => { if (undo) clearTimeout(undo); setUndo(null); setSheet('why'); }}>Add why</button>
          <button onClick={undoSign}>Undo</button>
        </div>
      )}
      {sheet && (
        <div className="backdrop" onClick={(e) => e.target === e.currentTarget && setSheet(null)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label={sheet === 'why' ? 'Add your reason' : 'Sign petition'}>
            <div className="row between"><div><span className="label">{sheet === 'why' ? 'You signed' : 'Sign petition'}</span><h2>{title}</h2></div>
              <button className="btn ghost" onClick={() => setSheet(null)} aria-label="Close"><Icon name="x" /></button></div>
            <div className="field"><label htmlFor={`why-${petitionId}`}>Why are you signing? <span className="muted">(one line, optional)</span></label>
              <input id={`why-${petitionId}`} maxLength={90} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="For example: My town lost its water for a week" /></div>
            <label className="check"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /><span>Show my reason on the petition</span></label>
            {sheet === 'form' && !consented && (
              <label className="check"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /><span>{CONSENT_TEXT}</span></label>
            )}
            {err && <p className="error">{err}</p>}
            {sheet === 'form'
              ? <button className="btn primary big block" disabled={busy || (!consented && !agree)} onClick={async () => { if (await sign(why)) setSheet(null); }}>{busy ? 'Signing…' : 'Sign'}</button>
              : <button className="btn primary block" onClick={saveWhy}>Save</button>}
            {sheet === 'form' && !consented && <p className="hint">After this, signing is one tap with Undo. You can turn that off in You.</p>}
          </div>
        </div>
      )}
    </>
  );
}

export function SignedCount({ n }: { n: number }) { return <span className="num">{fmt(n)}</span>; }
