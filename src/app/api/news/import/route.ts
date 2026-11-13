import { NextResponse } from 'next/server';
import { runImport } from '@/lib/news/importer';
import { reportProblem } from '@/lib/alert';
import { sendModerationDigest } from '@/lib/modDigest';

// Called by the daily Vercel cron (which sends "Authorization: Bearer $CRON_SECRET"), or any scheduler you add.
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return new NextResponse('Unauthorized', { status: 401 });
  // the morning note to moderators rides on this daily job (Vercel's free plan allows two daily crons)
  const digest = await sendModerationDigest().catch((e) => ({ error: String(e?.message ?? e) }));
  try {
    return NextResponse.json({ report: await runImport(), digest });
  } catch (e: any) {
    await reportProblem({ source: 'job', message: `Daily news import failed: ${e?.message ?? e}`, path: '/api/news/import', key: 'news-import' });
    return NextResponse.json({ error: 'import failed' }, { status: 500 });
  }
}
