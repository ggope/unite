import Link from 'next/link';
import { currentUser } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n/server';
import { locale } from '@/lib/i18n/dict';
import { InboxTabs } from '@/components/InboxTabs';
import { PeopleSearch } from '@/components/PeopleSearch';

export const dynamic = 'force-dynamic';
type C = { partner: string; handle: string | null; display_name: string | null; last_body: string; last_at: string; last_mine: boolean; unread: number };

export default async function Messages() {
  const [{ sb, user }, { lang, t }] = await Promise.all([currentUser(), getT()]);
  if (!user) return <div className="empty"><h1>{t('msg.title')}</h1><Link className="btn primary" href="/login?next=/messages">{t('common.signIn')}</Link></div>;
  const { data } = await sb.rpc('conversations');
  const list = (data as C[]) ?? [];
  const unread = list.reduce((a, c) => a + c.unread, 0);
  const when = (d: string) => { const x = new Date(d); return x.toDateString() === new Date().toDateString() ? x.toLocaleTimeString(locale(lang), { hour: '2-digit', minute: '2-digit' }) : x.toLocaleDateString(locale(lang), { month: 'short', day: 'numeric' }); };
  return (
    <div className="stack">
      <h1>{t('msg.title')}</h1>
      <InboxTabs active="messages" unread={unread} />
      <div className="panel" style={{ gap: 4 }}>
        {list.length ? list.map((c) => (
          <Link key={c.partner} className="convo" href={`/messages/${c.handle ?? c.partner}`}>
            <span className="avatar sm" aria-hidden="true">{(c.display_name || c.handle || '?')[0].toUpperCase()}</span>
            <span className="meta"><b>{c.display_name || '@' + c.handle}</b><span className={c.unread ? '' : 'hint'}>{c.last_mine ? t('msg.you') : ''}{c.last_body}</span></span>
            <span className="hint">{when(c.last_at)}</span>{c.unread > 0 && <span className="badge">{c.unread}</span>}
          </Link>)) : <p className="hint" style={{ margin: 0 }}>{t('msg.none')}</p>}
      </div>
      <div className="panel"><span className="label">{t('friends.find')}</span><PeopleSearch /></div>
    </div>
  );
}
