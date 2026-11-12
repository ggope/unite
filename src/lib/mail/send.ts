import nodemailer, { type Transporter } from 'nodemailer';

// UNIER's own email sender (separate from Supabase's login emails).
// Works with any SMTP account. Today: a Gmail address with an app password (about 500 emails a day).
// Later, with an own domain: Resend, Brevo or Postmark SMTP, by changing the same four settings in Vercel.
//   SMTP_HOST, SMTP_PORT (465 or 587), SMTP_USER, SMTP_PASS, and optionally MAIL_FROM ("UNIER <hello@your-domain>")
export const mailReady = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let transport: Transporter | null = null;
function smtp() {
  const port = Number(process.env.SMTP_PORT || 465);
  return (transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST, port, secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000,
  }));
}

export type Mail = { to: string; subject: string; text: string; html?: string; replyTo?: string };

export async function sendMail(m: Mail): Promise<{ ok: boolean; error?: string }> {
  if (!mailReady()) return { ok: false, error: 'not_configured' };
  // The e2e tests point this at a local catcher instead of a real mail server.
  if (process.env.E2E_MAIL_URL) {
    const r = await fetch(process.env.E2E_MAIL_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(m) }).catch(() => null);
    return r?.ok ? { ok: true } : { ok: false, error: 'e2e mail catcher' };
  }
  try {
    await smtp().sendMail({ from: process.env.MAIL_FROM || `UNIER <${process.env.SMTP_USER}>`, ...m });
    return { ok: true };
  } catch (e: any) {
    transport = null;   // a fresh connection next time
    return { ok: false, error: String(e?.responseCode ?? '') + ' ' + String(e?.message ?? e).slice(0, 300) };
  }
}

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
