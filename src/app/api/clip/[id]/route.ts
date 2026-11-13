import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// The still picture for a team clip, fetched by UNIER's server so a visitor's browser
// never talks to YouTube before they tap play. Only ids of live team clips are served.
export const runtime = 'nodejs';
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return new NextResponse('Not found', { status: 404 });
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data } = await sb.from('team_videos').select('id').eq('youtube_id', id).eq('status', 'live').maybeSingle();
  if (!data) return new NextResponse('Not found', { status: 404 });
  try {
    const r = await fetch(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`, { signal: AbortSignal.timeout(6000), next: { revalidate: 86400 } });
    if (!r.ok) return new NextResponse('Not found', { status: 404 });
    return new NextResponse(await r.arrayBuffer(), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400, s-maxage=604800' } });
  } catch { return new NextResponse('Not found', { status: 404 }); }
}
