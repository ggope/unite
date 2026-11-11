'use server';
import { revalidatePath } from 'next/cache';
import { currentUser } from '@/lib/supabase/server';

const SETTINGS = ['one_tap', 'share_signatures_with_friends', 'is_minor', 'autoplay', 'chronological_feed'] as const;

export async function saveSettings(form: FormData) {
  const { sb, user } = await currentUser(); if (!user) return;
  const patch: Record<string, unknown> = Object.fromEntries(SETTINGS.map((k) => [k, form.get(k) === 'on']));
  const br = Number(form.get('break_reminder_minutes')); if ([10, 20, 30, 60].includes(br)) patch.break_reminder_minutes = br;
  await sb.from('user_settings').update(patch).eq('user_id', user.id);
  const handle = String(form.get('handle') ?? '').trim().toLowerCase(); const name = String(form.get('display_name') ?? '').trim();
  await sb.from('profiles').update({ handle: /^[a-z0-9_]{3,24}$/.test(handle) ? handle : null, display_name: name || null }).eq('id', user.id);
  revalidatePath('/you');
}
export async function withdraw(form: FormData) {
  const { sb } = await currentUser();
  await sb.from('signatures').delete().eq('petition_id', String(form.get('petition_id')));
  revalidatePath('/you');
}
export async function revokeConsent() {
  const { sb } = await currentUser(); await sb.rpc('revoke_signature_consent'); revalidatePath('/you');
}
export async function resetFeed() {
  const { sb, user } = await currentUser(); if (!user) return;
  await sb.from('topic_weights').delete().eq('user_id', user.id); revalidatePath('/you');
}
export async function signOut() {
  const { sb } = await currentUser(); await sb.auth.signOut(); revalidatePath('/');
}
