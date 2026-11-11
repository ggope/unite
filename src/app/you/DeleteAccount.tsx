'use client';
import { useState } from 'react';

export function DeleteAccount() {
  const [armed, setArmed] = useState(false); const [msg, setMsg] = useState('');
  async function go() {
    if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 5000); return; }
    const r = await fetch('/api/account/delete', { method: 'POST' });
    if (r.ok) window.location.href = '/'; else setMsg('Could not delete the account. Try again or contact us.');
  }
  return <div><button className="btn small danger" onClick={go}>{armed ? 'Tap again to delete everything' : 'Delete my account and all data'}</button>{msg && <p className="error">{msg}</p>}</div>;
}
