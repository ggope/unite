'use client';
import { useState } from 'react';
import { useT } from '@/lib/i18n/client';

export function DeleteAccount() {
  const { t } = useT();
  const [armed, setArmed] = useState(false); const [msg, setMsg] = useState('');
  async function go() {
    if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 5000); return; }
    const r = await fetch('/api/account/delete', { method: 'POST' });
    if (r.ok) window.location.href = '/'; else setMsg(t('you.deleteErr'));
  }
  return <div><button className="btn small danger" onClick={go}>{armed ? t('you.deleteConfirm') : t('you.delete')}</button>{msg && <p className="error">{msg}</p>}</div>;
}
