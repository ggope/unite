import Link from 'next/link';
import { loadViewer } from '@/lib/viewer';
import { getT } from '@/lib/i18n/server';
import { locale } from '@/lib/i18n/dict';

export const dynamic = 'force-dynamic';

export default async function Updates() {
  const [{ sb, user, signed, followed }, { lang, t }] = await Promise.all([loadViewer(), getT()]);
  if (!user) return <div className="empty"><h2>{t('upd.title')}</h2><p>{t('upd.signedOut')}</p><Link className="btn primary" href="/login?next=/updates">{t('common.signIn')}</Link></div>;
  const ids = [...new Set([...signed, ...followed])];
  const { data } = ids.length
    ? await sb.from('petition_updates').select('id, kind, title, body, created_at, petition_id, petitions(title)').in('petition_id', ids).order('created_at', { ascending: false }).limit(50)
    : { data: [] as any[] };
  await sb.from('user_settings').update({ updates_seen_at: new Date().toISOString() }).eq('user_id', user.id);
  return (
    <div className="stack"><h1>{t('upd.title')}</h1><p className="muted" style={{ margin: 0 }}>{t('upd.intro')}</p>
      {data?.length ? data.map((u: any) => (
        <div className="panel" key={u.id} style={{ gap: 4 }}>
          <span className="hint">{t(`kind.${u.kind as 'win'}`)} · {new Date(u.created_at).toLocaleDateString(locale(lang))}</span>
          <b>{u.title}</b>
          <Link href={`/p/${u.petition_id}`}>{u.petitions?.title}</Link>
          {u.body && <p style={{ margin: 0 }} className="muted">{u.body}</p>}
        </div>)) : <div className="empty">{t('upd.none')}</div>}
    </div>
  );
}
