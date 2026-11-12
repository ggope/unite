import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';
import { siteUrl } from '@/lib/topics';
import { ogFonts } from '@/lib/ogfont';
import { LogoMark } from '@/lib/logo';
import { makeT, pickLang, fmtN } from '@/lib/i18n/dict';

export const runtime = 'edge';

// 1080×1920 story card: "I signed." + petition + live count. Public data only.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lang = pickLang(req.headers.get('cookie')?.match(/(?:^|;\s*)lang=(\w+)/)?.[1], req.headers.get('accept-language'));
  const t = makeT(lang); const fmt = (n: number) => fmtN(n, lang);
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const [{ data: p }, { data: st }] = await Promise.all([
    sb.from('petitions').select('title, topic, goal').eq('id', id).maybeSingle(),
    sb.from('petition_stats').select('combined').eq('id', id).maybeSingle(),
  ]);
  if (!p) return new Response('Not found', { status: 404 });
  const n = Number(st?.combined ?? 0); const pct = Math.min(100, (n / p.goal) * 100);
  const signedTxt = t('card.signed').toUpperCase(); const title = p.title.toUpperCase();
  const withTxt = t('card.with', { goal: fmt(p.goal) }), cta = t('card.cta'), link = `${siteUrl().replace(/^https?:\/\//, '')}/p/${id}`;
  const { fonts, display, body } = await ogFonts(`UNIER${signedTxt}${title}${fmt(n)}0123456789,. `, `${withTxt}${cta}${link}`);
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: 80, color: '#111', backgroundColor: '#FF5A1F' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}><LogoMark size={110} round /><div style={{ display: 'flex', fontFamily: display, fontSize: 80, letterSpacing: 3 }}>UNIER</div></div>
        <div style={{ display: 'flex', marginTop: 200, fontFamily: display, fontSize: 230, lineHeight: 0.95 }}>{signedTxt}</div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 60, padding: 50, background: '#F2EEE6', border: '8px solid #111' }}>
          <div style={{ display: 'flex', fontFamily: display, fontSize: 84, lineHeight: 1.02 }}>{title}</div>
          <div style={{ display: 'flex', marginTop: 50, fontFamily: display, fontSize: 130, lineHeight: 1 }}>{fmt(n)}</div>
          <div style={{ display: 'flex', fontFamily: body, fontSize: 44, fontWeight: 800, color: '#4A453E' }}>{withTxt}</div>
          <div style={{ display: 'flex', marginTop: 30, height: 40, border: '6px solid #111', background: '#E6E0D3' }}><div style={{ width: `${pct}%`, background: '#FF5A1F' }} /></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'auto', padding: 40, background: '#111', color: '#F2EEE6', fontFamily: body, fontSize: 60, fontWeight: 800 }}>{cta}</div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 26, fontFamily: body, fontSize: 40, fontWeight: 800 }}>{link}</div>
      </div>
    ),
    { width: 1080, height: 1920, fonts, headers: { 'Cache-Control': 'private, max-age=300', Vary: 'Cookie, Accept-Language' } },
  );
}
