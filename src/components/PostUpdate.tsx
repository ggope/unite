'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useT } from '@/lib/i18n/client';

const KINDS = ['milestone', 'delivered', 'response', 'win'] as const;

// Founders (and moderators) tell everyone who signed or follows what happened next.
export function PostUpdate({ petitionId, userId }: { petitionId: string; userId: string }) {
  const { t } = useT(); const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<(typeof KINDS)[number]>('milestone');
  const [title, setTitle] = useState(''); const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  async function send(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    const { error } = await supabaseBrowser().from('petition_updates').insert({ petition_id: petitionId, kind, title: title.trim(), body: body.trim() || null, created_by: userId });
    setBusy(false);
    if (error) { setErr(t('upd.err')); return; }
    setTitle(''); setBody(''); setOpen(false); router.refresh();
  }
  if (!open) return <button className="btn primary" onClick={() => setOpen(true)}>{t('upd.post')}</button>;
  return (
    <form onSubmit={send} className="panel">
      <b>{t('upd.post')}</b>
      <p className="hint" style={{ margin: 0 }}>{t('upd.postHint')}</p>
      <div className="field"><label>{t('upd.kind')}</label>
        <div className="row">{KINDS.map((k) => <button type="button" key={k} className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>{t(`kind.${k}`)}</button>)}</div></div>
      <div className="field"><label htmlFor="uh">{t('upd.headline')}</label><input id="uh" required minLength={5} maxLength={140} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('upd.headlinePh')} /></div>
      <div className="field"><label htmlFor="ub">{t('upd.body')}</label><textarea id="ub" maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} /></div>
      {err && <p className="error" style={{ margin: 0 }}>{err}</p>}
      <div className="row"><button className="btn primary" disabled={busy || title.trim().length < 5}>{busy ? t('common.saving') : t('upd.send')}</button>
        <button type="button" className="btn ghost" onClick={() => setOpen(false)}>{t('common.close')}</button></div>
    </form>
  );
}

export function RemoveUpdate({ id }: { id: string }) {
  const { t } = useT(); const router = useRouter();
  return <button className="btn ghost small" onClick={async () => { await supabaseBrowser().from('petition_updates').delete().eq('id', id); router.refresh(); }}>{t('upd.remove')}</button>;
}
