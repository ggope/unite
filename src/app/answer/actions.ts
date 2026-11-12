'use server';
import { createClient } from '@supabase/supabase-js';
import { getT } from '@/lib/i18n/server';
import { pushReady, sendPending } from '@/lib/push/send';

export type AnswerState = { ok?: boolean; error?: string };

// Publishes the target's answer through the private link. No account needed: the link is the key.
export async function postAnswer(_: AnswerState, fd: FormData): Promise<AnswerState> {
  const { t } = await getT();
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const s = (k: string) => String(fd.get(k) ?? '').trim();
  const { error } = await sb.rpc('post_answer', { p_token: s('token'), p_name: s('name'), p_role: s('role'), p_body: s('body') });
  if (error) {
    const m = error.message;
    return { error: m.includes('bad_name') ? t('ans.errName') : m.includes('bad_body') ? t('ans.errBody') : m.includes('slow_down') ? t('ans.errSlow') : m.includes('bad_link') ? t('ans.dead') : t('ans.errOther') };
  }
  if (pushReady()) await sendPending(50).catch(() => {});   // tell signers' and followers' phones
  return { ok: true };
}
