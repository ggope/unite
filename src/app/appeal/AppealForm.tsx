'use client';
import { useActionState } from 'react';
import { fileAppeal, type AppealState } from './actions';
import { useT } from '@/lib/i18n/client';

export function AppealForm({ kind, id }: { kind: string; id: string }) {
  const { t } = useT();
  const [state, action, pending] = useActionState<AppealState, FormData>(fileAppeal, {});
  return (
    <form action={action} className="panel" style={{ gap: 14 }}>
      <input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={id} />
      <div className="field"><label htmlFor="appeal-body">{t('appeal.body')}</label>
        <textarea id="appeal-body" name="body" required minLength={10} maxLength={2000} rows={7} aria-describedby="appeal-hint" />
        <span className="hint" id="appeal-hint">{t('appeal.bodyHint')}</span></div>
      {state.error && <p className="error" role="alert" style={{ margin: 0 }}>{state.error}</p>}
      <button className="btn primary big" disabled={pending}>{pending ? t('common.saving') : t('appeal.send')}</button>
    </form>
  );
}
