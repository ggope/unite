'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase/client';
import { applySignal, pickNext, type FeedItem, type Signal, type Weights } from '@/lib/ranking';
import { type Topic } from '@/lib/topics';
import { useT } from '@/lib/i18n/client';
import { fmtN } from '@/lib/i18n/langs';
import { SignButton, type Viewer } from './SignButton';
import { Icon } from './Icon';
import { NewsCard } from './NewsCard';
import { ReportButton } from './ReportButton';
import { MyloArt } from './mylo/MyloArt';
import { LinkBar } from './LinkBar';
import { ShareButton } from './ShareButton';
import { PosterCard } from './PosterCard';
import type { NewsStory } from '@/lib/news/load';
import { TOPICS } from '@/lib/topics';

type Slot = { item: FeedItem; explore: boolean } | { news: NewsStory } | { ad: true } | { end: true };
const NEWS_EVERY = 3;   // one headline after every three videos
const AD_FIRST = 7, AD_EVERY = 15;   // the empty ad slot: after 7 videos, then every 15
// The slot asks for support, so it only shows once there is a donation link to send people to.
const CAN_DONATE = !!(process.env.NEXT_PUBLIC_DONATE_URL || process.env.NEXT_PUBLIC_DONATE_MONTHLY_URL);
const LS = 'unite-weights';

