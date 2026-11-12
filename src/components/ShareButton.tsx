'use client';
import { useEffect, useState } from 'react';
import { myShareCode } from '@/lib/shareCode';
import { useT } from '@/lib/i18n/client';
import { Icon } from './Icon';

// The phone's own share sheet (WhatsApp, Messenger, Instagram…), or copy the link where that is not available.
export function ShareButton({ path, title, variant = 'button', onShare }: { path: string; title: string; variant?: 'button' | 'reel'; onShare?: () => void }) {
  const { t } = useT(); const [copied, setCopied] = useState(false);
  // your code rides along, so You can show how many people signed through you
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => { myShareCode().then(setCode).catch(() => {}); }, []);
  async function go() {
    onShare?.();
    const url = location.origin + path + (code ? `${path.includes('?') ? '&' : '?'}r=${code}` : '');
    if (navigator.share) { try { await navigator.share({ title, url }); return; } catch (e: any) { if (e?.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  }
  const label = copied ? t('share.copied') : t('share.link');
  return variant === 'reel'
    ? <button className="rb" onClick={go}><span className="c"><Icon name="share" /></span>{label}</button>
    : <button className="btn ghost small" onClick={go}><Icon name="share" />{label}</button>;
}
