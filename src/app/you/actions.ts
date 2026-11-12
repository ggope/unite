'use server';
import { revalidatePath } from 'next/cache';
import { currentUser } from '@/lib/supabase/server';
import { TOPIC_KEYS } from '@/lib/topics';

const SETTINGS = ['one_tap', 'share_signatures_with_friends', 'is_minor', 'autoplay', 'chronological_feed'] as const;

export type SaveResult = { ok: true; error?: undefined } | { ok?: false; error: 'handle' | 'handleFormat' | 'save' | 'signedOut' };

export async function saveSettings(form: FormData): Promise<SaveResult> {
  const { sb, user } = await currentUser(); if (!user) return { error: 'signedOut' };
  await sb.rpc('ensure_profile');   // repairs accounts that never got their profile row
  const patch: Record<string, unknown> = Object.fromEntries(SETTINGS.map((k) => [k, form.get(k) === 'on']));
  const br = Number(form.get('break_reminder_minutes')); if ([10, 20, 30, 60].includes(br)) patch.break_reminder_minutes = br;
  // "Kovács Anna" becomes "kovacs_anna": accents dropped, spaces become _.
  const handle = String(form.get('handle') ?? '').trim().toLowerCase().replace(/^@/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');
  const name = String(form.get('display_name') ?? '').trim();
  if (handle !== '' && !/^[a-z0-9_]{3,24}$/.test(handle)) return { error: 'handleFormat' };
  const interests = form.getAll('interests').map(String).filter((k) => (TOPIC_KEYS as readonly string[]).includes(k));
  const [s1, p1] = await Promise.all([
    sb.from('user_settings').update({ ...patch, signatures_public: form.get('signatures_public') === 'on', allow_messages: form.get('allow_messages') === 'on' ? 'friends' : 'nobody' }).eq('user_id', user.id).select('user_id'),
    sb.from('profiles').update({ handle: handle || null, display_name: name.slice(0, 40) || null, bio: String(form.get('bio') ?? '').trim().slice(0, 160) || null, interests }).eq('id', user.id).select('id'),
  ]);
  revalidatePath('/you');
  if (p1.error?.code === '23505') return { error: 'handle' };   // handle taken
  if (p1.error || s1.error || !p1.data?.length || !s1.data?.length) { console.error('saveSettings', p1.error ?? s1.error ?? 'no row updated'); return { error: 'save' }; }
  return { ok: true };
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
