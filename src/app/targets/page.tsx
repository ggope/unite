import Link from 'next/link';
import type { Metadata } from 'next';
import { publicRpc, publicPetitions } from '@/lib/supabase/public';
import { getT } from '@/lib/i18n/server';
import { fmtN } from '@/lib/i18n/dict';
import { localize } from '@/lib/petitionText';

export const revalidate = 300;
export async function generateMetadata(): Promise<Metadata> { const { t } = await getT(); return { title: `${t('board.title')} · UNIER`, description: t('board.intro') }; }

// Who listens: every target, what reached them, and how long they have been silent.
export default async function Targets() {
  const { lang, t } = await getT();   // first: it reads the language cookie, so the build never caches build-time numbers
  const rows = await publicRpc('accountability') as any[] | null;
  const ids = [...new Set((rows ?? []).flatMap((r: any) => (r.ids ?? []).slice(0, 3) as string[]))];
  const ps = ids.length ? await publicPetitions(ids) : [];
  const byId = new Map((ps ?? []).map((p: any) => [p.id, localize(p, lang)]));
  return (
    <div className="stack">
      <h1>{t('board.title')}</h1>
      <p className="muted" style={{ margin: 0 }}>{t('board.intro')}</p>
      {(rows ?? []).length ? (rows as any[]).map((r) => {
        const first: any = byId.get(r.ids?.[0]);
        const status = r.wins ? 'win' : r.silent_days != null ? 'silent' : r.answered ? 'answered' : r.delivered ? 'delivered' : 'waiting';
        return (
          <article key={r.ids?.[0]} className={`panel target t-${status}`}>
            <div className="row between" style={{ alignItems: 'flex-start' }}>
              <h2 style={{ flex: 1, minWidth: 0 }}>{first?.target ?? r.target}</h2>
              <span className={`tbadge t-${status}`}>{status === 'silent' ? t('board.silent', { n: r.silent_days }) : t(`board.${status}` as any)}</span>
            </div>
            <span className="hint">{t('board.line', { p: r.petitions, s: fmtN(Number(r.signatures), lang), d: r.delivered, a: r.answered })}</span>
            <ul className="tlist">{(r.ids ?? []).slice(0, 3).map((id: string) => byId.get(id) && <li key={id}><Link href={`/p/${id}`}>{(byId.get(id) as any).title}</Link></li>)}</ul>
          </article>
        );
      }) : <div className="empty">{t('board.none')}</div>}
      <p className="hint">{t('board.how')}</p>
    </div>
  );
}
