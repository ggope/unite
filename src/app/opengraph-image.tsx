import { ImageResponse } from 'next/og';
import { ogFonts } from '@/lib/ogfont';
import { LogoMark } from '@/lib/logo';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'UNIER';
export default async function Image() {
  const tagline = 'See what is happening. Sign in one tap. Hear what happened next.';
  const { fonts, display, body } = await ogFonts('UNIERSIGN WHAT MATTERS.', tagline);
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 80, color: '#111', backgroundColor: '#F2EEE6' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}><LogoMark size={200} round /><div style={{ display: 'flex', fontFamily: display, fontSize: 220, lineHeight: 1, letterSpacing: 6 }}>UNIER</div></div>
        <div style={{ display: 'flex', alignSelf: 'flex-start', marginTop: 24, padding: '14px 26px', background: '#FF5A1F', border: '6px solid #111', fontFamily: display, fontSize: 64 }}>SIGN WHAT MATTERS.</div>
        <div style={{ display: 'flex', marginTop: 28, fontFamily: body, fontSize: 34, fontWeight: 800, color: '#4A453E' }}>{tagline}</div>
      </div>
    ),
    { ...size, fonts },
  );
}
