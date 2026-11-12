import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendPending } from '@/lib/push/send';

// Nightly (Vercel cron, "Authorization: Bearer $CRON_SECRET"): closes petitions after their end date,
// reminds organisers to deliver, and tells followers when a target has been silent 30 or 90 days (0018).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return new NextResponse('Unauthorized', { status: 401 });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not set' }, { status: 503 });
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data, error } = await sb.rpc('run_lifecycle');
  if (error) { console.error('lifecycle failed', error.message); return NextResponse.json({ error: error.message }, { status: 500 }); }
  const push = await sendPending(50).catch((e) => ({ error: String(e?.message ?? e) }));
  return NextResponse.json({ lifecycle: data, push });
}
