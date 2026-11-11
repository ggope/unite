import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';
import { TOPICS, fmt, siteUrl } from '@/lib/topics';

export const runtime = 'edge';

// 1080×1920 story card: "I signed." + petition + live count. Public data only.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const [{ data: p }, { data: st }] = await Promise.all([
    sb.from('petitions').select('title, topic, goal').eq('id', id).maybeSingle(),
    sb.from('petition_stats').select('combined').eq('id', id).maybeSingle(),
  ]);
  if (!p) return new Response('Not found', { status: 404 });
  const t = TOPICS[p.topic as keyof typeof TOPICS]; const n = Number(st?.combined ?? 0); const pct = Math.min(100, (n / p.goal) * 100);
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: 80, color: '#fff', background: `radial-gradient(circle at 75% 28%, ${t.b}cc, transparent 55%), linear-gradient(170deg, ${t.a}, #070812)` }}>
        <div style={{ fontSize: 64, fontWeight: 900, letterSpacing: 2 }}>UNIER</div>
        <div style={{ marginTop: 300, fontSize: 190, fontWeight: 900, lineHeight: 1 }}>I signed.</div>
        <div style={{ marginTop: 40, fontSize: 70, fontWeight: 700, lineHeight: 1.15 }}>{p.title}</div>
        <div style={{ marginTop: 'auto', fontSize: 120, fontWeight: 700 }}>{fmt(n)}</div>
        <div style={{ fontSize: 46, opacity: 0.85 }}>{`people with me · goal ${fmt(p.goal)}`}</div>
        <div style={{ display: 'flex', marginTop: 40, height: 26, borderRadius: 13, background: 'rgba(255,255,255,.22)' }}><div style={{ width: `${pct}%`, borderRadius: 13, background: '#fff' }} /></div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 120, padding: 40, borderRadius: 80, background: '#fff', color: '#11142B', fontSize: 60, fontWeight: 800 }}>Sign with one tap</div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 30, fontSize: 40, opacity: 0.8 }}>{`${siteUrl().replace(/^https?:\/\//, '')}/p/${id}`}</div>
      </div>
    ),
    { width: 1080, height: 1920, headers: { 'Cache-Control': 'public, max-age=300' } },
  );
}
