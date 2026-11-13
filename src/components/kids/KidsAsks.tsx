'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n/client';
import { fmtN, type Key } from '@/lib/i18n/langs';
import { TOPICS, type Topic } from '@/lib/topics';

export type KidAsk = { id: string; topic: Topic; goal: number; combined: number; title: string; text: string };
const STORE = 'kids-care';

// Kid-friendly petitions in plain words, filtered by what the child cares about.
// The choice stays in this browser only; nothing is sent anywhere.
export function KidsAsks({ asks }: { asks: KidAsk[] }) {
  const { lang, t } = useT();
  const [care, setCare] = useState<Topic[]>([]);
  useEffect(() => { try { const v = JSON.parse(localStorage.getItem(STORE) ?? '[]'); if (Array.isArray(v)) setCare(v.filter((x) => x in TOPICS)); } catch {} }, []);
  const toggle = (x: Topic) => {
    const next = care.includes(x) ? care.filter((c) => c !== x) : [...care, x];
    setCare(next); try { localStorage.setItem(STORE, JSON.stringify(next)); } catch {}
  };
  const topics = (Object.keys(TOPICS) as Topic[]).filter((x) => asks.some((a) => a.topic === x));
  const shown = care.length ? asks.filter((a) => care.includes(a.topic)) : asks;
  return (
    <section className="stack" style={{ gap: 12 }}>
      <h2 style={{ margin: 0 }}>{t('kids.asks')}</h2>
      <p className="hint" style={{ margin: 0 }}>{t('kids.asksText')}</p>
      {topics.length > 1 && (
        <div className="stack" style={{ gap: 6 }}>
          <b>{t('kids.care')}</b>
          <div className="row" role="group" aria-label={t('kids.care')}>
            {topics.map((x) => <button key={x} type="button" className="chip" aria-pressed={care.includes(x)} onClick={() => toggle(x)}>{t(`topic.${x}` as Key)}</button>)}
          </div>
          <span className="hint">{t('kids.careText')}</span>
        </div>
      )}
      {!shown.length && <p className="muted">{t('kids.none')}</p>}
      {shown.map((a) => (
        <article key={a.id} className="kids-ask">
          <span className="hint"><i className="tdot" style={{ background: TOPICS[a.topic]?.b }} />{t(`topic.${a.topic}` as Key)}</span>
          <h3>{a.title}</h3>
          <p>{a.text}</p>
          <div className="big" role="progressbar" aria-valuemin={0} aria-valuemax={a.goal} aria-valuenow={a.combined} aria-label={a.title}><i style={{ width: `${Math.min(100, (a.combined / a.goal) * 100)}%` }} /></div>
          <span className="hint">{t('kids.people', { n: fmtN(a.combined, lang) })}</span>
          <p className="kids-grownup">{t('kids.grownup')}</p>
          <Link className="btn small" href={`/p/${a.id}`} style={{ alignSelf: 'flex-start' }}>{t('kids.show')}</Link>
        </article>
      ))}
    </section>
  );
}
