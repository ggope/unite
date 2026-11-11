'use client';
import { useActionState } from 'react';
import { createPetition, type StartState } from './actions';
import { TOPICS, TOPIC_KEYS, GOALS, fmt } from '@/lib/topics';

export function StartForm({ then }: { then: 'video' | 'page' }) {
  const [state, action, pending] = useActionState<StartState, FormData>(createPetition, {});
  return (
    <form action={action} className="panel" style={{ gap: 16 }}>
      <input type="hidden" name="then" value={then} />
      <div className="field"><label htmlFor="title">Title: what should change?</label><input id="title" name="title" required minLength={10} maxLength={90} placeholder="For example: End bottom trawling in marine protected areas" /><span className="hint">Start with a verb. One clear demand.</span></div>
      <div className="field"><label htmlFor="target">Who can make it happen?</label><input id="target" name="target" required placeholder="A named person or body, for example: Ministry of Agriculture" /></div>
      <div className="field"><label htmlFor="region">Where does it apply?</label><input id="region" name="region" required list="regions" placeholder="Worldwide, a country, region or city" />
        <datalist id="regions"><option value="Worldwide" /><option value="European Union" /><option value="Hungary" /><option value="Budapest" /></datalist></div>
      <div className="field"><label htmlFor="ask">What exactly are you asking for?</label><textarea id="ask" name="ask" required minLength={20} placeholder="The specific action, by when." /></div>
      <div className="field"><label htmlFor="why">Why does it matter?</label><textarea id="why" name="why" required minLength={20} placeholder="What is happening, who is affected, and why now." /></div>
      <div className="field"><label htmlFor="source_url">Source or evidence (optional)</label><input id="source_url" name="source_url" type="url" placeholder="https://" /></div>
      <div className="field"><label htmlFor="topic">Topic</label><select id="topic" name="topic">{TOPIC_KEYS.map((k) => <option key={k} value={k}>{TOPICS[k].label}</option>)}</select></div>
      <div className="field"><label htmlFor="goal">Signature goal</label><select id="goal" name="goal" defaultValue="10000">{GOALS.map((g) => <option key={g} value={g}>{fmt(g)}</option>)}</select></div>
      <div className="field"><label htmlFor="organiser_name">Organiser name</label><input id="organiser_name" name="organiser_name" required placeholder="You or your group" /></div>
      <div className="field"><label htmlFor="ends_on">End date (optional)</label><input id="ends_on" name="ends_on" type="date" /></div>
      <label className="check"><input type="checkbox" name="facts" required /><span>The facts in this petition are true to the best of my knowledge. It is reviewed before it appears in feeds.</span></label>
      {state.error && <p className="error">{state.error}</p>}
      <button className="btn primary big" disabled={pending}>{pending ? 'Saving…' : then === 'video' ? 'Create petition and add video' : 'Submit for review'}</button>
    </form>
  );
}
