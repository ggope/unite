import { createClient } from '@supabase/supabase-js';
import { makeT, fmtN, isLang, type Key, type Lang } from '@/lib/i18n/dict';
import { localize } from '@/lib/petitionText';
import { siteUrl } from '@/lib/topics';
import { mailProvider, sendMail, escapeHtml } from './send';
import { reportProblem } from '@/lib/alert';

// Update emails for people who signed with only an email and ticked "Email me when something happens" (0027).
// Same events as the phone notifications. Each run sends what is waiting, up to a daily limit that protects
// the mail account: MAIL_UPDATES_DAILY_CAP, by default 250 with Brevo or Resend and 100 with Gmail/SMTP
// (signing emails need the rest). A stopped run carries on next time; nobody gets the same news twice.
export const updatesCap = () => Number(process.env.MAIL_UPDATES_DAILY_CAP || (mailProvider() === 'smtp' ? 100 : 250));

const site = siteUrl;
export const stopLink = (key: string) => `${site()}/stop/${key}`;

export function updateMail(p: any, e: { kind: string; title: string | null }, to: { email: string; lang: string; notify_key: string }) {
  const lang: Lang = isLang(to.lang) ? to.lang : 'en'; const t = makeT(lang);
  const loc = localize(p, lang);
  const signed = Number((Array.isArray(p.petition_stats) ? p.petition_stats[0] : p.petition_stats)?.combined ?? 0);
  const what = e.kind === 'goal' ? t('push.goal', { goal: fmtN(p.goal, lang) })
    : e.kind === 'closed' ? t('push.closed', { n: fmtN(signed, lang) })
    : e.kind === 'silent' ? t('push.silent', { n: e.title ?? '', target: loc.target })
    : `${t(`kind.${e.kind}` as Key)}: ${e.title ?? ''}`;
  const open = `${site()}/p/${p.id}`;
  const stop = stopLink(to.notify_key);
  return {
    to: to.email,
    subject: t('eupd.subject', { title: loc.title.slice(0, 80) }),
    text: `${loc.title}\n\n${what}\n\n${t('eupd.open')}: ${open}\n\n${t('eupd.why')}\n${t('eupd.stop')}: ${stop}\n\nUNIER`,
    // Plain, one column, big tap targets: reads the same on a phone as on a computer.
    html: `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F2EEE6"><div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:20px 16px;color:#15130F;font-size:16px;line-height:1.5">
<p style="margin:0 0 4px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#5f5a52">UNIER</p>
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;word-wrap:break-word">${escapeHtml(loc.title)}</h1>
<p style="margin:0 0 24px;font-size:18px;word-wrap:break-word">${escapeHtml(what)}</p>
<p style="margin:0 0 32px"><a href="${open}" style="background:#15130F;color:#F2EEE6;padding:14px 22px;border-radius:999px;text-decoration:none;font-weight:700;display:inline-block">${escapeHtml(t('eupd.open'))}</a></p>
<p style="margin:0 0 8px;color:#5f5a52;font-size:14px">${escapeHtml(t('eupd.why'))}</p>
<p style="margin:0;font-size:14px"><a href="${stop}" style="color:#15130F;display:inline-block;padding:8px 0">${escapeHtml(t('eupd.stop'))}</a></p>
</div></body></html>`,
    // Gmail, Apple Mail and others show their own "Unsubscribe" button with these (one click, no page).
    headers: { 'List-Unsubscribe': `<${site()}/api/stop?k=${to.notify_key}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
  };
}

export async function sendUpdateEmails(maxEvents = 5) {
  if (!mailProvider() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return { off: true };
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: events, error } = await sb.rpc('claim_mail_events', { p_limit: maxEvents });
  if (error) return { off: true };   // 0027_email_updates.sql not run yet
  const cap = updatesCap();
  let left = Number((await sb.rpc('mail_quota', { p_cap: cap, p_used: 0 })).data ?? 0);
  let sent = 0, failed = 0, lastError = '';
  for (const e of (events ?? []) as any[]) {
    if (left <= 0) break;
    const { data: p } = await sb.from('petitions').select('id, title, target, ask, why, goal, lang, tr, status, petition_stats(combined)').eq('id', e.petition_id).maybeSingle();
    if (!p || !['live', 'closed'].includes(p.status)) { await sb.rpc('finish_mail_event', { p_event: e.id }); continue; }
    while (left > 0) {
      const want = Math.min(50, left);
      const { data: batch } = await sb.rpc('mail_batch', { p_event: e.id, p_limit: want });
      const list = (batch ?? []) as { email: string; lang: string; notify_key: string }[];
      for (let i = 0; i < list.length; i += 5) {   // a few at a time, gentle on the mail service
        const res = await Promise.all(list.slice(i, i + 5).map((to) => sendMail(updateMail(p, e, to))));
        for (const r of res) { if (r.ok) sent++; else { failed++; lastError = r.error ?? ''; } }
      }
      left = Number((await sb.rpc('mail_quota', { p_cap: cap, p_used: list.length })).data ?? 0);
      if (list.length < want) { await sb.rpc('finish_mail_event', { p_event: e.id }); break; }
    }
  }
  if (failed) await reportProblem({ source: 'email', message: `Update emails failed (${failed}): ${lastError}`, path: '/api/push', key: 'update-mail' });
  return { sent, failed, events: events?.length ?? 0, left };
}
