'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useT } from '@/lib/i18n/client';

// The organiser makes a private link for the target, who can then post an official answer without an account.
// Only a hash is stored, so the link is shown once; making a new one switches the old one off.
export function AnswerLink({ petitionId, target }: { petitionId: string; target: string }) {
  const { t } = useT();
  const [url, setUrl] = useState(''); const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(''); const [copied, setCopied] = useState(false);
  async function make() {
    setBusy(true); setErr('');
    const { data, error } = await supabaseBrowser().rpc('make_answer_link', { p_petition: petitionId });
    setBusy(false);
    if (error || typeof data !== 'string') { setErr(t('ans.err')); return; }
    setUrl(`${location.origin}/answer/${data}`); setCopied(false);
  }
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  }
  return (
    <section className="panel answer-link">
      <b>{t('ans.panel')}</b>
      <p className="hint" style={{ margin: 0 }}>{t('ans.panelText', { target })}</p>
      {url && <div className="row"><input readOnly value={url} aria-label={t('ans.panel')} onFocus={(e) => e.currentTarget.select()} style={{ flex: 1, minWidth: 0 }} />
        <button type="button" className="btn small noprint" onClick={copy}>{copied ? t('ans.copied') : t('ans.copy')}</button></div>}
      {err && <p className="error" style={{ margin: 0 }}>{err}</p>}
      <div className="row noprint"><button type="button" className={`btn small ${url ? 'ghost' : 'primary'}`} onClick={make} disabled={busy}>{url ? t('ans.remake') : t('ans.make')}</button>
        {url && <span className="hint">{t('ans.remakeHint')}</span>}</div>
    </section>
  );
}
