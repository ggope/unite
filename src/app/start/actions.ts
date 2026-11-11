'use server';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/supabase/server';
import { GOALS, TOPIC_KEYS } from '@/lib/topics';
import { getT } from '@/lib/i18n/server';

export type StartState = { error?: string };

export async function createPetition(_: StartState, form: FormData): Promise<StartState> {
  const { sb, user } = await currentUser();
  if (!user) redirect('/login?next=/start');
  const { t } = await getT();
  const g = (k: string) => String(form.get(k) ?? '').trim();
  const goal = Number(g('goal')); const topic = g('topic');
  if (!GOALS.includes(goal) || !TOPIC_KEYS.includes(topic as any)) return { error: t('start.errTopic') };
  if (form.get('facts') !== 'on') return { error: t('start.errFacts') };
  const src = g('source_url');
  const off = g('official_url');
  if ((src && !src.startsWith('https://')) || (off && !off.startsWith('https://'))) return { error: t('start.errSource') };
  const { data, error } = await sb.from('petitions').insert({
    created_by: user.id, organiser_name: g('organiser_name'), title: g('title'), target: g('target'), region: g('region'),
    ask: g('ask'), why: g('why'), source_url: src || null, topic, goal, ends_on: g('ends_on') || null,
    ...(off ? { official_url: off } : {}),
  }).select('id').single();
  if (error) return { error: error.message.includes('check') ? t('start.errLength') : t('start.errSave') };
  // the database counts the founder as the first signature
  redirect(form.get('then') === 'video' ? `/post?petition=${data.id}` : `/p/${data.id}`);
}
