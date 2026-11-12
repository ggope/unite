import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { mailReady, sendMail } from './mail/send';

// Records an error from the live site and emails the owner (ALERT_EMAIL) the first time it happens,
// then at most every 6 hours while it keeps happening. Never throws: alerting must not break a page.
export type Problem = { source: 'server' | 'browser' | 'email' | 'job' | 'health'; message: string; path?: string | null; detail?: string | null; key?: string };

const admin = () => process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

// Numbers and ids change between occurrences of the same bug, so they are left out of the fingerprint.
const shape = (s: string) => s.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, ':id').replace(/\d+/g, '0').slice(0, 300);
const clean = (s: string) => s.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]').replace(/(token|code|key|secret)=[^&\s]+/gi, '$1=…');   // no personal data in the log

export async function reportProblem(p: Problem): Promise<void> {
  try {
    const message = clean(p.message || 'Unknown error').slice(0, 500);
    const path = p.path ? clean(p.path.split('?')[0]).slice(0, 300) : null;
    const fingerprint = createHash('sha256').update(`${p.source}|${p.key ?? shape(message)}|${path ? shape(path) : ''}`).digest('hex').slice(0, 32);
    const sb = admin();
    let alert = true;
    if (sb) {
      const { data, error } = await sb.rpc('log_error', { p_fingerprint: fingerprint, p_source: p.source, p_message: message, p_path: path, p_detail: p.detail ? clean(p.detail).slice(0, 4000) : null });
      if (!error) alert = data === true;
      else if (!/log_error|PGRST202|42883/.test(`${error.code} ${error.message}`)) alert = true;   // the log itself is broken: say so
      else alert = !recentlySent(fingerprint);                                                    // 0021 not run yet: throttle in memory
    } else alert = !recentlySent(fingerprint);
    if (!alert || !process.env.ALERT_EMAIL || !mailReady() || p.source === 'email') return;
    const site = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
    await sendMail({
      to: process.env.ALERT_EMAIL,
      subject: `UNIER problem: ${message.slice(0, 80)}`,
      text: [`Something went wrong on UNIER.`, '', `What: ${message}`, `Where: ${path ?? '–'} (${p.source})`, `When: ${new Date().toISOString()}`,
        p.detail ? `\nDetails:\n${clean(p.detail).slice(0, 1500)}` : '', '',
        `All errors: ${site ? site + '/admin?tab=errors' : 'Admin → Errors'}`,
        `You get this email once per kind of error, then at most every 6 hours while it keeps happening.`].join('\n'),
    });
  } catch { /* never let alerting break the page */ }
}

const sent = new Map<string, number>();
function recentlySent(fp: string) {
  const last = sent.get(fp) ?? 0;
  if (Date.now() - last < 6 * 3600_000) return true;
  sent.set(fp, Date.now()); if (sent.size > 500) sent.clear();
  return false;
}
