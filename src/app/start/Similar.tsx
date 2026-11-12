'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useT } from '@/lib/i18n/client';
import { fmtN } from '@/lib/i18n/langs';
import { localize } from '@/lib/petitionText';

// Common words that say nothing about what a petition asks for.
const STOP = new Set(('with from that this these those must should every more have into their about other after before ' +
  'against without where which while there what when your ours were been will would could make made need stop ban ' +
  'hogy minden kell vagy mert csak egy nem amely ahol után előtt nélkül ' +
  'für eine einen einem einer nicht alle allen sind wird werden auch oder mehr ohne gegen ' +
  'para todos todas sobre contra entre como más pero ' +
  'pour dans avec tous toutes sont être plus sans contre').split(/\s+/));
export const keywords = (s: string) =>
  [...new Set(s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 4 && !STOP.has(w)))].slice(0, 10);

type Hit = { id: string; title: string; target: string; n: number };

// While someone writes a petition, show live petitions that already ask for much the same thing.
// Joining one keeps the signatures together, which is what UNIER is for. It never blocks posting.
export function Similar({ title, target }: { title: string; target: string }) {
  const { lang, t } = useT();
  const [hits, setHits] = useState<Hit[]>([]);
  useEffect(() => {
    const words = keywords(`${title} ${target}`), tw = keywords(title);
    if (words.length < 2 || title.trim().length < 12) { setHits([]); return; }
    let live = true;
    const timer = setTimeout(async () => {
      const { data } = await supabaseBrowser().from('petitions').select('id, title, target, ask, lang, tr, petition_stats(combined)')
        .eq('status', 'live').textSearch('search', words.join(' | '), { config: 'simple' }).limit(25);
      if (!live) return;
      const scored = ((data ?? []) as any[]).map((p) => {
        const text = keywords(`${p.title} ${p.target} ${p.ask}`);
        const score = words.filter((w) => text.includes(w)).length;
        const fromTitle = tw.filter((w) => text.includes(w)).length;   // the same target alone is not the same petition
        const st = Array.isArray(p.petition_stats) ? p.petition_stats[0] : p.petition_stats;
        const l = localize(p, lang);
        return { id: p.id, title: l.title, target: l.target, n: Number(st?.combined ?? 0), score, fromTitle };
      }).filter((p) => p.score >= 2 && p.fromTitle >= 1).sort((a, b) => b.score - a.score || b.n - a.n).slice(0, 3);
      setHits(scored);
    }, 500);
    return () => { live = false; clearTimeout(timer); };
  }, [title, target, lang]);

  if (!hits.length) return null;
  return (
    <aside className="similar" aria-live="polite">
      <b>{t('dup.title')}</b>
      <span className="hint">{t('dup.text')}</span>
      <ul>{hits.map((h) => <li key={h.id}><a href={`/p/${h.id}`} target="_blank" rel="noopener">{h.title}</a><span className="hint"> · {h.target} · {t('wins.signed', { n: fmtN(h.n, lang) })}</span></li>)}</ul>
    </aside>
  );
}