export function Feed({ items, news = [], viewer, signed, followed, serverWeights, chronological, autoplay, breakMinutes = 20, firstId }: {
  firstId?: string; items: FeedItem[]; news?: NewsStory[]; viewer: Viewer; signed: string[]; followed: string[]; serverWeights: Weights; chronological: boolean; autoplay: boolean; breakMinutes?: number;
}) {
  const sb = supabaseBrowser();
  const { lang, t } = useT();
  const fmt = (n: number) => fmtN(n, lang);
  const [weights, setWeights] = useState<Weights>(serverWeights);
  // The opener is chosen on the server, so its video is in the first HTML and starts before the app has even loaded.
  const [slots, setSlots] = useState<Slot[]>(() => { const f = items.find((i) => i.id === firstId); return f ? [{ item: f, explore: false }] : []; });
  const [active, setActive] = useState(0);
  const [quiet, setQuiet] = useState<Record<number, boolean>>({});
  const seen = useRef<Record<string, number>>({});
  const started = useRef(Date.now());
  const scroller = useRef<HTMLDivElement>(null);
  const [pauseFor, setPauseFor] = useState<number | null>(null);   // break reminder showing (minutes watched)
  const [toast, setToast] = useState('');
  const watched = useRef(0);

  // Break reminder: counts only time the feed is actually on screen.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.hidden || pauseFor !== null) return;
      watched.current += 15;
      if (watched.current >= breakMinutes * 60) {
        setPauseFor(Math.round(watched.current / 60));
        scroller.current?.querySelectorAll('video').forEach((v) => v.pause());
      }
    }, 15000);
    return () => clearInterval(id);
  }, [breakMinutes, pauseFor]);

  function notInterested(i: number, topic: Topic) {
    learn(topic, 'less');
    setToast(t('feed.lessDone', { topic: t(`topic.${topic}`) })); setTimeout(() => setToast(''), 2500);
    const next = scroller.current?.querySelector(`.slide[data-i="${i + 1}"]`) as HTMLElement | null;
    next?.scrollIntoView({ behavior: 'smooth' });
  }
  const ctx = useMemo(() => ({ followed: new Set(followed), signed: new Set(signed), seen: seen.current }), [followed, signed]);

  // anonymous visitors keep what the feed learned in their own browser
  useEffect(() => { if (!viewer.loggedIn) { try { setWeights(JSON.parse(localStorage.getItem(LS) || '{}')); } catch {} } }, [viewer.loggedIn]);

  function learn(topic: Topic, s: Signal, k = 1) {
    if (chronological) return;
    setWeights((w) => { const n = applySignal(w, topic, s, k); if (!viewer.loggedIn) { try { localStorage.setItem(LS, JSON.stringify(n)); } catch {} } return n; });
    if (viewer.loggedIn) sb.rpc('record_signal', { p_topic: topic, p_delta: ({ complete: 1, watch: 1, replay: 1.4, care: 1.5, share: 2.5, follow: 2.5, sign: 4, skip: -0.6, less: -8 } as const)[s] * k }).then(() => {}, () => {}); // a query only runs once awaited
  }

  // keep two items queued ahead, chosen live from the latest signals
  useEffect(() => {
    setSlots((cur) => {
      if (cur.length && ('end' in cur[cur.length - 1] || cur.length - active >= 3)) return cur;
      const next = [...cur];
      const taken = new Set(next.flatMap((s) => ('item' in s ? [s.item.id] : [])));
      const usedNews = new Set(next.flatMap((s) => ('news' in s ? [s.news.id] : [])));
      while (next.length - active < 3) {
        let since = 0; for (let k = next.length - 1; k >= 0 && 'item' in next[k]; k--) since++;
        const vids = next.filter((s) => 'item' in s).length, ads = next.filter((s) => 'ad' in s).length;
        if (CAN_DONATE && since > 0 && vids >= AD_FIRST + ads * AD_EVERY) { next.push({ ad: true }); continue; }
        if (since >= NEWS_EVERY) {
          // the headline closest to what this person cares about, among the biggest stories
          const n = news.filter((x) => !usedNews.has(x.id)).sort((a, b) => (weights[b.topic] ?? 0) + b.outlets - ((weights[a.topic] ?? 0) + a.outlets))[0];
          if (n) { usedNews.add(n.id); next.push({ news: n }); continue; }
        }
        const pick = pickNext(items.filter((i) => !taken.has(i.id)), weights, ctx, chronological);
        if (!pick) { next.push({ end: true }); break; }
        taken.add(pick.item.id); next.push(pick);
      }
      return next;
    });
  }, [active, items, news, weights, ctx, chronological]);

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
      {pauseFor !== null && (
        <div className="breakcard" role="dialog" aria-modal="true" aria-label={t('break.title')}>
          <MyloArt mood="sleepy" size={150} id="break" label={t('mylo.label', { mood: t('mylo.mood.sleepy') })} />
          <h2>{t('break.title')}</h2><p className="say">{t('mylo.say.sleepy')}</p><p>{t('break.text', { n: pauseFor })}</p>
          <div className="row"><button className="btn primary" onClick={() => { watched.current = 0; setPauseFor(null); scroller.current?.querySelectorAll('video').forEach((v) => { const i = Number(v.closest('.slide')?.getAttribute('data-i')); if (i === active && autoplay) v.play().catch(() => {}); }); }}>{t('break.keep')}</button>
            <Link className="btn" href="/updates">{t('break.stop')}</Link></div>
        </div>
      )}
      {toast && <div className="reeltoast" role="status">{toast}</div>}
      <div className="scroller" ref={scroller}>
        {slots.map((s, i) => 'news' in s ? (
          <section className="slide" data-i={i} key={'n' + s.news.id}>
            <div className="frame paper">
              <span className="band" style={{ background: TOPICS[s.news.topic].b }} />
              <span className="newskind">{t('news.title')}</span>
              <div className="newsslide"><NewsCard n={s.news} viewer={viewer} signed={!!s.news.petition && ctx.signed.has(s.news.petition.id)} /></div>
            </div>
          </section>
        ) : 'ad' in s ? (
          <section className="slide" data-i={i} key={'ad' + i}>
            <div className="frame paper adslot">
              <span className="newskind">{t('ad.label')}</span>
              <div className="adbox">
                <h2>{t('ad.title')}</h2>
                <p>{t('ad.text')}</p>
                <div className="row">
                  <Link className="btn primary big" href="/donate">{t('ad.support')}</Link>
                  <button className="btn" onClick={() => scroller.current?.scrollBy({ top: scroller.current.clientHeight, behavior: 'smooth' })}>{t('ad.skip')}</button>
                </div>
              </div>
            </div>
          </section>
        ) : 'end' in s ? (
          <section className="slide" data-i={i} key="end"><div className="endcard">
            <h2>{t('feed.caughtUp')}</h2><p>{t('feed.caughtUpText')}</p>
            <Link className="btn primary" href="/updates">{t('feed.seeNext')}</Link>
          </div></section>
        ) : (
          <section className={`slide ${quiet[i] ? 'quiet' : ''}`} data-i={i} key={s.item.id}>
            <div className="frame" onClick={(e) => { if (!(e.target as HTMLElement).closest('a,button')) setQuiet((q) => ({ ...q, [i]: !q[i] })); }}>
              {s.item.kind === 'card' && (
                <PosterCard id={s.item.petition_id} topic={s.item.topic} title={s.item.petition_title} target={s.item.target ?? ''} ask={s.item.caption}
                  combined={s.item.combined} goal={s.item.goal} lastHour={s.item.last_hour} active={i === active} tone={i} />
              )}
              {s.item.video_url && (
                <video src={s.item.video_url} poster={s.item.cover_url ?? undefined} muted playsInline autoPlay={autoplay && i === 0} preload={i <= active + 1 ? 'auto' : 'metadata'}
                  onLoadedMetadata={(e) => { e.currentTarget.currentTime = s.item.trim_start; }}
                  onTimeUpdate={(e) => { const v = e.currentTarget; if (v.currentTime >= s.item.trim_end - 0.05) { v.currentTime = s.item.trim_start; if (i === active) learn(s.item.topic, 'replay'); } }}
                  onEnded={(e) => { e.currentTarget.currentTime = s.item.trim_start; e.currentTarget.play().catch(() => {}); }} />
              )}
              <div className="shade" />
              <div className="txt">
                {s.item.uploader_handle && <span className="byline"><a href={`/u/${s.item.uploader_handle}`} style={{ color: 'inherit' }}>@{s.item.uploader_handle}</a> <span className={`role ${s.item.role}`}>({t(`role.${s.item.role}`)})</span></span>}
                {s.item.kind !== 'card' && <><div className="more"><div>
                  <span className="whytag">{s.explore ? t('feed.newForYou', { topic: t(`topic.${s.item.topic}`) }) : (weights[s.item.topic] ?? 0) > 1 ? t('feed.oftenWatch', { topic: t(`topic.${s.item.topic}`) }) : t('feed.popular')}</span>
                  <h2>{s.item.caption}</h2>
                </div></div>
                <div className="peek">{s.item.caption}</div></>}
                <Link className="pcard" href={`/p/${s.item.petition_id}`}>
                  <strong>{s.item.petition_title}</strong>
                  <span className="bar"><i style={{ width: `${Math.min(100, (s.item.combined / s.item.goal) * 100)}%` }} /></span>
                  <small><span className="num">{fmt(s.item.combined)} {t('common.of')} {fmt(s.item.goal)}</span><span>{t('feed.thisHour', { n: fmt(s.item.last_hour) })}</span></small>
                </Link>
                {s.item.link_url && <LinkBar url={s.item.link_url} cta={s.item.link_cta ?? 'learn'} />}
              </div>
              <div className="col">
                <SignButton variant="reel" petitionId={s.item.petition_id} title={s.item.petition_title} signed={ctx.signed.has(s.item.petition_id)} viewer={viewer}
                  onChange={(on) => on && learn(s.item.topic, 'sign')} />
                <button className="rb" onClick={() => learn(s.item.topic, 'care')}><span className="c"><Icon name="heart" /></span>{t('feed.care')}</button>
                <button className="rb" onClick={() => notInterested(i, s.item.topic)}><span className="c"><Icon name="eyeoff" /></span>{t('feed.less')}</button>
                <ReportButton variant="reel" {...(s.item.kind === 'card' ? { petitionId: s.item.petition_id } : { videoId: s.item.id })} loggedIn={viewer.loggedIn} />
                <ShareButton variant="reel" path={`/p/${s.item.petition_id}`} title={s.item.petition_title} onShare={() => learn(s.item.topic, 'share')} />
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
