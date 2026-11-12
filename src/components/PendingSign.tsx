'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { CONSENT_VERSION } from '@/lib/topics';
import { useT } from '@/lib/i18n/client';
import { signRpc } from '@/lib/sign';
import { myloCheer } from './mylo/MyloCorner';

// A signature started while signed out waits here until the email link signs the person in.
type Pending = { petitionId: string; email: string; why: string; show: boolean; lang: string; at: number };
const KEY = 'unier-pending-sign';
const DAY = 24 * 3600 * 1000;

export function savePending(p: Pending) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {} }
function takePending(): Pending | null {
  try {
    const raw = localStorage.getItem(KEY); if (!raw) return null;
    const p = JSON.parse(raw) as Pending;
    return p && typeof p.petitionId === 'string' && Date.now() - p.at < DAY ? p : (localStorage.removeItem(KEY), null);
  } catch { return null; }
}

export function PendingSign() {
  const { t } = useT();
  const router = useRouter();
  const [msg, setMsg] = useState<'' | 'ok' | 'err'>('');
  useEffect(() => {
    const p = takePending();
    if (!p || !document.cookie.includes('-auth-token')) return;
    const sb = supabaseBrowser();
    (async () => {
      const { data } = await sb.auth.getSession();
      // Only finish it for the person who asked for the link.
      if (!data.session || data.session.user.email?.toLowerCase() !== p.email) return;
      try { localStorage.removeItem(KEY); } catch {}
      const c = await sb.rpc('give_signature_consent', { p_text_version: p.lang === 'en' ? CONSENT_VERSION : `${CONSENT_VERSION}-${p.lang}` });
      const s = c.error ? c : await signRpc(sb, { petition: p.petitionId, why: p.why || null, show: p.show && !!p.why });
      const already = s.error && /duplicate|already/i.test(s.error.message);
      setMsg(!s.error || already ? 'ok' : 'err');
      if (!s.error) myloCheer(typeof s.data === 'number' ? s.data : undefined);
      router.refresh();
      setTimeout(() => setMsg(''), 6000);
    })();
  }, [router]);
  if (!msg) return null;
  return <div className="undo" role="status"><span>{msg === 'ok' ? t('guest.confirmed') : t('sign.errOther')}</span></div>;
}
