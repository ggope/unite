import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { makeT, fmtN, type Key, type Lang } from '@/lib/i18n/dict';
import { localize } from '@/lib/petitionText';

// Phone notifications are on when the two VAPID keys are set (see README).
export const pushReady = () => !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);

// Sends what is waiting: each event goes to every device of every follower (signers follow automatically).
export async function sendPending(limit = 10) {
  if (!pushReady()) return { sent: 0, gone: 0, events: 0, off: true };
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? '';   // the push services want an https contact address
  webpush.setVapidDetails(site.startsWith('https://') ? site : 'https://unite-two-plum.vercel.app', process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: events } = await sb.rpc('claim_push_events', { p_limit: limit });
  let sent = 0, gone = 0;
  for (const e of (events ?? []) as any[]) {
    const [{ data: p }, { data: targets }] = await Promise.all([
      sb.from('petitions').select('id, title, target, ask, why, goal, lang, tr').eq('id', e.petition_id).maybeSingle(),
      sb.rpc('push_targets', { p_event: e.id }),
    ]);
    if (!p || !targets?.length) continue;
    const results = await Promise.allSettled((targets as any[]).map((s) => {
      const lang = (s.lang === 'hu' ? 'hu' : 'en') as Lang; const t = makeT(lang);
      const title = localize(p, lang).title;
      const body = e.kind === 'goal' ? t('push.goal', { goal: fmtN(p.goal, lang) }) : `${t(`kind.${e.kind}` as Key)}: ${e.title ?? ''}`;
      return webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title, body, url: `/p/${p.id}`, tag: `p-${p.id}` }), { TTL: 60 * 60 * 24 })
        .then(() => { sent++; })
        .catch(async (err: any) => {
          // the phone unsubscribed or the app was removed: forget the device
          if (err?.statusCode === 404 || err?.statusCode === 410) { gone++; await sb.from('push_subscriptions').delete().eq('endpoint', s.endpoint); }
        });
    }));
    void results;
  }
  return { sent, gone, events: events?.length ?? 0 };
}
