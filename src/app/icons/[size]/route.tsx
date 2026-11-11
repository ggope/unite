import { ImageResponse } from 'next/og';
import { LogoMark } from '@/lib/logo';

export const runtime = 'edge';
const SIZES: Record<string, { px: number; pad: number }> = { '192': { px: 192, pad: 0.12 }, '512': { px: 512, pad: 0.12 }, maskable: { px: 512, pad: 0.24 } };

export async function GET(_: Request, { params }: { params: Promise<{ size: string }> }) {
  const s = SIZES[(await params).size] ?? SIZES['512'];
  return new ImageResponse(<LogoMark size={s.px} pad={s.pad} />, { width: s.px, height: s.px, headers: { 'Cache-Control': 'public, max-age=604800, immutable' } });
}
