import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
// Updates and messages live together, like an inbox.
export async function InboxTabs({ active, unread }: { active: 'updates' | 'messages'; unread?: number }) {
  const { t } = await getT();
  return <nav className="chips" aria-label={t('nav.updates')}>
    <Link className="chip" aria-pressed={active === 'updates'} href="/updates">{t('inbox.updates')}</Link>
    <Link className="chip" aria-pressed={active === 'messages'} href="/messages">{t('inbox.messages')}{unread ? ` · ${unread}` : ''}</Link>
  </nav>;
}
