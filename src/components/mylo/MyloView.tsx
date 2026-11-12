import Link from 'next/link';
import { getT } from '@/lib/i18n/server';
import { fmtN, type Key } from '@/lib/i18n/dict';
import type { MyloToday } from '@/lib/mylo';
import { TOPICS } from '@/lib/topics';
import { MyloArt } from './MyloArt';
import { MYLO_COLOR } from './art';
import { SignButton, type Viewer } from '../SignButton';
import { ShareButton } from '../ShareButton';
import { MyloStory, STORY } from './MyloStory';

// Mylo's own page: how he is today, the real numbers behind it, and the big goals we push together.
export async function MyloView({ m, viewer, signed }: { m: MyloToday; viewer: Viewer; signed: Set<string> }) {
  const { lang, t } = await getT();
  const fmt = (n: number) => fmtN(n, lang);
  const moodName = t(`mylo.mood.${m.mood}` as Key);
  const ratio = (m.signed_24h + 10) / (m.usual + 10);
  const trend = ratio >= 1.15 ? 'up' : ratio <= 0.85 ? 'down' : '';

  return (
    <div className="stack">
      <section className="mylohero">
        <span className="moodtag"><i style={{ background: MYLO_COLOR[m.mood] }} />{moodName}</span>
        <MyloArt mood={m.mood} size={200} id="hero" label={t('mylo.label', { mood: moodName })} />
        <h1>{t('mylo.title')}</h1>
        <p className="say">{t(`mylo.say.${m.mood}` as Key)}</p>
        <div className="future">
          <div className="row"><b>{t('mylo.future')}</b><b className="num">{m.future}%</b></div>
          <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={m.future} aria-label={t('mylo.future')}><i style={{ width: `${m.future}%` }} /></div>
          <span className="hint" style={{ color: '#4A453E' }}>{t('mylo.futureHint')}</span>
        </div>
      </section>

      <section className="panel story-panel" aria-labelledby="story-h">
        <h2 id="story-h" style={{ margin: 0 }}>{t('story.title')}</h2>
        <p className="hint" style={{ margin: 0 }}>{t('story.sub')}</p>
        <MyloStory pages={STORY} id="mp" again />
        <div className="row"><Link className="btn small" href="/mylo/story">{t('story.read')}</Link><ShareButton path="/mylo/story" title={t('story.title')} /></div>
      </section>

      <section className="stack" style={{ gap: 10 }}>
        <h2>{t('mylo.why')}</h2>
        <div className="why">
          <div className={`ind ${trend}`}>
            <span className="bignum">{fmt(m.signed_24h)}</span>
            <span className="lbl">{t('mylo.ind.signed')}</span>
            <span className="trend">{trend === 'up' ? t('mylo.more') : trend === 'down' ? t('mylo.fewer') : t('mylo.same')}</span>
            <span className="hint">{t('mylo.ind.usual', { n: fmt(m.usual) })}</span>
          </div>
          <div className={`ind ${m.stories >= 4 && m.grim / m.stories >= 0.35 ? 'down' : ''}`}>
            <span className="bignum">{fmt(m.grim)}</span>
            <span className="lbl">{t('mylo.ind.news', { n: fmt(m.stories) })}</span>
            <span className="prog" aria-hidden="true"><i style={{ width: `${m.stories ? Math.round((m.grim / m.stories) * 100) : 0}%`, background: '#B3261E' }} /></span>
          </div>
          <div className={`ind ${m.wins_7d > 0 ? 'up' : ''}`}>
            <span className="bignum">{fmt(m.wins_7d)}</span>
            <span className="lbl">{t('mylo.ind.wins')}</span>
          </div>
          <div className={`ind ${m.near_goal > 0 ? 'up' : ''}`}>
            <span className="bignum">{fmt(m.near_goal)}</span>
            <span className="lbl">{t('mylo.ind.near')}</span>
          </div>
        </div>
        <span className="hint">{t('mylo.updated')}</span>
      </section>

      {m.wins.length > 0 && (
        <section className="panel">
          <h2>{t('mylo.cheer')}</h2>
          {m.wins.map((w) => <Link key={w.id} href={`/p/${w.id}`}><b>{w.title}</b></Link>)}
        </section>
      )}

      {m.grim_headlines.length > 0 && (
        <section className="panel">
          <h2>{t('mylo.worry')}</h2>
          {m.grim_headlines.map((h) => (
            <a key={h.url} href={h.url} target="_blank" rel="noopener noreferrer"><b>{h.title}</b> <span className="hint">· {h.source_name} ↗</span></a>
          ))}
        </section>
      )}

      <section className="stack" style={{ gap: 10 }}>
        <h2>{t('mylo.goals')}</h2>
        <p className="hint" style={{ margin: 0 }}>{t('mylo.goalsText')}</p>
        {m.goals.length === 0 && <p className="muted">{t('mylo.noGoals')}</p>}
        {m.goals.map((g) => {
          const pct = Math.min(100, (g.combined / g.goal) * 100);
          return (
            <div className={`goal ${g.featured ? 'pinned' : ''}`} key={g.id}>
              <span className="hint"><i className="tdot" style={{ background: TOPICS[g.topic]?.b }} />{t(`topic.${g.topic}` as Key)} · {t('pet.to', { target: g.target })}{g.featured && <> · <b style={{ color: 'var(--accent-text)' }}>★ {t('mylo.pinned')}</b></>}</span>
              <h3><Link href={`/p/${g.id}`}>{g.title}</Link></h3>
              <div className="big" role="progressbar" aria-valuemin={0} aria-valuemax={g.goal} aria-valuenow={g.combined} aria-label={g.title}><i style={{ width: `${pct}%` }} /></div>
              <div className="row between">
                <span><b className="num">{fmt(g.combined)}</b> <span className="hint">{t('common.of')} {fmt(g.goal)} · {t('mylo.toGo', { n: fmt(Math.max(0, g.goal - g.combined)) })}</span></span>
                <SignButton variant="small" petitionId={g.id} title={g.title} signed={signed.has(g.id)} viewer={viewer} />
              </div>
            </div>
          );
        })}
      </section>

      <section className="panel">
        <h2>{t('mylo.about')}</h2>
        <p className="muted" style={{ margin: 0 }}>{t('mylo.aboutText')}</p>
      </section>
    </div>
  );
}
