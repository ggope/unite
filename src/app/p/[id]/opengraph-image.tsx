import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';
import { antonFont } from '@/lib/ogfont';
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
  const n = Number(st?.combined ?? 0), goal = p?.goal ?? 1000, pct = Math.min(100, (n / goal) * 100);
  const title = (p?.title ?? 'UNIER').toUpperCase();
  const fonts = await antonFont(`UNIER${title}${fmtN(n, 'en')}${fmtN(goal, 'en')}/0123456789,`);
  const display = fonts.length ? 'Anton' : 'sans-serif';
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: 60, color: '#111', backgroundColor: '#F2EEE6' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', fontFamily: display, fontSize: 52, letterSpacing: 2 }}>UNIER</div>
          {p?.target && <div style={{ display: 'flex', padding: '8px 16px', background: '#111', color: '#F2EEE6', fontSize: 26, fontWeight: 800 }}>{`TO ${p.target.toUpperCase()}`.slice(0, 48)}</div>}
        </div>
        <div style={{ display: 'flex', marginTop: 34, fontFamily: display, fontSize: title.length > 60 ? 76 : 92, lineHeight: 1 }}>{title}</div>
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'flex-end', gap: 18 }}>
          <div style={{ display: 'flex', fontFamily: display, fontSize: 96, lineHeight: 1 }}>{fmtN(n, 'en')}</div>
          <div style={{ display: 'flex', fontSize: 32, fontWeight: 700, color: '#4A453E', paddingBottom: 10 }}>{`/ ${fmtN(goal, 'en')}`}</div>
        </div>
        <div style={{ display: 'flex', marginTop: 16, height: 30, border: '5px solid #111', background: '#E6E0D3' }}><div style={{ width: `${pct}%`, background: '#FF5A1F' }} /></div>
      </div>
    ),
    { ...size, fonts },
  );
}
