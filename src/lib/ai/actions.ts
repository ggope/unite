'use server';
import { after } from 'next/server';
import { aiReady, runAiChecks } from './moderate';

// Called by the browser right after it adds something a moderator must look at (a report, a video).
// The check runs after the answer is sent, so nobody waits for it. Safe to call often: it only looks at
// unchecked items, and the daily limit (AI_DAILY_LIMIT) caps the cost.
export async function nudgeAi() {
  if (!aiReady()) return;
  after(() => runAiChecks({ limit: 3, seconds: 50 }).catch(() => {}));
}
