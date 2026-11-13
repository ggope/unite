import { sendPending } from '@/lib/push/send';
import { sendUpdateEmails } from '@/lib/mail/updates';

// Tells followers what happened: phone notifications (0014) and update emails for email signers (0027).
// Each part does nothing when it is not set up. Never throws.
export async function notifyFollowers(limit = 10) {
  const [push, mail] = await Promise.all([
    sendPending(limit).catch((e) => ({ error: String(e?.message ?? e) })),
    sendUpdateEmails().catch((e) => ({ error: String(e?.message ?? e) })),
  ]);
  return { push, mail };
}
