'use server';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/supabase/server';
import { GOALS, TOPIC_KEYS } from '@/lib/topics';

export type StartState = { error?: string };

export async function createPetition(_: StartState, form: FormData): Promise<StartState> {
  const { sb, user } = await currentUser();
  if (!user) redirect('/login?next=/start');
  const g = (k: string) => String(form.get(k) ?? '').trim();
  const goal = Number(g('goal')); const topic = g('topic');
  if (!GOALS.includes(goal) || !TOPIC_KEYS.includes(topic as any)) return { error: 'Choose a topic and a goal.' };
  if (form.get('facts') !== 'on') return { error: 'Confirm the facts are true to the best of your knowledge.' };
  const src = g('source_url');
  if (src && !src.startsWith('https://')) return { error: 'The source link must start with https://' };
  const { data, error } = await sb.from('petitions').insert({
    created_by: user.id, organiser_name: g('organiser_name'), title: g('title'), target: g('target'), region: g('region'),
    ask: g('ask'), why: g('why'), source_url: src || null, topic, goal, ends_on: g('ends_on') || null,
  }).select('id').single();
  if (error) return { error: error.message.includes('check') ? 'Some fields are too short or too long. Check the title (10 to 90 characters), the ask and the reason (at least 20 characters).' : 'Could not save the petition. Try again.' };
  // the database counts the founder as the first signature
  redirect(form.get('then') === 'video' ? `/post?petition=${data.id}` : `/p/${data.id}`);
}
