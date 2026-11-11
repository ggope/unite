'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/supabase/server';
import { TOPIC_KEYS } from '@/lib/topics';

const SETTINGS = ['one_tap', 'share_signatures_with_friends', 'is_minor', 'autoplay', 'chronological_feed'] as const;

export async function saveSettings(form: FormData) {
  const { sb, user } = await currentUser(); if (!user) return;
  const patch: Record<string, unknown> = Object.fromEntries(SETTINGS.map((k) => [k, form.get(k) === 'on']));
  const br = Number(form.get('break_reminder_minutes')); if ([10, 20, 30, 60].includes(br)) patch.break_reminder_minutes = br;
  await sb.from('user_settings').update(patch).eq('user_id', user.id);
  const handle = String(form.get('handle') ?? '').trim().toLowerCase().replace(/^@/, ''); const name = String(form.get('display_name') ?? '').trim();
  const okHandle = handle === '' || /^[a-z0-9_]{3,24}$/.test(handle);
  const { error } = await sb.from('profiles').update({ ...(okHandle ? { handle: handle || null } : {}), display_name: name.slice(0, 40) || null }).eq('id', user.id);
  // Profile and people settings (from 0006_social.sql) are saved separately, so the rest still saves before that migration runs.
  const interests = form.getAll('interests').map(String).filter((k) => (TOPIC_KEYS as readonly string[]).includes(k));
  await sb.from('profiles').update({ bio: String(form.get('bio') ?? '').trim().slice(0, 160) || null, interests }).eq('id', user.id);
  await sb.from('user_settings').update({ signatures_public: form.get('signatures_public') === 'on', allow_messages: form.get('allow_messages') === 'on' ? 'friends' : 'nobody' }).eq('user_id', user.id);
  revalidatePath('/you');
  if (!okHandle || error) redirect('/you?err=handle#profile');
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
