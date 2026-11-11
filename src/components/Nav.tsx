'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './Icon';
import { useT, LangSwitch } from '@/lib/i18n/client';
import type { Key } from '@/lib/i18n/dict';

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
  const active = (h: string) => (h === '/' ? path === '/' : path.startsWith(h) || (h === '/petitions' && (path.startsWith('/p/') || path === '/start')));
  return (
    <>
      <aside className="rail" aria-label={t('nav.main')}>
        <Link className="logo" href="/">UNIER</Link>
        {ITEMS.map((i) => (
          <Link key={i.href} href={i.href} aria-current={active(i.href) ? 'page' : undefined}><Icon name={i.icon} />{t(i.label)}</Link>
        ))}
        <div style={{ marginTop: 'auto' }}><LangSwitch compact /></div>
      </aside>
      <nav className="tabbar" aria-label={t('nav.main')}>
        {ITEMS.map((i) => (
          <Link key={i.href} href={i.href} className={`tab ${i.create ? 'create' : ''}`} aria-current={active(i.href) ? 'page' : undefined}><Icon name={i.icon} />{t(i.label)}</Link>
        ))}
      </nav>
    </>
  );
}
