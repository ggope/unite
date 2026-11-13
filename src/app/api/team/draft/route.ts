import { NextResponse } from 'next/server';
import { runDrafts } from '@/lib/team/draft';
import { reportProblem } from '@/lib/alert';

// Called by the daily Vercel cron half an hour after the news import ("Authorization: Bearer $CRON_SECRET").
// Drafts go to Admin → Review queue; nothing is published without a moderator.
export const runtime = 'nodejs';
export const maxDuration = 300;
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return new NextResponse('Unauthorized', { status: 401 });
  try {
    const report = await runDrafts();
    if (report.failed && !report.drafted && report.notes.length) await reportProblem({ source: 'job', message: `Team petition drafts failed: ${report.notes[0]}`, path: '/api/team/draft', key: 'team-draft' });
    return NextResponse.json({ report });
  } catch (e: any) {
    await reportProblem({ source: 'job', message: `Team petition drafts failed: ${e?.message ?? e}`, path: '/api/team/draft', key: 'team-draft' });
    return NextResponse.json({ error: 'drafting failed' }, { status: 500 });
  }
}
