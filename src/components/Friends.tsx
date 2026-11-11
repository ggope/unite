'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useT } from '@/lib/i18n/client';

type F = { id: string; handle: string | null; display_name: string | null };

export function Friends({ code: initial, friends }: { code: string | null; friends: F[] }) {
  const { t } = useT(); const router = useRouter(); const sb = supabaseBrowser();
  const [code, setCode] = useState(initial); const [copied, setCopied] = useState(false);
  const link = code ? `${typeof location !== 'undefined' ? location.origin : ''}/invite/${code}` : '';
  async function copy() { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {} }
  async function share() { try { await navigator.share({ title: 'UNIER', text: t('friends.shareText'), url: link }); } catch {} }
  async function renew() { const { data } = await sb.rpc('my_invite_code', { p_new: true }); if (data) setCode(data as string); }
  async function remove(id: string) { await sb.rpc('remove_friend', { p_friend: id }); router.refresh(); }
  return (
    <div className="panel"><span className="label">{t('friends.title')}</span>
      {friends.length ? friends.map((f) => (
        <div className="row between" key={f.id}><span>{f.display_name || (f.handle ? '@' + f.handle : t('invite.someone'))}</span>
          <button className="btn ghost small" onClick={() => remove(f.id)}>{t('friends.remove')}</button></div>
      )) : <p className="hint" style={{ margin: 0 }}>{t('friends.none')}</p>}
      {code && <>
        <input readOnly value={link} aria-label={t('friends.title')} onFocus={(e) => e.currentTarget.select()} style={{ border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 10, padding: '10px 12px', width: '100%', minWidth: 0 }} />
        <div className="row">
          {typeof navigator !== 'undefined' && 'share' in navigator && <button className="btn primary small" onClick={share}>{t('friends.share')}</button>}
          <button className="btn small" onClick={copy}>{copied ? t('friends.copied') : t('friends.copy')}</button>
          <button className="btn ghost small" onClick={renew}>{t('friends.newLink')}</button>
        </div>
        <p className="hint" style={{ margin: 0 }}>{t('friends.inviteHint')}</p>
      </>}
    </div>
  );
}
