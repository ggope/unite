import Link from 'next/link';
import type { Metadata } from 'next';
import { supabaseServer } from '@/lib/supabase/server';
import { localize } from '@/lib/petitionText';
import { TOPICS, TOPIC_KEYS, type Topic } from '@/lib/topics';
import { getT } from '@/lib/i18n/server';
import { fmtN } from '@/lib/i18n/dict';
import { statOf } from '@/components/PetitionRow';

export const dynamic = 'force-dynamic';
export async function generateMetadata(): Promise<Metadata> { const { t } = await getT(); return { title: `${t('nav.causes')} · UNIER`, description: t('causes.lead') }; }

// Causes: every topic as a big coloured card with its numbers and the petitions that lead it.
export default async function Causes() {
  const [{ lang, t }, sb] = await Promise.all([getT(), supabaseServer()]);
  const { data } = await sb.from('petitions').select('id, title, target, topic, goal, cluster_id, lang, tr, petition_stats(combined, signatures)').eq('status', 'live').limit(1000);
  const by = new Map<Topic, any[]>(TOPIC_KEYS.map((k) => [k, []]));
  for (const p of data ?? []) by.get(p.topic as Topic)?.push(localize(p, lang));
  const total = (list: any[]) => list.reduce((n, p) => n + Number(statOf(p).signatures ?? statOf(p).combined ?? 0), 0);
  // the busiest causes first
  const order = [...TOPIC_KEYS].sort((a, b) => total(by.get(b)!) - total(by.get(a)!) || by.get(b)!.length - by.get(a)!.length);
  return (
    <div className="stack">
      <div className="stack" style={{ gap: 6 }}><h1 style={{ margin: 0 }}>{t('nav.causes')}</h1><p className="muted" style={{ margin: 0 }}>{t('causes.lead')}</p></div>
      <div className="causes">
        {order.map((k) => {
          const list = by.get(k)!, top = [...list].sort((a, b) => Number(statOf(b).combined) - Number(statOf(a).combined)).slice(0, 3);
          return (
            <section key={k} className="cause" style={{ '--ca': TOPICS[k].a, '--cb': TOPICS[k].b } as React.CSSProperties} aria-labelledby={`cause-${k}`}>
              <Link className="cause-head" href={`/petitions?topic=${k}`}>
                <h2 id={`cause-${k}`}>{t(`topic.${k}`)}</h2>
                <span>{t('causes.count', { p: list.length, s: fmtN(total(list), lang) })}</span>
              </Link>
              {top.length ? <ul>{top.map((p) => <li key={p.id}><Link href={`/p/${p.id}`}>{p.title}</Link> <span className="hint num">{fmtN(Number(statOf(p).combined), lang)}</span></li>)}</ul>
                : <p className="hint" style={{ margin: '0 14px' }}>{t('causes.empty')} <Link href="/start">{t('pet.startOne')}</Link>.</p>}
              <Link className="btn small" href={`/petitions?topic=${k}`}>{t('causes.all')} →</Link>
            </section>
          );
        })}
      </div>
    </div>
  );
}
