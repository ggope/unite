import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// One-click unsubscribe (RFC 8058): mail apps POST here from their own "Unsubscribe" button.
// Only POST stops the emails; opening the address in a browser leads to the page with a button instead.
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  const key = (new URL(req.url).searchParams.get('k') ?? '').slice(0, 100);
  if (!key || !process.env.SUPABASE_SERVICE_ROLE_KEY) return new NextResponse(null, { status: 400 });
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { error } = await sb.rpc('email_unsubscribe', { p_key: key });
  return new NextResponse(null, { status: error ? 500 : 200 });
}
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get('k') ?? '';
  return NextResponse.redirect(new URL(`/stop/${encodeURIComponent(key.slice(0, 100))}`, req.url), 303);
}
