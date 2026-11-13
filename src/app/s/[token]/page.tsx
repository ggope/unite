import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { getT } from '@/lib/i18n/server';
import { fmtN } from '@/lib/i18n/dict';
import { confirmEmailSign, withdrawEmailSign } from '../actions';
import { hashToken } from '@/lib/mail/token';
import { ShareButton } from '@/components/ShareButton';

export const dynamic = 'force-dynamic';
// The link is a key: keep it out of search engines and out of other sites' logs.
export const metadata: Metadata = { title: 'UNIER', robots: { index: false, follow: false }, referrer: 'no-referrer' };

type Info = { petition_id: string; title: string; status: string; confirmed: boolean; expired: boolean };

// Opened from the email. Nothing happens until the person presses the button.
export default async function ConfirmSignature({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ ok?: string; gone?: string; err?: string; w?: string }> }) {
  const [{ token }, q, { lang, t }] = await Promise.all([params, searchParams, getT()]);
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data } = await sb.rpc('email_sign_lookup', { p_token_hash: hashToken(token.slice(0, 100)) });
  const info = data as Info | null;
  if (q.gone) return <div className="empty" role="status"><h1>{t('esign.goneTitle')}</h1><p>{t('esign.goneText')}</p><Link href="/petitions">{t('nav.petitions')}</Link></div>;
  if (!info) return <div className="empty"><h1>{t('esign.deadTitle')}</h1><p>{t('esign.deadText')}</p><Link href="/petitions">{t('nav.petitions')}</Link></div>;
  const { data: st } = info.confirmed ? await sb.from('petition_stats').select('combined').eq('id', info.petition_id).maybeSingle() : { data: null };
  const Form = ({ action, label, danger }: { action: (fd: FormData) => Promise<void>; label: string; danger?: boolean }) => (
    <form action={action}><input type="hidden" name="token" value={token} /><button className={`btn ${danger ? 'danger' : 'primary big block'}`}>{label}</button></form>
  );
  return (
    <div className="stack esign" style={{ maxWidth: 560 }}>
      <span className="label">UNIER · {t('esign.label')}</span>
      <h1 style={{ margin: 0 }}><Link href={`/p/${info.petition_id}`}>{info.title}</Link></h1>
      {q.err && <p className="error" role="alert">{t('sign.errOther')}</p>}
      {info.confirmed ? (<>
        <p className="ok" role="status">{q.ok ? t('esign.thanks') : t('esign.counted')}{st?.combined ? ` ${t('esign.total', { n: fmtN(st.combined, lang) })}` : ''}</p>
        <p style={{ margin: 0 }}><b>{t('esign.shareAsk')}</b></p>
        <div className="row"><ShareButton path={`/p/${info.petition_id}`} title={info.title} /><a className="btn ghost small" href={`/api/card/${info.petition_id}`} target="_blank" rel="noopener">{t('sign.shareCard')}</a></div>
        <div className="row"><Link className="btn" href={`/p/${info.petition_id}`}>{t('esign.see')}</Link><Link className="btn" href={`/login?next=/p/${info.petition_id}`}>{t('esign.account')}</Link></div>
        <p className="hint">{t('esign.accountWhy')}</p>
        {q.w ? <Form action={withdrawEmailSign} label={t('esign.withdraw')} danger /> : <Link className="hint" href={`/s/${encodeURIComponent(token)}?w=1`}>{t('esign.withdrawAsk')}</Link>}
      </>) : info.expired ? <p>{t('esign.expired')}</p>
        : info.status !== 'live' ? <p>{t('sign.errClosed')}</p>
        : (<><p className="muted" style={{ margin: 0 }}>{t('esign.press')}</p><Form action={confirmEmailSign} label={t('esign.confirm')} /></>)}
    </div>
  );
}
