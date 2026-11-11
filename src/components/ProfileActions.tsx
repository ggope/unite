'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useT } from '@/lib/i18n/client';
import { ReportButton } from './ReportButton';

export type Relation = 'me' | 'guest' | 'blocked' | 'friends' | 'requested' | 'incoming' | 'none';

// Add friend, accept, message, block: every action a visitor can take on someone's profile.
export function ProfileActions({ id, name, handle, relation, canMessage }: { id: string; name: string; handle: string | null; relation: Relation; canMessage: boolean }) {
  const { t } = useT(); const router = useRouter(); const path = usePathname(); const sb = supabaseBrowser();
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [more, setMore] = useState(false);
  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true); setErr('');
    const { error } = await fn();
    setBusy(false);
    if (error) setErr(error.message.includes('too_many') ? t('msg.slow') : t('sign.errOther')); else router.refresh();
  }
  const me = async () => (await sb.auth.getSession()).data.session?.user.id;
  const add = () => run(() => sb.rpc('request_friend', { p_to: id }));
  const accept = () => run(() => sb.rpc('accept_friend', { p_from: id }));
  const drop = () => run(async () => { const m = await me(); return sb.from('friend_requests').delete().or(`and(from_id.eq.${m},to_id.eq.${id}),and(from_id.eq.${id},to_id.eq.${m})`); });
  const unfriend = () => run(() => sb.rpc('remove_friend', { p_friend: id }));
  const block = () => { if (confirm(t('pr.blockConfirm', { name }))) run(() => sb.rpc('block_user', { p_user: id })); };
  const unblock = () => run(async () => sb.from('blocks').delete().eq('blocked_id', id));

  if (relation === 'me') return <div className="row"><Link className="btn small" href="/you#profile">{t('pr.edit')}</Link></div>;
  if (relation === 'guest') return <div className="row"><Link className="btn primary small" href={`/login?next=${encodeURIComponent(path)}`}>{t('pr.signIn')}</Link></div>;
  if (relation === 'blocked') return <div className="stack" style={{ gap: 8 }}><p className="note" style={{ margin: 0 }}>{t('pr.blocked')}</p><div className="row"><button className="btn small" disabled={busy} onClick={unblock}>{t('pr.unblock')}</button></div></div>;
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row">
        {relation === 'none' && <button className="btn primary small" disabled={busy} onClick={add}>{t('pr.add')}</button>}
        {relation === 'requested' && <><span className="pill">{t('pr.requested')}</span><button className="btn ghost small" disabled={busy} onClick={drop}>{t('pr.cancel')}</button></>}
        {relation === 'incoming' && <><button className="btn primary small" disabled={busy} onClick={accept}>{t('pr.accept')}</button><button className="btn ghost small" disabled={busy} onClick={drop}>{t('pr.decline')}</button></>}
        {relation === 'friends' && <span className="pill ok-pill">✓ {t('pr.isFriend')}</span>}
        {relation === 'friends' && canMessage && <Link className="btn primary small" href={`/messages/${handle ?? id}`}>{t('pr.message')}</Link>}
        <button className="btn ghost small" aria-expanded={more} onClick={() => setMore(!more)}>{t('pr.more')} ⋯</button>
      </div>
      {more && <div className="row">
        {relation === 'friends' && <button className="btn ghost small" disabled={busy} onClick={unfriend}>{t('pr.unfriend')}</button>}
        <button className="btn ghost small danger" disabled={busy} onClick={block}>{t('pr.block')}</button>
        <ReportButton profileId={id} loggedIn />
      </div>}
      {err && <p className="error" style={{ margin: 0 }}>{err}</p>}
    </div>
  );
}
