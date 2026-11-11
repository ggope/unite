import { ImageResponse } from 'next/og';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'UNIER';
export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 80, color: '#fff', backgroundColor: '#05060C', backgroundImage: 'radial-gradient(circle at 80% 25%, #2B44E6aa, transparent 55%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, fontSize: 96, fontWeight: 900, letterSpacing: 4 }}>
          <svg width="110" height="110" viewBox="0 0 32 32"><circle cx="12" cy="16" r="8.5" fill="none" stroke="#7B8CFF" strokeWidth="3" /><circle cx="20" cy="16" r="8.5" fill="none" stroke="#fff" strokeWidth="3" /></svg>UNIER
        </div>
        <div style={{ marginTop: 36, fontSize: 48, fontWeight: 700, lineHeight: 1.2, maxWidth: 950 }}>See what is happening. Sign what matters. Hear what happened next.</div>
      </div>
    ),
    size,
  );
}
