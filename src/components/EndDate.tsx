'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useT } from '@/lib/i18n/client';
import { addDays, unierToday } from '@/lib/lifecycle';

// The organiser sets, moves or clears the end date. The database checks it is from tomorrow up to a year after the start.
export function EndDate({ petitionId, endsOn, createdAt }: { petitionId: string; endsOn: string | null; createdAt: string }) {
  const { t } = useT(); const router = useRouter();
  const [v, setV] = useState(endsOn ?? ''); const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const min = addDays(unierToday(), 1), max = addDays(unierToday(new Date(createdAt)), 366);
  async function save(date: string | null) {
    setBusy(true); setMsg(null);
    const { error } = await supabaseBrowser().rpc('set_end_date', { p_petition: petitionId, p_date: date });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: /end_date_(past|far)/.test(error.message) ? t('start.errEnd') : t('upd.err') }); return; }
    if (!date) setV('');
    setMsg({ ok: true, text: t('life.saved') }); router.refresh();
  }
  return (
    <form className="panel end-date" onSubmit={(e) => { e.preventDefault(); save(v || null); }}>
      <label htmlFor="end-date"><b>{t('life.endTitle')}</b></label>
      <span className="hint">{t('life.endHint')}</span>
      <div className="row">
        <input id="end-date" type="date" value={v} min={min} max={max} onChange={(e) => setV(e.target.value)} />
        <button className="btn small primary" disabled={busy || v === (endsOn ?? '')}>{t('life.save')}</button>
        {endsOn && <button type="button" className="btn small ghost" disabled={busy} onClick={() => save(null)}>{t('life.noEnd')}</button>}
      </div>
      {msg && <p className={msg.ok ? 'ok' : 'error'} role="status" style={{ margin: 0 }}>{msg.text}</p>}
    </form>
  );
}
