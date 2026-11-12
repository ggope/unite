import Link from 'next/link';
import { localize } from '@/lib/petitionText';
import { loadViewer } from '@/lib/viewer';
import { TOPICS, TOPIC_KEYS } from '@/lib/topics';
import { getT } from '@/lib/i18n/server';
import { fmtN } from '@/lib/i18n/dict';
import { SignButton } from '@/components/SignButton';
import { MyloArt } from '@/components/mylo/MyloArt';

export const dynamic = 'force-dynamic';

export default async function Petitions({ searchParams }: { searchParams: Promise<{ q?: string; topic?: string; sort?: string }> }) {
  const { q = '', topic = '', sort = 'recent' } = await searchParams;
  const [{ sb, viewer, signed }, { lang, t }] = await Promise.all([loadViewer(), getT()]);
  const fmt = (n: number) => fmtN(n, lang);
  let query = sb.from('petitions').select('id, title, target, topic, goal, cluster_id, created_at, lang, tr, petition_stats(signatures, combined, united_count)').eq('status', 'live').limit(50);
  if (q.trim()) query = query.textSearch('search', q.trim().split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean).join(' & '), { config: 'simple' });
  if (topic && topic in TOPICS) query = query.eq('topic', topic);
  const { data } = await query.order('created_at', { ascending: false });
  // one row per united group
  const seen = new Set<string>();
  let rows = (data ?? []).map((p: any) => localize(p, lang)).filter((p: any) => !p.cluster_id || (!seen.has(p.cluster_id) && seen.add(p.cluster_id)));
  const stat = (p: any) => (Array.isArray(p.petition_stats) ? p.petition_stats[0] : p.petition_stats) ?? { combined: 0, united_count: 1 };
  if (sort === 'signed') rows = rows.sort((a: any, b: any) => stat(b).combined - stat(a).combined);
  const href = (o: Record<string, string>) => '/petitions?' + new URLSearchParams({ q, topic, sort, ...o }).toString();

  return (
    <div className="stack">
      <div className="row between"><h1>{t('pet.title')}</h1><div className="row"><Link className="btn small" href="/targets">{t('board.title')}</Link><Link className="btn primary" href="/start">{t('common.startPetition')}</Link></div></div>
      <Link className="mylolink" href="/mylo"><MyloArt mood="fired" size={44} id="pet" label="" /><span>{t('mylo.goals')}<br /><span className="hint" style={{ color: '#4A453E', fontWeight: 600 }}>{t('mylo.goalsText')}</span></span>→</Link>
      <form className="field" action="/petitions"><input name="q" type="search" defaultValue={q} placeholder={t('pet.search')} aria-label={t('pet.search')} /><input type="hidden" name="topic" value={topic} /></form>
      <div className="chips">
        <Link className="chip" aria-current={(!topic) ? 'page' : undefined} href={href({ topic: '' })}>{t('pet.all')}</Link>
        {TOPIC_KEYS.map((k) => <Link key={k} className="chip" aria-current={(topic === k) ? 'page' : undefined} href={href({ topic: k })}>{t(`topic.${k}`)}</Link>)}
      </div>
      <div className="row"><Link className="chip" aria-current={(sort === 'recent') ? 'page' : undefined} href={href({ sort: 'recent' })}>{t('pet.recent')}</Link><Link className="chip" aria-current={(sort === 'signed') ? 'page' : undefined} href={href({ sort: 'signed' })}>{t('pet.mostSigned')}</Link></div>
      <div>
        {rows.length ? rows.map((p: any) => (
          <div className="prow" key={p.id}>
            <div className="stack" style={{ gap: 6, minWidth: 0 }}>
              <span className="hint">{t(`topic.${p.topic as keyof typeof TOPICS}`)} · {t('pet.to', { target: p.target })} {stat(p).united_count > 1 && <span className="united">{t('pet.united', { n: stat(p).united_count })}</span>}</span>
              <h2><Link href={`/p/${p.id}`}>{p.title}</Link></h2>
              <span className="row hint"><b className="num">{fmt(stat(p).combined)}</b> {t('common.of')} {fmt(p.goal)}<span className="prog"><i style={{ width: `${Math.min(100, stat(p).combined / p.goal * 100)}%` }} /></span></span>
            </div>
            <SignButton variant="small" petitionId={p.id} title={p.title} signed={signed.has(p.id)} viewer={viewer} />
          </div>
        )) : <div className="empty">{t('pet.none')} <Link href="/start">{t('pet.startOne')}</Link>.</div>}
      </div>
    </div>
  );
}
