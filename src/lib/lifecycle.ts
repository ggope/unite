// The petition life cycle in one place: end dates, delivery and the days a target stays silent.
// Dates follow UNIER's calendar day (Central European time), like the database (0018_lifecycle.sql).

const DAY = 864e5;
export const unierToday = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Budapest' }).format(now);   // YYYY-MM-DD
const dayNum = (ymd: string) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)) / DAY;
export const addDays = (ymd: string, n: number) => new Date((dayNum(ymd) + n) * DAY).toISOString().slice(0, 10);

// Whole days left to sign, counting today: 0 means today is the last day. null without an end date.
export function daysLeft(endsOn: string | null | undefined, today = unierToday()) {
  if (!endsOn) return null;
  return dayNum(String(endsOn).slice(0, 10)) - dayNum(today);
}
// A live petition whose end date has passed is closed, even before the nightly job marks it.
export const isEnded = (p: { status: string; ends_on?: string | null }) => p.status === 'closed' || (p.status === 'live' && (daysLeft(p.ends_on) ?? 0) < 0);

type Update = { kind: string; created_at: string };
// Silence starts at the first delivery and stops at an official reply or a win (the same rule as the "Who listens" board).
export function silence(updates: Update[] | null | undefined, now = Date.now()) {
  const list = updates ?? [];
  const first = (k: string[]) => list.filter((u) => k.includes(u.kind)).map((u) => u.created_at).sort()[0] ?? null;
  const delivered = first(['delivered']);
  const answered = first(['response', 'win']);
  if (!delivered) return { delivered: null, answered, silentDays: null, answeredAfter: null };
  const days = (a: number, b: number) => Math.max(0, Math.floor((b - a) / DAY));
  return {
    delivered, answered,
    silentDays: answered ? null : days(Date.parse(delivered), now),
    answeredAfter: answered && answered >= delivered ? days(Date.parse(delivered), Date.parse(answered)) : null,
  };
}

// The anchor of a target on the "Who listens" board (grouped the same way as the database does).
export const targetAnchor = (target: string) => 't-' + target.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 80);
