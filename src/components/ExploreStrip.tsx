import Link from 'next/link';
import type { T } from '@/lib/i18n/langs';
import { MORE } from '@/lib/nav';
import { NavIcon } from './Nav';

// Phones have no left bar: this swipeable row puts its pages one tap away, ending in "More" (the Explore page).
export function ExploreStrip({ t }: { t: T }) {
  const items = MORE.flatMap((g) => g.items).slice(0, 6);
  return (
    <nav className="exstrip" aria-label={t('nav.explore')}>
      {items.map((i) => <Link key={i.href} href={i.href}><NavIcon name={i.icon} />{t(i.label)}</Link>)}
      <Link href="/explore" className="more"><NavIcon name="menu" />{t('nav.more')}</Link>
    </nav>
  );
}
