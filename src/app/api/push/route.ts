import { NextResponse } from 'next/server';
import { sendPending } from '@/lib/push/send';

// Sends waiting notifications. Safe to call by anyone: it only delivers what the database queued.
export const dynamic = 'force-dynamic';
export async function POST() {
  try { return NextResponse.json(await sendPending()); }
  catch (e) { console.error('push send failed', e); return NextResponse.json({ error: 'send_failed' }, { status: 500 }); }
}
