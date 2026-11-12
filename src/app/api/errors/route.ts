import { NextResponse, type NextRequest } from 'next/server';
import { reportProblem } from '@/lib/alert';

// Errors that happen in visitors' browsers (a page that crashed on their phone). Small and anonymous.
export async function POST(req: NextRequest) {
  const raw = await req.text().catch(() => '');
  if (raw.length > 6000) return new NextResponse(null, { status: 413 });
  let b: any; try { b = JSON.parse(raw); } catch { return new NextResponse(null, { status: 400 }); }
  const s = (x: unknown, n: number) => (typeof x === 'string' ? x.slice(0, n) : '');
  if (!s(b?.message, 500)) return new NextResponse(null, { status: 400 });
  const same = (req.headers.get('origin') ?? '') === req.nextUrl.origin;
  if (!same) return new NextResponse(null, { status: 403 });
  await reportProblem({ source: 'browser', message: s(b.message, 500), path: s(b.path, 300), detail: [s(b.digest, 100) && `digest ${s(b.digest, 100)}`, s(b.stack, 1500), `UA: ${req.headers.get('user-agent')?.slice(0, 200) ?? ''}`].filter(Boolean).join('\n') });
  return new NextResponse(null, { status: 204 });
}
