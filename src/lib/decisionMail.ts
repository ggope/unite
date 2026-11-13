import { createClient } from '@supabase/supabase-js';
import { makeT, isLang, type Lang } from './i18n/dict';
import { mailReady, sendMail, escapeHtml } from './mail/send';
import { reportProblem } from './alert';
import { siteUrl } from './topics';

// Tells the author by email when a moderator puts their petition or video live, or takes it down.
// The same news also waits under You (0022); the email is for the many who never come back to look.
// Never throws: a failed email must not undo or block the decision.
export async function tellAuthor(kind: 'petition' | 'video', id: string, outcome: 'live' | 'off', reason?: string | null) {
  try {
    if (!mailReady() || !process.env.SUPABASE_SERVICE_ROLE_KEY || !id) return;
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const row = kind === 'petition'
      ? (await sb.from('petitions').select('id, title, lang, created_by').eq('id', id).maybeSingle()).data
      : (await sb.from('videos').select('id, uploader_id, petitions(id, title, lang)').eq('id', id).maybeSingle()).data;
    if (!row) return;
    const p: any = kind === 'petition' ? row : (Array.isArray((row as any).petitions) ? (row as any).petitions[0] : (row as any).petitions);
    const userId = kind === 'petition' ? (row as any).created_by : (row as any).uploader_id;
    if (!userId || !p) return;
    const { data: u } = await sb.auth.admin.getUserById(userId);
    const to = u?.user?.email; if (!to) return;
    const lang: Lang = isLang(p.lang) ? p.lang : 'en'; const t = makeT(lang);
    const site = siteUrl();
    const text = kind === 'petition'
      ? (outcome === 'live' ? t('notice.petLive', { title: p.title }) : t('notice.petRemoved', { title: p.title, reason: reason ?? '' }))
      : (outcome === 'live' ? t('notice.vidLive', { title: p.title }) : t('notice.vidRejected', { title: p.title, reason: reason ?? '' }));
    const open = `${site}/p/${p.id}`;
    const appeal = outcome === 'off' ? `${site}/appeal?kind=${kind}&id=${id}` : null;
    const r = await sendMail({
      to, subject: t('mail.decideSubject'),
      text: [t('mail.hello'), '', text, '', `${t('mail.decideSee')}: ${open}`, ...(appeal ? ['', `${t('mail.decideAppeal')}: ${appeal}`] : []), '', 'UNIER'].join('\n'),
      html: `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto;padding:16px;color:#15130F">
        <p>${escapeHtml(t('mail.hello'))}</p><p>${escapeHtml(text)}</p>
        <p style="margin:28px 0"><a href="${open}" style="background:#15130F;color:#F2EEE6;padding:14px 22px;border-radius:999px;text-decoration:none;font-weight:700;display:inline-block">${escapeHtml(t('mail.decideSee'))}</a></p>
        ${appeal ? `<p><a href="${appeal}">${escapeHtml(t('mail.decideAppeal'))}</a></p>` : ''}<p>UNIER</p></div>`,
    });
    if (!r.ok) await reportProblem({ source: 'email', message: `Could not tell an author about a decision: ${r.error}`, path: '/admin', key: 'decision-mail' });
  } catch { /* the decision stands either way */ }
}
