'use server';
import { revalidatePath } from 'next/cache';
import { currentUser } from '@/lib/supabase/server';

export async function review(form: FormData) {
  const { sb } = await currentUser();   // row level security only lets moderators update
  const table = form.get('kind') === 'petition' ? 'petitions' : 'videos';
  const approve = form.get('decision') === 'approve';
  const status = table === 'petitions' ? (approve ? 'live' : 'removed') : (approve ? 'approved' : 'rejected');
  await sb.from(table).update({ status, ...(table === 'videos' ? { moderation_note: String(form.get('note') || '') || null } : {}) }).eq('id', String(form.get('id')));
  revalidatePath('/moderate');
}
