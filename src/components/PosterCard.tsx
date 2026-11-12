'use client';
import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n/client';
import { fmtN, type Key } from '@/lib/i18n/dict';
import { TOPICS, type Topic } from '@/lib/topics';
import { MyloArt } from './mylo/MyloArt';
import type { Mood } from './mylo/art';

// The feed slide for a petition that has no video yet: a moving protest poster.
// Real videos take its place as soon as one is approved.
// Deep backgrounds that all carry white text; neighbouring posters never share one.
const TONES = ['#0E3B5C', '#5B1A3A', '#1F4D2E', '#6B2D12', '#2E2A6B', '#0F4C4C', '#4A1F5C', '#7A1F1F', '#203040', '#4D3B0A'];

export function PosterCard({ id, topic, title, target, ask, combined, goal, lastHour, active, tone = 0 }: {
  tone?: number; id: string; topic: Topic; title: string; target: string; ask: string; combined: number; goal: number; lastHour: number; active: boolean;
}) {
  const { lang, t } = useT();
  const c = TOPICS[topic];
  const [n, setN] = useState(combined);
  // the count runs up each time the poster comes on screen
  useEffect(() => {
    if (!active || combined < 1) { setN(combined); return; }
    let raf = 0; const t0 = performance.now(), ms = 1200;
    const step = (now: number) => { const k = Math.min(1, (now - t0) / ms); setN(Math.round(combined * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [active, combined]);
  const share = combined / goal;
  const mood: Mood = lastHour > 0 ? 'fired' : share >= 0.5 ? 'growing' : combined > 0 ? 'happy' : 'worried';
  return (
    <div className={`poster ${active ? 'on' : ''}`} style={{ ['--pa' as string]: TONES[tone % TONES.length], ['--pb' as string]: c.b }}>
      <div className="poster-stripes" aria-hidden="true" />
      <div className="poster-body">
        <span className="poster-topic">{t(`topic.${topic}` as Key)}</span>
        <h2 className="poster-title">{title}</h2>
        <span className="poster-to">{t('poster.to', { target })}</span>
        <div className="poster-row">
          <div className="poster-mylo"><MyloArt mood={mood} size={76} id={`poster-${id}`} label="" /></div>
          <div className="poster-count"><b className="num">{fmtN(n, lang)}</b><span>{t('poster.signed', { goal: fmtN(goal, lang) })}</span></div>
        </div>
        <p className="poster-ask">{ask}</p>
      </div>
      <span className="poster-novideo">{t('poster.noVideo')}</span>
    </div>
  );
}
