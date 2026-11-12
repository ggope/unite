import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { reportProblem } from '@/lib/alert';

export const dynamic = 'force-dynamic';

// For an outside uptime monitor (for example UptimeRobot, free): 200 when the site and the database answer, 503 when not.
export async function GET() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const started = Date.now();
  const { error } = await Promise.race([
    sb.from('petitions').select('id', { head: true, count: 'exact' }).limit(1),
    new Promise<{ error: { message: string } }>((ok) => setTimeout(() => ok({ error: { message: 'Database did not answer within 8 seconds' } }), 8000)),
  ]);
  if (error) {
    await reportProblem({ source: 'health', message: `Database check failed: ${error.message}`, path: '/api/health', key: 'database-down' });
    return NextResponse.json({ ok: false }, { status: 503, headers: { 'cache-control': 'no-store' } });
  }
  return NextResponse.json({ ok: true, ms: Date.now() - started }, { headers: { 'cache-control': 'no-store' } });
}
