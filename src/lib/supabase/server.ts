import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => { try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* called from a server component */ } },
    },
  });
}

export type SessionUser = { id: string; email: string | null };

// Reads the signed-in person from the session cookie. getClaims checks the token's signature locally
// (no trip to the auth server) when the project uses asymmetric signing keys, which new projects do.
// Guests have no auth cookie, so they skip the check entirely.
export async function currentUser() {
  const store = await cookies();
  const sb = await supabaseServer();
  if (!store.getAll().some((c) => c.name.startsWith('sb-') && c.name.includes('-auth-token'))) return { sb, user: null as SessionUser | null };
  const { data } = await sb.auth.getClaims();
  const c = data?.claims;
  return { sb, user: c?.sub ? ({ id: c.sub, email: (c.email as string) ?? null } as SessionUser) : null };
}
