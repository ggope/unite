'use server';
import { createClient } from '@supabase/supabase-js';
import { currentUser } from '@/lib/supabase/server';

// Checks a Turnstile token with Cloudflare and, if it passes, lets this account sign for 30 days.
export async function verifyHuman(token: string): Promise<{ ok: boolean }> {
  const { user } = await currentUser();
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!user || !secret || !token || token.length > 4000) return { ok: false };
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: token }),
  }).then((x) => x.json()).catch(() => null);
  if (!r?.success) return { ok: false };
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { error } = await admin.from('human_checks').upsert({ user_id: user.id, checked_at: new Date().toISOString() });
  return { ok: !error };
}
