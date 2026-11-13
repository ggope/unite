import { NextResponse } from 'next/server';
import { notifyFollowers } from '@/lib/notify';

// Sends waiting notifications and update emails. Safe to call by anyone: it only delivers what the database queued.
export const dynamic = 'force-dynamic';
export async function POST() {
  try { const { push, mail } = await notifyFollowers(); return NextResponse.json({ ...push, mail }); }
  catch (e) { console.error('push send failed', e); return NextResponse.json({ error: 'send_failed' }, { status: 500 }); }
}
