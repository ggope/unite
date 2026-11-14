import Link from 'next/link';
import type { Metadata } from 'next';
import { loadViewer } from '@/lib/viewer';
import { localize } from '@/lib/petitionText';
import { getT } from '@/lib/i18n/server';
import { fmtN, locale } from '@/lib/i18n/dict';
import { addDays, daysLeft, silence, unierToday, targetAnchor } from '@/lib/lifecycle';
import { PetitionRow } from '@/components/PetitionRow';

export const dynamic = 'force-dynamic';
export async function generateMetadata(): Promise<Metadata> { const { t } = await getT(); return { title: `${t('nav.deadlines')} · UNIER`, description: t('dl.lead') }; }

// Deadlines: petitions that stop taking signatures soon, and delivered petitions still waiting for an answer.
export default async function Deadlines() {
  const [{ sb, viewer, signed }, { lang, t }] = await Promise.all([loadViewer(), getT()]);
  const fmt = (n: number) => fmtN(n, lang);
  const today = unierToday();
  const cols = 'id, title, target, topic, goal, status, ends_on, cluster_id, lang, tr, petition_stats(combined, united_count)';
  const [{ data: soon }, { data: ups }] = await Promise.all([
    sb.from('petitions').select(cols).eq('status', 'live').gte('ends_on', today).lte('ends_on', addDays(today, 30)).order('ends_on').limit(40),
    // delivered petitions and their answers (the same rule as the "Who listens" board)
    sb.from('petition_updates').select('petition_id, kind, created_at').in('kind', ['delivered', 'response', 'win']).order('created_at', { ascending: false }).limit(1000),
  ]);
  const byPet = new Map<string, any[]>();
  for (const u of ups ?? []) byPet.set(u.petition_id, [...(byPet.get(u.petition_id) ?? []), u]);
  const waitingIds = [...byPet].map(([id, list]) => ({ id, s: silence(list) })).filter((w) => w.s.silentDays != null).sort((a, b) => b.s.silentDays! - a.s.silentDays!).slice(0, 30);
  const { data: waitingRows } = waitingIds.length ? await sb.from('petitions').select(cols).in('id', waitingIds.map((w) => w.id)).in('status', ['live', 'closed']) : { data: [] };
  const silent = new Map(waitingIds.map((w) => [w.id, w.s]));
  const waiting = (waitingRows ?? []).map((p: any) => localize(p, lang)).sort((a: any, b: any) => silent.get(b.id)!.silentDays! - silent.get(a.id)!.silentDays!);
  const day = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString(locale(lang), { month: 'long', day: 'numeric' });
  const left = (p: any) => { const n = daysLeft(p.ends_on)!; return n <= 0 ? t('life.lastDay') : n === 1 ? t('life.tomorrow', { d: day(p.ends_on) }) : t('life.daysLeft', { d: day(p.ends_on), n }); };

  return (
    <div className="stack">
      <div className="stack" style={{ gap: 6 }}><h1 style={{ margin: 0 }}>{t('nav.deadlines')}</h1><p className="muted" style={{ margin: 0 }}>{t('dl.lead')}</p></div>
      <section className="stack" style={{ gap: 0 }} aria-labelledby="dl-soon">
        <h2 id="dl-soon" className="sechead">⏳ {t('dl.soon')}</h2>
        {(soon ?? []).length ? (soon ?? []).map((raw: any) => { const p = localize(raw, lang); const n = daysLeft(p.ends_on)!;
          return <PetitionRow key={p.id} p={p} t={t} fmt={fmt} signed={signed.has(p.id)} viewer={viewer} note={<b className={n <= 3 ? 'urgent' : undefined}>{left(p)}</b>} />; })
          : <div className="empty">{t('dl.soonNone')}</div>}
      </section>
      <section className="stack" style={{ gap: 0 }} aria-labelledby="dl-wait">
        <h2 id="dl-wait" className="sechead">📭 {t('dl.waiting')}</h2>
        <p className="hint" style={{ margin: '4px 0 0' }}>{t('dl.waitingHint')}</p>
        {waiting.length ? waiting.map((p: any) => (
          <PetitionRow key={p.id} p={p} t={t} fmt={fmt} signed={signed.has(p.id)} viewer={viewer}
            note={<Link href={`/targets#${targetAnchor(p.target)}`}><b className="urgent">{t('sil.days', { target: p.target, n: silent.get(p.id)!.silentDays! })}</b></Link>} />
        )) : <div className="empty">{t('dl.waitingNone')}</div>}
      </section>
    </div>
  );
}
