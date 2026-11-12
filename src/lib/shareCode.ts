'use client';
import { supabaseBrowser } from './supabase/client';

// The signed-in person's share code, fetched once per page load and per account.
let cached: { uid: string; code: Promise<string | null> } | null = null;
export async function myShareCode(): Promise<string | null> {
  const sb = supabaseBrowser();
  const uid = (await sb.auth.getSession()).data.session?.user.id;
  if (!uid) return null;
  if (cached?.uid !== uid) cached = { uid, code: Promise.resolve(sb.rpc('my_share_code')).then((r: any) => (r.error ? null : (r.data as string | null))) };
  return cached!.code;
}

// The code from the link that brought this visitor here (set by the middleware, kept 30 days).
export function arrivedVia(): string | null {
  const m = typeof document !== 'undefined' && document.cookie.match(/(?:^|;\s*)ref=([a-f0-9]{12})/);
  return m ? m[1] : null;
}
