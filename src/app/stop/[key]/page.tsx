import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { getT } from '@/lib/i18n/server';
import { stopEmailUpdates } from '@/app/s/actions';

export const dynamic = 'force-dynamic';
// The link is a key: keep it out of search engines and out of other sites' logs.
export const metadata: Metadata = { title: 'UNIER', robots: { index: false, follow: false }, referrer: 'no-referrer' };

// Opened from "Stop these emails" in an update email. Nothing changes until the button is pressed,
// so a mail scanner that opens the link does not unsubscribe anyone.
export default async function StopUpdates({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ done?: string; err?: string }> }) {
  const [{ key }, q, { t }] = await Promise.all([params, searchParams, getT()]);
  if (q.done) return <div className="empty" role="status"><h1>{t('eupd.stoppedTitle')}</h1><p>{t('eupd.stoppedText')}</p><Link href="/petitions">{t('nav.petitions')}</Link></div>;
  const sb = process.env.SUPABASE_SERVICE_ROLE_KEY ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }) : null;
  const { data } = sb ? await sb.rpc('email_unsubscribe_lookup', { p_key: key.slice(0, 100) }) : { data: null };
  const info = data as { petition_id: string; title: string } | null;
  if (!info) return <div className="empty"><h1>{t('eupd.deadTitle')}</h1><p>{t('eupd.deadText')}</p><Link href="/petitions">{t('nav.petitions')}</Link></div>;
  return (
    <div className="stack esign" style={{ maxWidth: 560 }}>
      <span className="label">UNIER · {t('eupd.label')}</span>
      <h1 style={{ margin: 0 }}><Link href={`/p/${info.petition_id}`}>{info.title}</Link></h1>
      {q.err && <p className="error" role="alert">{t('sign.errOther')}</p>}
      <p style={{ margin: 0 }}>{t('eupd.stopAsk')}</p>
      <form action={stopEmailUpdates}><input type="hidden" name="key" value={key} /><button className="btn primary big block">{t('eupd.stop')}</button></form>
      <p className="hint">{t('eupd.stopKeeps')}</p>
    </div>
  );
}
