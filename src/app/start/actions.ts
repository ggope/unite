'use server';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/supabase/server';
import { GOALS, TOPIC_KEYS } from '@/lib/topics';
import { getT } from '@/lib/i18n/server';
import { nudgeAi } from '@/lib/ai/actions';

export type StartState = { error?: string };

export async function createPetition(_: StartState, form: FormData): Promise<StartState> {
  const { sb, user } = await currentUser();
  if (!user) redirect('/login?next=/start');
  const { lang, t } = await getT();
  const g = (k: string) => String(form.get(k) ?? '').trim();
  const goal = Number(g('goal')); const topic = g('topic');
  if (!GOALS.includes(goal) || !TOPIC_KEYS.includes(topic as any)) return { error: t('start.errTopic') };
  if (form.get('facts') !== 'on') return { error: t('start.errFacts') };
  const src = g('source_url');
  const off = g('official_url'), link = g('link_url'), cta = g('link_cta');
  if ([src, off, link].some((u) => u && !u.startsWith('https://'))) return { error: t('start.errSource') };
  const row = {
    created_by: user.id, organiser_name: g('organiser_name'), title: g('title'), target: g('target'), region: g('region'),
    ask: g('ask'), why: g('why'), source_url: src || null, topic, goal, ends_on: g('ends_on') || null, lang,
    ...(off ? { official_url: off } : {}),
    ...(link ? { link_url: link, link_cta: ['learn', 'visit', 'donate', 'join', 'event'].includes(cta) ? cta : 'learn' } : {}),
  };
  let { data, error } = await sb.from('petitions').insert(row).select('id').single();
  // until 0015_reach.sql runs, the database only knows English and Hungarian
  if (error?.message.includes('petitions_lang_check')) ({ data, error } = await sb.from('petitions').insert({ ...row, lang: 'en' }).select('id').single());
  if (error && /end_date_(past|far)/.test(error.message)) return { error: t('start.errEnd') };
  if (error) return { error: error.message.includes('slow_down') ? t('err.slow') : error.message.includes('check') ? t('start.errLength') : t('start.errSave') };
  // the database counts the founder as the first signature
  if (!data) return { error: t('start.errSave') };
  await nudgeAi();   // the AI check looks at it right after the answer is sent (0024)
  redirect(form.get('then') === 'video' ? `/post?petition=${data.id}` : `/p/${data.id}`);
}
