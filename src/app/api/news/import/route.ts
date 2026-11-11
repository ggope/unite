import { NextResponse } from 'next/server';
import { runImport } from '@/lib/news/importer';

// Called by the daily Vercel cron (which sends "Authorization: Bearer $CRON_SECRET"), or any scheduler you add.
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return new NextResponse('Unauthorized', { status: 401 });
  return NextResponse.json({ report: await runImport() });
}
