import { currentUser } from './supabase/server';

// Everything a page needs to know about the person looking at it.
export async function loadViewer() {
  const { sb, user } = await currentUser();
  if (!user) return { sb, user: null, viewer: { loggedIn: false, hasConsent: false, oneTap: true }, signed: new Set<string>(), followed: new Set<string>(), settings: null as any, weights: {} as Record<string, number> };
  const [consent, firstSettings, sigs, fol, w] = await Promise.all([
    sb.from('consents').select('id').is('revoked_at', null).limit(1),
    sb.from('user_settings').select('*').eq('user_id', user.id).maybeSingle(),
    sb.from('signatures').select('petition_id'),
    sb.from('follows').select('petition_id'),
    sb.from('topic_weights').select('topic, weight'),
  ]);
  let settings = firstSettings;
  // An account without its settings row (made before the signup trigger existed) is repaired here.
  if (!settings.data && !settings.error) {
    await sb.rpc('ensure_profile');
    settings = await sb.from('user_settings').select('*').eq('user_id', user.id).maybeSingle();
  }
  return {
    sb, user,
    viewer: { loggedIn: true, hasConsent: (consent.data?.length ?? 0) > 0, oneTap: settings.data?.one_tap ?? true },
    signed: new Set((sigs.data ?? []).map((r: any) => r.petition_id as string)),
    followed: new Set((fol.data ?? []).map((r: any) => r.petition_id as string)),
    settings: settings.data,
    weights: Object.fromEntries((w.data ?? []).map((r: any) => [r.topic, r.weight])) as Record<string, number>,
  };
}
