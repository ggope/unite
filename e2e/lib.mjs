// Helpers for the end-to-end checks: the database, test users and signing a browser in.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import { session } from './mock-supabase.mjs';

export const APP = process.env.E2E_APP || 'http://localhost:3123';
const DB = process.env.DB || 'unite_e2e';

// Runs SQL as the database owner and returns rows as arrays of strings.
export function sql(q) {
  const out = execFileSync('su', ['postgres', '-c', `psql -X -At -F '\t' -v ON_ERROR_STOP=1 -d ${DB}`], { input: q, encoding: 'utf8' });
  return out.split('\n').filter(Boolean).map((l) => l.split('\t'));
}
export const one = (q) => sql(q)[0]?.[0] ?? null;

export function newUser(name, { trigger = true } = {}) {
  const id = crypto.randomUUID(), email = `${name}-${id.slice(0, 6)}@e2e.test`;
  if (!trigger) sql(`set session_replication_role = replica; insert into auth.users (id, email, email_confirmed_at) values ('${id}', '${email}', now());`);
  else sql(`insert into auth.users (id, email, email_confirmed_at) values ('${id}', '${email}', now());`);
  return { id, email };
}

// Puts a signed-in Supabase session cookie in the browser, the way @supabase/ssr stores it.
export async function login(ctx, user) {
  const value = 'base64-' + Buffer.from(JSON.stringify(session(user))).toString('base64url');
  await ctx.addCookies([{ name: 'sb-localhost-auth-token', value, url: APP }]);
}

let failures = 0;
export async function check(name, fn) {
  try { await fn(); console.log(`  ok    ${name}`); }
  catch (e) { failures++; console.log(`  FAIL  ${name}\n        ${String(e.message || e).split('\n').slice(0, 4).join('\n        ')}`); }
}
export const failed = () => failures;
export function expect(cond, msg) { if (!cond) throw new Error(msg); }
