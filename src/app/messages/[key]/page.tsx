import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n/server';
import { ChatBox, type Msg } from './ChatBox';

export const dynamic = 'force-dynamic';

export default async function Chat({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const [{ sb, user }, { t }] = await Promise.all([currentUser(), getT()]);
  if (!user) redirect(`/login?next=/messages/${key}`);
  const { data: v } = await sb.rpc('profile_view', { p_key: decodeURIComponent(key) });
  if (!v || v.relation === 'me') redirect('/messages');
  const { data } = await sb.from('messages').select('id, sender_id, body, created_at')
    .or(`and(sender_id.eq.${user.id},recipient_id.eq.${v.id}),and(sender_id.eq.${v.id},recipient_id.eq.${user.id})`)
    .order('id', { ascending: false }).limit(100);
  await sb.rpc('mark_read', { p_from: v.id });
  const name = v.display_name || (v.handle ? '@' + v.handle : t('invite.someone'));
  return (
    <div className="stack">
      <div className="row"><Link className="hint" href="/messages">←</Link>
        <Link href={`/u/${v.handle ?? v.id}`} className="convo" style={{ padding: 0 }}><span className="avatar sm" aria-hidden="true">{name.replace('@', '')[0]?.toUpperCase()}</span><b>{name}</b></Link></div>
      <p className="hint" style={{ margin: 0 }}>{t('msg.safety')}</p>
      <ChatBox me={user.id} partner={v.id} initial={((data as Msg[]) ?? []).reverse()} canSend={!!v.can_message} reason={v.relation !== 'friends' ? t('msg.notFriends') : t('msg.off')} />
    </div>
  );
}
