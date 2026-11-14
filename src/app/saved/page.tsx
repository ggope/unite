import Link from 'next/link';
import type { Metadata } from 'next';
import { loadViewer } from '@/lib/viewer';
import { localize } from '@/lib/petitionText';
import { getT } from '@/lib/i18n/server';
import { fmtN } from '@/lib/i18n/dict';
import { PetitionRow } from '@/components/PetitionRow';
import { SaveButton } from '@/components/SaveButton';
import { MyloArt } from '@/components/mylo/MyloArt';

export const dynamic = 'force-dynamic';
export async function generateMetadata(): Promise<Metadata> { const { t } = await getT(); return { title: `${t('nav.saved')} · UNIER`, description: t('saved.lead') }; }

// Saved: petitions you put aside to sign or share later, and the ones you follow for news.
export default async function Saved() {
  const [{ sb, user, viewer, signed }, { lang, t }] = await Promise.all([loadViewer(), getT()]);
  const fmt = (n: number) => fmtN(n, lang);
  const head = <div className="stack" style={{ gap: 6 }}><h1 style={{ margin: 0 }}>{t('nav.saved')}</h1><p className="muted" style={{ margin: 0 }}>{t('saved.lead')}</p></div>;
  if (!user) return <div className="stack">{head}<div className="empty"><MyloArt mood="happy" size={90} id="saved" label="" /><p>{t('saved.signedOut')}</p><Link className="btn primary" href="/login?next=/saved">{t('common.signIn')}</Link></div></div>;
  const cols = 'id, title, target, topic, goal, status, cluster_id, lang, tr, petition_stats(combined, united_count)';
  const [{ data: saved }, { data: fol }] = await Promise.all([
    sb.from('saved_petitions').select(`created_at, petitions(${cols})`).order('created_at', { ascending: false }).limit(200),   // empty before 0028 has run
    sb.from('follows').select(`created_at, petitions(${cols})`).order('created_at', { ascending: false }).limit(100),
  ]);
  const list = (rows: any[] | null) => (rows ?? []).map((r) => r.petitions).filter((p: any) => p && p.status !== 'removed').map((p: any) => localize(p, lang));
  const mine = list(saved), following = list(fol);
  const toSign = mine.filter((p: any) => p.status === 'live' && !signed.has(p.id)).length;
  return (
    <div className="stack">
      {head}
      <section className="stack" style={{ gap: 0 }} aria-labelledby="sv-later">
        <h2 id="sv-later" className="sechead">⭐ {t('saved.later')}{toSign > 0 && <span className="pill">{t('saved.toSign', { n: toSign })}</span>}</h2>
        {mine.length ? mine.map((p: any) => (
          <PetitionRow key={p.id} p={p} t={t} fmt={fmt} signed={signed.has(p.id)} viewer={viewer}
            note={p.status === 'closed' ? t('saved.closed') : signed.has(p.id) ? t('saved.signedShare') : undefined}
            action={<SaveButton petitionId={p.id} saved loggedIn refresh />} />
        )) : <div className="empty">{t('saved.none')} <Link href="/petitions">{t('nav.petitions')}</Link></div>}
      </section>
      <section className="stack" style={{ gap: 0 }} aria-labelledby="sv-follow">
        <h2 id="sv-follow" className="sechead">🔔 {t('saved.following')}</h2>
        <p className="hint" style={{ margin: '4px 0 0' }}>{t('saved.followingHint')}</p>
        {following.length ? following.map((p: any) => <PetitionRow key={p.id} p={p} t={t} fmt={fmt} signed={signed.has(p.id)} viewer={viewer} />)
          : <div className="empty">{t('saved.followingNone')}</div>}
      </section>
    </div>
  );
}
