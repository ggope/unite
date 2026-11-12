import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
// Updates and messages live together, like an inbox.
export async function InboxTabs({ active, unread }: { active: 'updates' | 'messages'; unread?: number }) {
  const { t } = await getT();
  return <nav className="chips" aria-label={t('nav.updates')}>
    <Link className="chip" aria-current={(active === 'updates') ? 'page' : undefined} href="/updates">{t('inbox.updates')}</Link>
    <Link className="chip" aria-current={(active === 'messages') ? 'page' : undefined} href="/messages">{t('inbox.messages')}{unread ? ` · ${unread}` : ''}</Link>
  </nav>;
}
