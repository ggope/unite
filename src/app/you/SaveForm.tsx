'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/lib/i18n/client';
import type { SaveResult } from './actions';

// The settings form. It calls the save directly (not as the form's action), so React does not
// reset the fields to their old values while the page reloads, and it always says whether it saved.
export function SaveForm({ action, children }: { action: (f: FormData) => Promise<SaveResult>; children: React.ReactNode }) {
  const { t } = useT(); const router = useRouter();
  const [state, setState] = useState<'idle' | 'saving' | SaveResult>('idle');
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState('saving');
    try { const r = await action(new FormData(e.currentTarget)); setState(r); if (r.ok) router.refresh(); }
    catch (err) { setState({ error: 'save', detail: String(err).slice(0, 160) }); }
  }
  const msg = typeof state === 'object' && (state.ok ? null : state.error === 'handle' ? t('you.handleTaken') : state.error === 'handleFormat' ? t('you.handleFormat') : t('you.saveFailed'));
  return (
    <form onSubmit={onSubmit} className="panel" id="profile">
      {children}
      {msg && <p className="error" role="alert" style={{ margin: 0 }}>{msg}{typeof state === 'object' && !state.ok && state.detail && <small style={{ display: 'block', opacity: .75 }}>{state.detail}</small>}</p>}
      {typeof state === 'object' && state.ok && <p className="note" role="status" style={{ margin: 0 }}>✓ {t('you.saved')}</p>}
      <button className="btn primary" disabled={state === 'saving'}>{state === 'saving' ? t('you.saving') : t('common.save')}</button>
    </form>
  );
}
