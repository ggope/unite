import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

// Finishes every email link and Google sign-in: swaps the one-time code for a session.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') || '/';
  const safe = next.startsWith('/') && !next.startsWith('//') ? next : '/';
  if (!code) return NextResponse.redirect(new URL(`/login?error=link&next=${encodeURIComponent(safe)}`, url.origin));
  const sb = await supabaseServer();
  const { error } = await sb.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL(`/login?error=link&next=${encodeURIComponent(safe)}`, url.origin));
  // Signatures made earlier with only this email move into the account (does nothing before 0021_email_sign.sql).
  await sb.rpc('claim_email_signatures').then(() => {}, () => {});
  return NextResponse.redirect(new URL(safe, url.origin));
}
