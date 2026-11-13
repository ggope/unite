import { createClient } from '@supabase/supabase-js';
import { mailReady, sendMail } from './mail/send';
import { siteUrl } from './topics';

// Every morning: if anything is waiting for a moderator, one short email to ALERT_EMAIL says how much.
// New organisers otherwise wait in silence, and the EU Digital Services Act expects reports to be handled in good time.
export async function sendModerationDigest(): Promise<Record<string, number> | null> {
  if (!process.env.ALERT_EMAIL || !mailReady() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const count = async (q: PromiseLike<{ count: number | null; error: unknown }>) => { const r = await q; return r.error ? 0 : r.count ?? 0; };   // a table not there yet counts as 0
  const head = { count: 'exact' as const, head: true };
  const n = {
    petitions: await count(sb.from('petitions').select('id', head).eq('status', 'pending')),
    videos: await count(sb.from('videos').select('id', head).eq('status', 'pending')),
    reports: await count(sb.from('reports').select('id', head).eq('status', 'open')),
    appeals: await count(sb.from('appeals').select('id', head).eq('status', 'open')),
  };
  if (!Object.values(n).some(Boolean)) return n;
  const lines = [
    n.petitions && `${n.petitions} new petition${n.petitions > 1 ? 's' : ''} to review`,
    n.videos && `${n.videos} video${n.videos > 1 ? 's' : ''} to review`,
    n.reports && `${n.reports} open report${n.reports > 1 ? 's' : ''}`,
    n.appeals && `${n.appeals} appeal${n.appeals > 1 ? 's' : ''} waiting for a second look`,
  ].filter(Boolean) as string[];
  await sendMail({
    to: process.env.ALERT_EMAIL,
    subject: `UNIER: ${lines[0]}${lines.length > 1 ? ` and ${lines.length - 1} more` : ''}`,
    text: ['Good morning. Waiting for a moderator on UNIER:', '', ...lines.map((l) => `- ${l}`), '', `Open Admin: ${siteUrl()}/admin`, '',
      'Organisers wait for this before their petition goes live. You get this email only on days when something is waiting.'].join('\n'),
  });
  return n;
}
