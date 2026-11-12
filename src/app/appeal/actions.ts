'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { currentUser } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n/server';

export type AppealState = { error?: string };

// Asks for a second look at a moderator's decision (EU Digital Services Act, article 20).
export async function fileAppeal(_: AppealState, fd: FormData): Promise<AppealState> {
  const { sb, user } = await currentUser();
  if (!user) redirect('/login?next=/you');
  const { t } = await getT();
  const s = (k: string) => String(fd.get(k) ?? '').trim();
  const { error } = await sb.rpc('file_appeal', { p_kind: s('kind'), p_ref: s('id'), p_body: s('body') });
  if (error) {
    const m = error.message;
    return { error: m.includes('bad_body') ? t('appeal.errBody') : m.includes('already_appealed') ? t('appeal.errTwice')
      : m.includes('too_late') ? t('appeal.errLate') : m.includes('slow_down') ? t('err.slow') : t('appeal.errOther') };
  }
  revalidatePath('/you');
  redirect('/you?appealed=1#appeals');
}
