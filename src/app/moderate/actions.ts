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

async function requireModerator() {
  const { sb, user } = await currentUser();
  if (!user) throw new Error('not_signed_in');
  const { data } = await sb.from('profiles').select('is_moderator').eq('id', user.id).single();
  if (!data?.is_moderator) throw new Error('not_moderator');
  return sb;
}

export async function importNews() {
  await requireModerator();
  const { runImport } = await import('@/lib/news/importer');
  await runImport();
  revalidatePath('/moderate'); revalidatePath('/');
}

export async function newsAction(form: FormData) {
  const sb = await requireModerator();
  const id = String(form.get('id'));
  if (form.get('do') === 'hide') await sb.from('news_items').update({ status: 'hidden' }).eq('id', id);
  if (form.get('do') === 'attach') { const p = String(form.get('petition_id') || ''); await sb.from('news_items').update({ petition_id: p || null }).eq('id', id); }
  revalidatePath('/moderate'); revalidatePath('/');
}

export async function toggleSource(form: FormData) {
  const sb = await requireModerator();
  await sb.from('news_sources').update({ active: form.get('active') === 'true' }).eq('id', String(form.get('id')));
  revalidatePath('/moderate');
}
