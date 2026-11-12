'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useT } from '@/lib/i18n/client';

// One tap after handing the petition over: everyone following hears it was delivered.
export function MarkDelivered({ petitionId, target, userId }: { petitionId: string; target: string; userId: string }) {
  const { t } = useT(); const router = useRouter();
  const [busy, setBusy] = useState(false); const [done, setDone] = useState(false); const [err, setErr] = useState('');
  async function mark() {
    setBusy(true); setErr('');
    const title = t('dlv.title', { target }).slice(0, 140);
    const { error } = await supabaseBrowser().from('petition_updates').insert({ petition_id: petitionId, kind: 'delivered', title, created_by: userId });
    setBusy(false);
    if (error) { setErr(error.message.includes('slow_down') ? t('err.slow') : t('upd.err')); return; }
    fetch('/api/push', { method: 'POST', keepalive: true }).catch(() => {});
    setDone(true); router.refresh();
  }
  if (done) return <p className="ok" role="status" style={{ margin: 0 }}>{t('dlv.done')}</p>;
  return <>{err && <p className="error" style={{ margin: 0 }}>{err}</p>}<button type="button" className="btn primary" onClick={mark} disabled={busy}>{t('dlv.mark')}</button></>;
}
