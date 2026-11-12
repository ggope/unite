import type { Metadata } from 'next';
import Link from 'next/link';
import { currentUser } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n/server';
import { fmtN, locale } from '@/lib/i18n/dict';
import { TOPICS } from '@/lib/topics';
import { ProfileActions, type Relation } from '@/components/ProfileActions';

export const dynamic = 'force-dynamic';
type View = { id: string; handle: string | null; display_name: string | null; bio: string | null; interests: string[]; joined: string; relation: Relation; limited: boolean; can_message: boolean; friends_count: number;
  petitions: { id: string; title: string; combined: number }[]; videos: { id: string; caption: string; petition_id: string; petition_title: string }[]; signed: { id: string; title: string }[] | null };

async function load(key: string) {
  const { sb } = await currentUser();
  const { data } = await sb.rpc('profile_view', { p_key: decodeURIComponent(key) });
  return data as View | null;
}
export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const v = await load((await params).key);
  if (!v) return { title: 'UNIER', robots: { index: false } };
  return { title: `${v.display_name || '@' + v.handle} · UNIER`, robots: { index: false } };   // people are not search-engine content
}

export default async function Profile({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const [v, { lang, t }] = await Promise.all([load(key), getT()]);
  if (!v) return <div className="empty"><h1>{t('pr.notFound')}</h1><Link className="btn" href="/">{t('nav.feed')}</Link></div>;
  const name = v.display_name || (v.handle ? '@' + v.handle : t('invite.someone'));
  const initial = (v.display_name || v.handle || '?').trim()[0]?.toUpperCase() ?? '?';
  const n = (x: number) => fmtN(Number(x), lang);
  return (
    <div className="stack profile">
      <header className="phead">
        <span className="avatar" aria-hidden="true">{initial}</span>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0 }}>{name}</h1>
          <span className="hint">{v.handle && v.display_name ? `@${v.handle} · ` : ''}{t('pr.joined', { d: new Date(v.joined).toLocaleDateString(locale(lang), { year: 'numeric', month: 'long' }) })} · {t('pr.friends', { n: n(v.friends_count) })}</span>
        </div>
      </header>
      {v.bio && <p style={{ margin: 0 }}>{v.bio}</p>}
      {v.interests?.length > 0 && <div className="stack" style={{ gap: 6 }}><span className="label">{t('pr.interests')}</span>
        <div className="row">{v.interests.map((k) => <Link key={k} className="chip" href={`/petitions?topic=${k}`} style={{ borderColor: TOPICS[k as keyof typeof TOPICS]?.b }}>{t(`topic.${k as keyof typeof TOPICS}`)}</Link>)}</div></div>}
      <ProfileActions id={v.id} name={name} handle={v.handle} relation={v.relation} canMessage={v.can_message} />
      {v.limited ? <p className="note">{t('pr.limited')}</p> : <>
        <section className="panel"><span className="label">{t('pr.started')}</span>
          {v.petitions.length ? v.petitions.map((p) => <div key={p.id} className="row between"><Link href={`/p/${p.id}`} style={{ flex: 1, minWidth: 0 }}>{p.title}</Link><span className="hint num">{n(p.combined)}</span></div>) : <p className="hint" style={{ margin: 0 }}>{t('pr.nothing')}</p>}
        </section>
        <section className="panel"><span className="label">{t('pr.videos')}</span>
          {v.videos.length ? v.videos.map((x) => <div key={x.id}><b>{x.caption}</b><div className="hint"><Link href={`/p/${x.petition_id}`}>{x.petition_title}</Link></div></div>) : <p className="hint" style={{ margin: 0 }}>{t('pr.nothing')}</p>}
        </section>
        <section className="panel"><span className="label">{t('pr.signed')}</span>
          {v.signed === null ? <p className="hint" style={{ margin: 0 }}>{t('pr.signedPrivate', { name })}</p>
            : v.signed.length ? v.signed.map((p) => <Link key={p.id} href={`/p/${p.id}`}>{p.title}</Link>) : <p className="hint" style={{ margin: 0 }}>{t('pr.nothing')}</p>}
        </section>
      </>}
    </div>
  );
}
