'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase/client';
import { applySignal, pickNext, type FeedItem, type Signal, type Weights } from '@/lib/ranking';
import { type Topic } from '@/lib/topics';
import { useT } from '@/lib/i18n/client';
import { fmtN } from '@/lib/i18n/dict';
import { SignButton, type Viewer } from './SignButton';
import { Icon } from './Icon';

type Slot = { item: FeedItem; explore: boolean } | { end: true };
const LS = 'unite-weights';

export function Feed({ items, viewer, signed, followed, serverWeights, chronological, autoplay }: {
  items: FeedItem[]; viewer: Viewer; signed: string[]; followed: string[]; serverWeights: Weights; chronological: boolean; autoplay: boolean;
}) {
  const sb = supabaseBrowser();
  const { lang, t } = useT();
  const fmt = (n: number) => fmtN(n, lang);
  const [weights, setWeights] = useState<Weights>(serverWeights);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [active, setActive] = useState(0);
  const [quiet, setQuiet] = useState<Record<number, boolean>>({});
  const seen = useRef<Record<string, number>>({});
  const started = useRef(Date.now());
  const scroller = useRef<HTMLDivElement>(null);
  const ctx = useMemo(() => ({ followed: new Set(followed), signed: new Set(signed), seen: seen.current }), [followed, signed]);

  // anonymous visitors keep what the feed learned in their own browser
  useEffect(() => { if (!viewer.loggedIn) { try { setWeights(JSON.parse(localStorage.getItem(LS) || '{}')); } catch {} } }, [viewer.loggedIn]);

  function learn(topic: Topic, s: Signal, k = 1) {
    if (chronological) return;
    setWeights((w) => { const n = applySignal(w, topic, s, k); if (!viewer.loggedIn) { try { localStorage.setItem(LS, JSON.stringify(n)); } catch {} } return n; });
    if (viewer.loggedIn) sb.rpc('record_signal', { p_topic: topic, p_delta: ({ complete: 1, watch: 1, replay: 1.4, care: 1.5, share: 2.5, follow: 2.5, sign: 4, skip: -0.6, less: -8 } as const)[s] * k });
  }

  // keep two items queued ahead, chosen live from the latest signals
  useEffect(() => {
    setSlots((cur) => {
      if (cur.length && ('end' in cur[cur.length - 1] || cur.length - active >= 3)) return cur;
      const next = [...cur];
      const taken = new Set(next.flatMap((s) => ('item' in s ? [s.item.id] : [])));
      while (next.length - active < 3) {
        const pick = pickNext(items.filter((i) => !taken.has(i.id)), weights, ctx, chronological);
        if (!pick) { next.push({ end: true }); break; }
        taken.add(pick.item.id); next.push(pick);
      }
      return next;
    });
  }, [active, items, weights, ctx, chronological]);

  // which slide is on screen
  useEffect(() => {
    const root = scroller.current; if (!root) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i)); }), { root, threshold: 0.6 });
    root.querySelectorAll('.slide').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [slots.length]);

  // leaving a slide turns watch time into signals; arriving starts playback and the text fade
  const prev = useRef<number | null>(null);
  useEffect(() => {
    const last = prev.current;
    if (last !== null && last !== active) {
      const s = slots[last];
      if (s && 'item' in s) {
        const dwell = (Date.now() - started.current) / 1000, len = s.item.trim_end - s.item.trim_start;
        seen.current[s.item.id] = (seen.current[s.item.id] ?? 0) + 1;
        if (dwell < 1.5) learn(s.item.topic, 'skip');
        else if (dwell >= len * 0.9) learn(s.item.topic, 'complete');
        else learn(s.item.topic, 'watch', (dwell / len) * 0.6);
      }
    }
    prev.current = active; started.current = Date.now();
    setQuiet((q) => ({ ...q, [active]: false }));
    const t = setTimeout(() => setQuiet((q) => ({ ...q, [active]: true })), 3500);
    scroller.current?.querySelectorAll('video').forEach((v) => {
      const i = Number(v.closest('.slide')?.getAttribute('data-i'));
      if (i === active && autoplay) v.play().catch(() => {}); else v.pause();
    });
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, slots.length]);

  // pause when the app or tab is hidden
  useEffect(() => {
    const f = () => scroller.current?.querySelectorAll('video').forEach((v) => {
      const i = Number(v.closest('.slide')?.getAttribute('data-i'));
      if (document.hidden) v.pause(); else if (i === active && autoplay) v.play().catch(() => {});
    });
    document.addEventListener('visibilitychange', f); return () => document.removeEventListener('visibilitychange', f);
  }, [active, autoplay]);

  if (!items.length) return (
    <div className="empty"><h2>{t('feed.noVideos')}</h2><p>{t('feed.noVideosText')}</p><Link className="btn primary" href="/post">{t('common.postVideo')}</Link></div>
  );

  return (
    <div className="reel">
      <div className="scroller" ref={scroller}>
        {slots.map((s, i) => 'end' in s ? (
          <section className="slide" data-i={i} key="end"><div className="endcard">
            <h2>{t('feed.caughtUp')}</h2><p>{t('feed.caughtUpText')}</p>
            <Link className="btn primary" href="/updates">{t('feed.seeNext')}</Link>
          </div></section>
        ) : (
          <section className={`slide ${quiet[i] ? 'quiet' : ''}`} data-i={i} key={s.item.id}>
            <div className="frame" onClick={(e) => { if (!(e.target as HTMLElement).closest('a,button')) setQuiet((q) => ({ ...q, [i]: !q[i] })); }}>
              {s.item.video_url && (
                <video src={s.item.video_url} poster={s.item.cover_url ?? undefined} muted playsInline preload={i <= active + 1 ? 'auto' : 'metadata'}
                  onLoadedMetadata={(e) => { e.currentTarget.currentTime = s.item.trim_start; }}
                  onTimeUpdate={(e) => { const v = e.currentTarget; if (v.currentTime >= s.item.trim_end - 0.05) { v.currentTime = s.item.trim_start; if (i === active) learn(s.item.topic, 'replay'); } }}
                  onEnded={(e) => { e.currentTarget.currentTime = s.item.trim_start; e.currentTarget.play().catch(() => {}); }} />
              )}
              <div className="shade" />
              <div className="txt">
                {s.item.uploader_handle && <span className="byline">@{s.item.uploader_handle} <span className={`role ${s.item.role}`}>({t(`role.${s.item.role}`)})</span></span>}
                <div className="more"><div>
                  <span className="whytag">{s.explore ? t('feed.newForYou', { topic: t(`topic.${s.item.topic}`) }) : (weights[s.item.topic] ?? 0) > 1 ? t('feed.oftenWatch', { topic: t(`topic.${s.item.topic}`) }) : t('feed.popular')}</span>
                  <h2>{s.item.caption}</h2>
                </div></div>
                <div className="peek">{s.item.caption}</div>
                <Link className="pcard" href={`/p/${s.item.petition_id}`}>
                  <strong>{s.item.petition_title}</strong>
                  <span className="bar"><i style={{ width: `${Math.min(100, (s.item.combined / s.item.goal) * 100)}%` }} /></span>
                  <small><span className="num">{fmt(s.item.combined)} {t('common.of')} {fmt(s.item.goal)}</span><span>{t('feed.thisHour', { n: fmt(s.item.last_hour) })}</span></small>
                </Link>
              </div>
              <div className="col">
                <SignButton variant="reel" petitionId={s.item.petition_id} title={s.item.petition_title} signed={ctx.signed.has(s.item.petition_id)} viewer={viewer}
                  onChange={(on) => on && learn(s.item.topic, 'sign')} />
                <button className="rb" onClick={() => learn(s.item.topic, 'care')}><span className="c"><Icon name="heart" /></span>{t('feed.care')}</button>
                <a className="rb" href={`/api/card/${s.item.petition_id}`} target="_blank" rel="noopener" onClick={() => learn(s.item.topic, 'share')}><span className="c"><Icon name="share" /></span>{t('feed.share')}</a>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
