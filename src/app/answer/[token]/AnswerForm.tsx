'use client';
import Link from 'next/link';
import { useActionState } from 'react';
import { postAnswer, type AnswerState } from '../actions';
import { useT } from '@/lib/i18n/client';
import { keepForm } from '@/lib/keepForm';

export function AnswerForm({ token, petitionId }: { token: string; petitionId: string }) {
  const { t } = useT();
  const [state, action, pending] = useActionState<AnswerState, FormData>(postAnswer, {});
  if (state.ok) return <div className="panel"><p className="ok" role="status" style={{ margin: 0 }}>{t('ans.done')}</p><Link className="btn primary" href={`/p/${petitionId}`}>{t('ans.see')}</Link></div>;
  return (
    <form onSubmit={keepForm(action)} className="panel" style={{ gap: 14 }}>
      <input type="hidden" name="token" value={token} />
      <div className="field"><label htmlFor="a-name">{t('ans.name')}</label><input id="a-name" name="name" required minLength={2} maxLength={80} autoComplete="name" /></div>
      <div className="field"><label htmlFor="a-role">{t('ans.role')}</label><input id="a-role" name="role" required minLength={2} maxLength={80} placeholder={t('ans.rolePh')} autoComplete="organization-title" /></div>
      <div className="field"><label htmlFor="a-body">{t('ans.body')}</label><textarea id="a-body" name="body" required minLength={20} maxLength={2000} rows={8} /><span className="hint">{t('ans.bodyHint')}</span></div>
      {state.error && <p className="error" style={{ margin: 0 }}>{state.error}</p>}
      <button className="btn primary big" disabled={pending}>{pending ? t('common.saving') : t('ans.send')}</button>
    </form>
  );
}
