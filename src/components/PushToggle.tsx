'use client';
import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n/client';
import { supabaseBrowser } from '@/lib/supabase/client';

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const b64 = (s: string) => { const p = '='.repeat((4 - (s.length % 4)) % 4); const r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(r, (c) => c.charCodeAt(0)); };

type State = 'loading' | 'unsupported' | 'ios' | 'off' | 'on' | 'blocked' | 'busy';

// Phone notifications for petitions you signed or follow. `compact` is the one-line offer after signing.
export function PushToggle({ compact = false }: { compact?: boolean }) {
  const { lang, t } = useT();
  const [st, setSt] = useState<State>('loading');
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!KEY) return setSt('unsupported');
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return setSt(ios && !standalone ? 'ios' : 'unsupported');
    if (Notification.permission === 'denied') return setSt('blocked');
    navigator.serviceWorker.getRegistration('/').then((r) => r?.pushManager.getSubscription()).then((s) => setSt(s ? 'on' : 'off')).catch(() => setSt('off'));
  }, []);

  async function turnOn() {
    setSt('busy'); setErr('');
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      if ((await Notification.requestPermission()) !== 'granted') { setSt(Notification.permission === 'denied' ? 'blocked' : 'off'); return; }
      const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(KEY) });
      const j = sub.toJSON() as any;
      const { error } = await supabaseBrowser().rpc('save_push', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_lang: lang });
      if (error) throw error;
      setSt('on');
    } catch { setErr(t('push.err')); setSt('off'); }
  }
  async function turnOff() {
    setSt('busy');
    try {
      const sub = await (await navigator.serviceWorker.getRegistration('/'))?.pushManager.getSubscription();
      if (sub) { await supabaseBrowser().from('push_subscriptions').delete().eq('endpoint', sub.endpoint); await sub.unsubscribe(); }
    } catch {}
    setSt('off');
  }

  if (st === 'loading' || st === 'unsupported') return null;
  if (compact) {
    if (st !== 'off' && st !== 'busy') return null;
    return <button type="button" className="btn small" onClick={turnOn} disabled={st === 'busy'}>🔔 {t('push.offer')}</button>;
  }
  return (
    <div className="panel">
      <span className="label">{t('push.title')}</span>
      <p className="hint" style={{ margin: 0 }}>{st === 'ios' ? t('push.ios') : st === 'blocked' ? t('push.blocked') : t('push.hint')}</p>
      {(st === 'off' || st === 'busy') && <button type="button" className="btn primary" onClick={turnOn} disabled={st === 'busy'}>{t('push.on')}</button>}
      {st === 'on' && <div className="row between"><b>✓ {t('push.isOn')}</b><button type="button" className="btn small" onClick={turnOff}>{t('push.off')}</button></div>}
      {err && <p className="note" role="alert" style={{ margin: 0 }}>{err}</p>}
    </div>
  );
}
