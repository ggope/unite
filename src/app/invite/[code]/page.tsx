import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

async function accept(form: FormData) {
  'use server';
  const code = String(form.get('code'));
  const { sb, user } = await currentUser();
  if (!user) redirect(`/login?next=/invite/${encodeURIComponent(code)}`);
  const { error } = await sb.rpc('accept_invite', { p_code: code });
  redirect(error ? `/invite/${encodeURIComponent(code)}?e=${error.message.includes('own_invite') ? 'own' : 'bad'}` : '/you?friend=1');
}

export default async function Invite({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ e?: string }> }) {
  const [{ code }, { e }, { sb, user }, { t }] = await Promise.all([params, searchParams, currentUser(), getT()]);
  const { data } = await sb.rpc('invite_owner', { p_code: code });
  const owner = (data as any[])?.[0];
  if (!owner) return <div className="empty"><p>{t('invite.bad')}</p><Link className="btn primary" href="/">UNIER</Link></div>;
  const name = owner.display_name || (owner.handle ? '@' + owner.handle : t('invite.someone'));
  return (
    <div className="stack" style={{ maxWidth: 460 }}>
      <h1>{t('invite.title', { name })}</h1>
      <p className="muted" style={{ margin: 0 }}>{t('invite.text')}</p>
      {e && <p className="error" style={{ margin: 0 }}>{e === 'own' ? t('invite.own') : t('invite.bad')}</p>}
      {user
        ? <form action={accept}><input type="hidden" name="code" value={code} /><button className="btn primary big">{t('invite.add')}</button></form>
        : <Link className="btn primary big" href={`/login?next=/invite/${encodeURIComponent(code)}`}>{t('invite.signIn', { name })}</Link>}
    </div>
  );
}
