import nodemailer, { type Transporter } from 'nodemailer';

// UNIER's own email sender (separate from Supabase's login emails). Three ways, picked by what is set in Vercel:
//   1. Brevo (recommended): BREVO_API_KEY and MAIL_FROM ("UNIER <hello@your-domain>", a sender verified in Brevo).
//      A French company, data kept in the EU, 300 emails a day free, built for many update emails at once.
//   2. Resend: RESEND_API_KEY and MAIL_FROM (a domain verified in Resend). US company, 100 a day free.
//   3. Any SMTP account, e.g. a Gmail address with an app password (about 500 emails a day, fine to start):
//      SMTP_HOST, SMTP_PORT (465 or 587), SMTP_USER, SMTP_PASS, and optionally MAIL_FROM.
// If both an API key and SMTP are set, the API is used.
export type MailProvider = 'brevo' | 'resend' | 'smtp';
const smtpSet = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
export function mailProvider(): MailProvider | null {
  if (process.env.BREVO_API_KEY && process.env.MAIL_FROM) return 'brevo';
  if (process.env.RESEND_API_KEY && process.env.MAIL_FROM) return 'resend';
  return smtpSet() ? 'smtp' : null;
}
export const mailReady = () => mailProvider() !== null;

let transport: Transporter | null = null;
function smtp() {
  const port = Number(process.env.SMTP_PORT || 465);
  return (transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST, port, secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000,
  }));
}

export type Mail = { to: string; subject: string; text: string; html?: string; replyTo?: string; headers?: Record<string, string> };

const fromAddress = () => process.env.MAIL_FROM || `UNIER <${process.env.SMTP_USER}>`;
function splitFrom(from: string) {
  const m = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  return m ? { name: m[1] || 'UNIER', email: m[2] } : { name: 'UNIER', email: from.trim() };
}

async function viaApi(url: string, headers: Record<string, string>, body: unknown) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(15_000) });
  if (r.ok) return { ok: true };
  return { ok: false, error: `${r.status} ${(await r.text().catch(() => '')).slice(0, 300)}` };
}

export async function sendMail(m: Mail): Promise<{ ok: boolean; error?: string }> {
  const provider = mailProvider();
  if (!provider) return { ok: false, error: 'not_configured' };
  // The e2e tests point this at a local catcher instead of a real mail server.
  if (process.env.E2E_MAIL_URL) {
    const r = await fetch(process.env.E2E_MAIL_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(m) }).catch(() => null);
    return r?.ok ? { ok: true } : { ok: false, error: 'e2e mail catcher' };
  }
  try {
    if (provider === 'brevo') {
      const reply = m.replyTo ? { replyTo: { email: m.replyTo } } : {};
      return await viaApi('https://api.brevo.com/v3/smtp/email', { 'api-key': process.env.BREVO_API_KEY! }, {
        sender: splitFrom(fromAddress()), to: [{ email: m.to }], subject: m.subject, textContent: m.text,
        ...(m.html ? { htmlContent: m.html } : {}), ...reply, ...(m.headers ? { headers: m.headers } : {}),
      });
    }
    if (provider === 'resend') {
      return await viaApi('https://api.resend.com/emails', { authorization: `Bearer ${process.env.RESEND_API_KEY}` }, {
        from: fromAddress(), to: [m.to], subject: m.subject, text: m.text,
        ...(m.html ? { html: m.html } : {}), ...(m.replyTo ? { reply_to: m.replyTo } : {}), ...(m.headers ? { headers: m.headers } : {}),
      });
    }
    await smtp().sendMail({ from: fromAddress(), ...m });
    return { ok: true };
  } catch (e: any) {
    transport = null;   // a fresh connection next time
    return { ok: false, error: String(e?.responseCode ?? '') + ' ' + String(e?.message ?? e).slice(0, 300) };
  }
}

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
