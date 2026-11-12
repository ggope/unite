'use client';
import { logoSvg } from '@/lib/logo';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Icon } from './Icon';
import { useT, LangSwitch } from '@/lib/i18n/client';
import type { Key } from '@/lib/i18n/langs';

const ITEMS: { href: string; label: Key; icon: string; create?: boolean }[] = [
  { href: '/', label: 'nav.feed', icon: 'feed' },
  { href: '/petitions', label: 'nav.petitions', icon: 'petitions' },
  { href: '/post', label: 'nav.create', icon: 'plus', create: true },
  { href: '/updates', label: 'nav.updates', icon: 'updates' },
  { href: '/you', label: 'nav.you', icon: 'you' },
];
export function Nav() {
  const path = usePathname();
  const { t } = useT();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!document.cookie.includes('-auth-token')) return;
    let gone = false;
    const sb = supabaseBrowser();
    const count = (r: { data: unknown }) => (typeof r.data === 'number' ? r.data : 0);
    // Updates and messages share the inbox badge.
    Promise.all([path.startsWith('/updates') ? { data: 0 } : sb.rpc('unread_updates'), sb.rpc('unread_messages')])
      .then(([u, m]) => { if (!gone) setUnread(count(u) + count(m)); });
    return () => { gone = true; };
  }, [path]);
  const dot = (h: string) => h === '/updates' && unread > 0 ? <span className="badge" aria-label={`${unread} ${t('nav.new')}`}>{unread > 9 ? '9+' : unread}</span> : null;
  const active = (h: string) => (h === '/' ? path === '/' : path.startsWith(h) || (h === '/updates' && path.startsWith('/messages')) || (h === '/petitions' && (path.startsWith('/p/') || path === '/start')));
  return (
    <>
      <aside className="rail" aria-label={t('nav.main')}>
        <Link className="logo" href="/"><span className="logo-mark" aria-hidden="true" dangerouslySetInnerHTML={{ __html: logoSvg({ round: true, blink: true, id: 'rail-logo' }) }} />UNIER</Link>
        {ITEMS.map((i) => (
          <Link key={i.href} href={i.href} aria-current={active(i.href) ? 'page' : undefined}><Icon name={i.icon} />{t(i.label)}{dot(i.href)}</Link>
        ))}
        <Link href="/mylo" aria-current={path.startsWith('/mylo') ? 'page' : undefined}><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="14" r="8" fill="#FF8A2A" stroke="currentColor" strokeWidth="2" /><path d="M12 6c-1-3 1-4 2-4 0 2-1 3-2 4zm0 0c2-2 4-2 5-1-1 2-3 2-5 1z" fill="#3DBA5C" /></svg>{t('mylo.meet')}</Link>
        <div style={{ marginTop: 'auto' }}><LangSwitch compact /></div>
      </aside>
      <nav className="tabbar" aria-label={t('nav.main')}>
        {ITEMS.map((i) => (
          <Link key={i.href} href={i.href} className={`tab ${i.create ? 'create' : ''}`} aria-current={active(i.href) ? 'page' : undefined}><Icon name={i.icon} />{t(i.label)}{dot(i.href)}</Link>
        ))}
      </nav>
    </>
  );
}
