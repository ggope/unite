import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';
import { TOPICS } from '@/lib/topics';
import { fmtN } from '@/lib/i18n/dict';

// The picture WhatsApp, Messenger, Facebook and others show when a petition link is shared.
export const runtime = 'edge';
export const revalidate = 600;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'UNIER petition';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const [{ data: p }, { data: st }] = await Promise.all([
    sb.from('petitions').select('title, topic, goal, target').eq('id', id).maybeSingle(),
    sb.from('petition_stats').select('combined').eq('id', id).maybeSingle(),
  ]);
  const tp = TOPICS[(p?.topic as keyof typeof TOPICS) ?? 'climate'];
  const n = Number(st?.combined ?? 0), goal = p?.goal ?? 1000, pct = Math.min(100, (n / goal) * 100);
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: 64, color: '#fff', background: `radial-gradient(circle at 85% 20%, ${tp.b}bb, transparent 55%), linear-gradient(160deg, ${tp.a}, #070812)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 36, fontWeight: 900, letterSpacing: 2 }}>
          <svg width="48" height="48" viewBox="0 0 32 32"><circle cx="12" cy="16" r="8.5" fill="none" stroke="#7B8CFF" strokeWidth="3" /><circle cx="20" cy="16" r="8.5" fill="none" stroke="#fff" strokeWidth="3" /></svg>UNIER
        </div>
        <div style={{ marginTop: 40, fontSize: p && p.title.length > 60 ? 58 : 68, fontWeight: 800, lineHeight: 1.1 }}>{p?.title ?? 'UNIER'}</div>
        {p?.target && <div style={{ marginTop: 16, fontSize: 30, opacity: 0.8 }}>{`→ ${p.target}`}</div>}
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'flex-end', gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 800 }}>{fmtN(n, 'en')}</div>
          <div style={{ fontSize: 32, opacity: 0.85, paddingBottom: 14 }}>{`/ ${fmtN(goal, 'en')}`}</div>
        </div>
        <div style={{ display: 'flex', marginTop: 18, height: 18, borderRadius: 9, background: 'rgba(255,255,255,.22)' }}><div style={{ width: `${pct}%`, borderRadius: 9, background: '#fff' }} /></div>
      </div>
    ),
    size,
  );
}
