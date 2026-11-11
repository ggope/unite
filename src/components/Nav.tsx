'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './Icon';

const ITEMS = [
  { href: '/', label: 'Feed', icon: 'feed' },
  { href: '/petitions', label: 'Petitions', icon: 'petitions' },
  { href: '/post', label: 'Create', icon: 'plus', create: true },
  { href: '/updates', label: 'Updates', icon: 'updates' },
  { href: '/you', label: 'You', icon: 'you' },
];
export function Nav() {
  const path = usePathname();
  const active = (h: string) => (h === '/' ? path === '/' : path.startsWith(h) || (h === '/petitions' && (path.startsWith('/p/') || path === '/start')));
  return (
    <>
      <aside className="rail" aria-label="Main">
        <Link className="logo" href="/">UNIER</Link>
        {ITEMS.map((i) => (
          <Link key={i.href} href={i.href} aria-current={active(i.href) ? 'page' : undefined}><Icon name={i.icon} />{i.label}</Link>
        ))}
      </aside>
      <nav className="tabbar" aria-label="Main">
        {ITEMS.map((i) => (
          <Link key={i.href} href={i.href} className={`tab ${i.create ? 'create' : ''}`} aria-current={active(i.href) ? 'page' : undefined}><Icon name={i.icon} />{i.label}</Link>
        ))}
      </nav>
    </>
  );
}
