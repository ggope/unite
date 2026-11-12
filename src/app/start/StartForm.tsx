'use client';
import { useActionState, useState } from 'react';
import { createPetition, type StartState } from './actions';
import { TOPIC_KEYS, GOALS } from '@/lib/topics';
import { useT } from '@/lib/i18n/client';
import { fmtN } from '@/lib/i18n/langs';
import { CTAS } from '@/components/LinkBar';
import { Similar } from './Similar';
import { addDays, unierToday } from '@/lib/lifecycle';

type Draft = { title: string; target: string; ask: string; why: string; source: string; ends: string };
// Words that name nobody who can actually decide.
const VAGUE = /^(the )?(world|everyone|everybody|people|public|government|governments|politicians|authorities|leaders|them|all|mindenki|a kormány|kormány|politikusok|alle|die regierung|regierung|todos|el gobierno|gobierno|tout le monde|le gouvernement|gouvernement)$/i;

// Live tips while writing. They never block posting.
function Checklist({ d }: { d: Draft }) {
  const { t } = useT();
  const checks = [
    { ok: d.title.trim().length >= 25 && d.title.trim().length <= 90, k: 'chk.c1', h: 'chk.c1h' },
    { ok: d.target.trim().length >= 4 && !VAGUE.test(d.target.trim()), k: 'chk.c2', h: 'chk.c2h' },
    { ok: /\d/.test(d.ask) || !!d.ends, k: 'chk.c3', h: 'chk.c3h' },
    { ok: d.why.trim().length >= 150 || /^https:\/\//.test(d.source.trim()), k: 'chk.c4', h: 'chk.c4h' },
    { ok: d.ask.trim().length >= 20 && d.ask.trim().length <= 600, k: 'chk.c5', h: 'chk.c5h' },
  ] as const;
  const n = checks.filter((c) => c.ok).length;
  return (
    <aside className="checklist" aria-label={t('chk.title')}>
      <div className="row between"><b>{t('chk.title')}</b><span className="hint" aria-live="polite">{t('chk.score', { n, total: checks.length })}</span></div>
      <ul>{checks.map((c) => <li key={c.k} className={c.ok ? 'ok' : ''}><span aria-hidden="true">{c.ok ? '✓' : '○'}</span><span><b>{t(c.k)}</b>{!c.ok && <span className="hint">{t(c.h)}</span>}</span></li>)}</ul>
      <span className="hint">{t('chk.note')}</span>
    </aside>
  );
}

export function StartForm({ then, source, topic }: { then: 'video' | 'page'; source?: string; topic?: string }) {
  const { lang, t } = useT();
  const [state, action, pending] = useActionState<StartState, FormData>(createPetition, {});
  const [d, setD] = useState<Draft>({ title: '', target: '', ask: '', why: '', source: source ?? '', ends: '' });
  const read = (f: HTMLFormElement) => {
    const v = (n: string) => String((f.elements.namedItem(n) as HTMLInputElement | null)?.value ?? '');
    setD({ title: v('title'), target: v('target'), ask: v('ask'), why: v('why'), source: v('source_url'), ends: v('ends_on') });
  };
  return (
    <form action={action} className="panel" style={{ gap: 16 }} onInput={(e) => read(e.currentTarget)} onChange={(e) => read(e.currentTarget)}>
      <input type="hidden" name="then" value={then} />
      <div className="field"><label htmlFor="title">{t('start.tTitle')}</label><input id="title" name="title" required minLength={10} maxLength={90} placeholder={t('start.tTitlePh')} /><span className="hint">{t('start.tTitleHint')}</span></div>
      <div className="field"><label htmlFor="target">{t('start.target')}</label><input id="target" name="target" required placeholder={t('start.targetPh')} /></div>
      <Similar title={d.title} target={d.target} />
      <div className="field"><label htmlFor="region">{t('start.region')}</label><input id="region" name="region" required list="regions" placeholder={t('start.regionPh')} />
        <datalist id="regions"><option value={t('start.rWorld')} /><option value={t('start.rEu')} /><option value={t('start.rHu')} /><option value="Budapest" /></datalist></div>
      <div className="field"><label htmlFor="ask">{t('start.ask')}</label><textarea id="ask" name="ask" required minLength={20} placeholder={t('start.askPh')} /></div>
      <div className="field"><label htmlFor="why">{t('start.why')}</label><textarea id="why" name="why" required minLength={20} placeholder={t('start.whyPh')} /></div>
      <div className="field"><label htmlFor="source_url">{t('start.source')}</label><input id="source_url" name="source_url" type="url" defaultValue={source} placeholder="https://" /></div>
      <div className="field"><label htmlFor="link_url">{t('start.link')}</label><input id="link_url" name="link_url" type="url" placeholder="https://" /><span className="hint">{t('start.linkHint')}</span></div>
      <div className="field"><label htmlFor="link_cta">{t('start.linkCta')}</label><select id="link_cta" name="link_cta" defaultValue="learn">{CTAS.map((c) => <option key={c} value={c}>{t(`link.${c}`)}</option>)}</select></div>
      <div className="field"><label htmlFor="official_url">{t('start.official')}</label><input id="official_url" name="official_url" type="url" placeholder="https://" /><span className="hint">{t('start.officialHint')}</span></div>
      <div className="field"><label htmlFor="topic">{t('start.topic')}</label><select id="topic" name="topic" defaultValue={topic && (TOPIC_KEYS as string[]).includes(topic) ? topic : undefined}>{TOPIC_KEYS.map((k) => <option key={k} value={k}>{t(`topic.${k}`)}</option>)}</select></div>
      <div className="field"><label htmlFor="goal">{t('start.goal')}</label><select id="goal" name="goal" defaultValue="10000">{GOALS.map((g) => <option key={g} value={g}>{fmtN(g, lang)}</option>)}</select></div>
      <div className="field"><label htmlFor="organiser_name">{t('start.organiser')}</label><input id="organiser_name" name="organiser_name" required placeholder={t('start.organiserPh')} /></div>
      <div className="field"><label htmlFor="ends_on">{t('start.ends')}</label><input id="ends_on" name="ends_on" type="date" min={addDays(unierToday(), 1)} max={addDays(unierToday(), 366)} aria-describedby="ends_hint" /><span className="hint" id="ends_hint">{t('start.endsHint')}</span></div>
      <Checklist d={d} />
      <label className="check"><input type="checkbox" name="facts" required /><span>{t('start.facts')}</span></label>
      {state.error && <p className="error">{state.error}</p>}
      <button className="btn primary big" disabled={pending}>{pending ? t('common.saving') : then === 'video' ? t('start.createVideo') : t('start.submit')}</button>
    </form>
  );
}
