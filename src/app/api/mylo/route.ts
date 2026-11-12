import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { asMylo } from '@/lib/mylo';

// Mylo's mood is the same for everyone, so it is computed at most every 10 minutes and cached.
export const dynamic = 'force-dynamic';   // cached by the CDN (Cache-Control below), not at build time

export async function GET() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data } = await sb.rpc('mylo_today');
  const m = asMylo(data);
  return NextResponse.json({ mood: m.mood, future: m.future, signed_24h: m.signed_24h, usual: m.usual },
    { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' } });
}
