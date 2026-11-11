'use client';
import { useActionState } from 'react';
import { createPetition, type StartState } from './actions';
import { TOPIC_KEYS, GOALS } from '@/lib/topics';
import { useT } from '@/lib/i18n/client';
import { fmtN } from '@/lib/i18n/dict';

export function StartForm({ then, source, topic }: { then: 'video' | 'page'; source?: string; topic?: string }) {
  const { lang, t } = useT();
  const [state, action, pending] = useActionState<StartState, FormData>(createPetition, {});
  return (
    <form action={action} className="panel" style={{ gap: 16 }}>
      <input type="hidden" name="then" value={then} />
      <div className="field"><label htmlFor="title">{t('start.tTitle')}</label><input id="title" name="title" required minLength={10} maxLength={90} placeholder={t('start.tTitlePh')} /><span className="hint">{t('start.tTitleHint')}</span></div>
      <div className="field"><label htmlFor="target">{t('start.target')}</label><input id="target" name="target" required placeholder={t('start.targetPh')} /></div>
      <div className="field"><label htmlFor="region">{t('start.region')}</label><input id="region" name="region" required list="regions" placeholder={t('start.regionPh')} />
        <datalist id="regions"><option value={t('start.rWorld')} /><option value={t('start.rEu')} /><option value={t('start.rHu')} /><option value="Budapest" /></datalist></div>
      <div className="field"><label htmlFor="ask">{t('start.ask')}</label><textarea id="ask" name="ask" required minLength={20} placeholder={t('start.askPh')} /></div>
      <div className="field"><label htmlFor="why">{t('start.why')}</label><textarea id="why" name="why" required minLength={20} placeholder={t('start.whyPh')} /></div>
      <div className="field"><label htmlFor="source_url">{t('start.source')}</label><input id="source_url" name="source_url" type="url" defaultValue={source} placeholder="https://" /></div>
      <div className="field"><label htmlFor="official_url">{t('start.official')}</label><input id="official_url" name="official_url" type="url" placeholder="https://" /><span className="hint">{t('start.officialHint')}</span></div>
      <div className="field"><label htmlFor="topic">{t('start.topic')}</label><select id="topic" name="topic" defaultValue={topic && (TOPIC_KEYS as string[]).includes(topic) ? topic : undefined}>{TOPIC_KEYS.map((k) => <option key={k} value={k}>{t(`topic.${k}`)}</option>)}</select></div>
      <div className="field"><label htmlFor="goal">{t('start.goal')}</label><select id="goal" name="goal" defaultValue="10000">{GOALS.map((g) => <option key={g} value={g}>{fmtN(g, lang)}</option>)}</select></div>
      <div className="field"><label htmlFor="organiser_name">{t('start.organiser')}</label><input id="organiser_name" name="organiser_name" required placeholder={t('start.organiserPh')} /></div>
      <div className="field"><label htmlFor="ends_on">{t('start.ends')}</label><input id="ends_on" name="ends_on" type="date" /></div>
      <label className="check"><input type="checkbox" name="facts" required /><span>{t('start.facts')}</span></label>
      {state.error && <p className="error">{state.error}</p>}
      <button className="btn primary big" disabled={pending}>{pending ? t('common.saving') : then === 'video' ? t('start.createVideo') : t('start.submit')}</button>
    </form>
  );
}
