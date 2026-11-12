'use server';
import { randomBytes } from 'node:crypto';
import { hashToken } from '@/lib/mail/token';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { makeT, isLang, type Lang } from '@/lib/i18n/dict';
import { CONSENT_VERSION } from '@/lib/topics';
import { mailReady, sendMail, escapeHtml } from '@/lib/mail/send';
import { reportProblem } from '@/lib/alert';
import { pushReady, sendPending } from '@/lib/push/send';

// Signing with only an email: no account, no password. The email holds a link; pressing "Confirm" on
// that page counts the signature. The address itself is never stored (only a keyed hash, in the database).
export type EmailSignResult = { status: 'sent' | 'fallback' | 'already' | 'wait' | 'daily_limit_reached' | 'busy' | 'bad_email' | 'petition_not_open' | 'human' | 'error' };

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const missingFn = (e: any) => !!e && /PGRST202|42883|could not find the function|does not exist/i.test(`${e.code} ${e.message}`);

async function origin() {
  const fixed = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
  if (fixed && !/localhost/.test(fixed)) return fixed;
  const h = await headers();
  return `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}`;
}

async function humanOk(captcha: string | null) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) return true;
  if (!captcha || captcha.length > 4000) return false;
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ secret, response: captcha }),
  }).then((x) => x.json()).catch(() => null);
  return !!r?.success;
}

export async function requestEmailSign(input: { petitionId: string; email: string; lang: string; captcha: string | null }): Promise<EmailSignResult> {
  // Not set up yet (no mail account in Vercel): the button uses the older sign-in link instead.
  if (!mailReady() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return { status: 'fallback' };
  const email = String(input.email ?? '').trim().toLowerCase().slice(0, 254);
  const lang: Lang = isLang(input.lang) ? input.lang : 'en';
  if (!/^[0-9a-f-]{36}$/i.test(input.petitionId)) return { status: 'petition_not_open' };
  if (!(await humanOk(input.captcha))) return { status: 'human' };

  const [h, c] = await Promise.all([headers(), cookies()]);
  const token = randomBytes(32).toString('base64url');
  const sb = admin();
  const { data, error } = await sb.rpc('email_sign_request', {
    p_petition: input.petitionId, p_email: email, p_token_hash: hashToken(token), p_lang: lang,
    p_text_version: lang === 'en' ? CONSENT_VERSION : `${CONSENT_VERSION}-${lang}`,
    p_country: h.get('x-vercel-ip-country'), p_ref: c.get('ref')?.value ?? null,
    p_ip: (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || null,
    p_daily_cap: Number(process.env.MAIL_DAILY_CAP || 400),
  });
  if (missingFn(error)) return { status: 'fallback' };   // 0021_email_sign.sql not run yet
  if (error) { await reportProblem({ source: 'server', message: `Email signing failed: ${error.message}`, path: '/s', key: 'email_sign_request' }); return { status: 'error' }; }
  if (data !== 'sent') return { status: data as EmailSignResult['status'] };

  const { data: p } = await sb.from('petitions').select('title').eq('id', input.petitionId).maybeSingle();
  const t = makeT(lang);
  const link = `${await origin()}/s/${token}`;
  const title = p?.title ?? 'UNIER';
  const sent = await sendMail({
    to: email,
    subject: t('mail.subject', { title: title.slice(0, 80) }),
    text: `${t('mail.hello')}\n\n${t('mail.body', { title })}\n\n${t('mail.button')}: ${link}\n\n${t('mail.later')}\n\n${t('mail.ignore')}\n\nUNIER`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto;padding:16px;color:#15130F">
      <p>${escapeHtml(t('mail.hello'))}</p><p>${escapeHtml(t('mail.body', { title }))}</p>
      <p style="margin:28px 0"><a href="${link}" style="background:#15130F;color:#F2EEE6;padding:14px 22px;border-radius:999px;text-decoration:none;font-weight:700;display:inline-block">${escapeHtml(t('mail.button'))}</a></p>
      <p style="color:#5f5a52;font-size:14px">${escapeHtml(t('mail.later'))}</p><p style="color:#5f5a52;font-size:14px">${escapeHtml(t('mail.ignore'))}</p><p>UNIER</p></div>`,
  });
  if (!sent.ok) {
    await sb.rpc('email_sign_withdraw', { p_token_hash: hashToken(token) });
    await reportProblem({ source: 'email', message: `Could not send a signing email: ${sent.error}`, path: '/s', key: 'smtp' });
    return { status: 'fallback' };   // try the older sign-in link, which Supabase sends
  }
  return { status: 'sent' };
}

// Both are plain form posts from the link page, so a mail scanner that only opens the link changes nothing.
export async function confirmEmailSign(fd: FormData) {
  const token = String(fd.get('token') ?? '').slice(0, 100);
  const { data, error } = await admin().rpc('email_sign_confirm', { p_token_hash: hashToken(token) });
  if (error) await reportProblem({ source: 'server', message: `Confirming an email signature failed: ${error.message}`, path: '/s', key: 'email_sign_confirm' });
  if (!error && (data as any)?.status === 'confirmed' && pushReady()) await sendPending(20).catch(() => {});   // the goal may have been reached
  redirect(`/s/${encodeURIComponent(token)}?${error ? 'err=1' : 'ok=1'}`);
}

export async function withdrawEmailSign(fd: FormData) {
  const token = String(fd.get('token') ?? '').slice(0, 100);
  const { error } = await admin().rpc('email_sign_withdraw', { p_token_hash: hashToken(token) });
  redirect(`/s/${encodeURIComponent(token)}?${error ? 'err=1' : 'gone=1'}`);
}
