'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Icon } from './Icon';
import { useT } from '@/lib/i18n/client';

// "Save for later": a private bookmark to sign or share later. Nobody else sees it (0028_saved.sql).
export function SaveButton({ petitionId, saved: initial, loggedIn, refresh }: { petitionId: string; saved: boolean; loggedIn: boolean; refresh?: boolean }) {
  const [on, setOn] = useState(initial); const [busy, setBusy] = useState(false); const [err, setErr] = useState(false);
  const { t } = useT(); const router = useRouter();
  async function toggle() {
    if (!loggedIn) { router.push(`/login?next=${encodeURIComponent(location.pathname)}`); return; }
    const sb = supabaseBrowser(); const { data } = await sb.auth.getUser(); if (!data.user) return;
    setBusy(true); setErr(false);
    const { error } = on ? await sb.from('saved_petitions').delete().eq('petition_id', petitionId)
      : await sb.from('saved_petitions').insert({ petition_id: petitionId, user_id: data.user.id });
    setBusy(false);
    if (error && error.code !== '23505') { setErr(true); return; }
    setOn(!on); if (refresh) router.refresh();
  }
  return (
    <>
      <button className="btn ghost small save-btn" aria-pressed={on} disabled={busy} onClick={toggle} title={on ? t('saved.remove') : t('saved.save')}>
        <Icon name="star" />{on ? t('saved.saved') : t('saved.save')}
      </button>
      {err && <span className="hint" role="alert">{t('saved.err')}</span>}
    </>
  );
}
