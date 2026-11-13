// A small local stand-in for the Supabase API, for end-to-end tests.
//   /rest/v1/*    → the real PostgREST (so every query, RPC and row level security rule is exercised for real)
//   /auth/v1/*    → just enough of the auth server: who is this token, refresh, sign out, email codes
//   /storage/v1/* → just enough of storage: upload, signed links, list, remove (files kept in a temp folder)
// Tokens are HS256 JWTs signed with E2E_JWT_SECRET, like a Supabase project with a shared secret.
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const SECRET = process.env.E2E_JWT_SECRET || 'e2e-secret-e2e-secret-e2e-secret-123456';
const PORT = Number(process.env.E2E_SUPABASE_PORT || 54321);
const REST = process.env.E2E_POSTGREST || 'http://127.0.0.1:54322';
const FILES = fs.mkdtempSync(path.join(os.tmpdir(), 'unite-e2e-storage-'));
export const otps = [];   // email codes "sent", for tests to read
// The AI check's stand-in for the Claude API (0024): answers by keywords in the content, and keeps what it was sent.
const aiCalls = [];
function moderationReply(body) {
  const text = body.messages.map((m) => (typeof m.content === 'string' ? m.content : m.content.map((c) => c.text ?? '').join(''))).join('\n');
  aiCalls.push(text);
  const r = /WIN FREE CRYPTO/.test(text) ? { verdict: 'breaks_rules', risk: 'high', confidence: 0.99, rules: ['spam', 'scam'], summary: 'Crypto spam.', author_note: 'This looks like spam.' }
    : /hunt them down/i.test(text) ? { verdict: 'breaks_rules', risk: 'urgent', confidence: 0.9, rules: ['threat'], summary: 'A threat against a person.', author_note: 'Threats are not allowed.' }
    : /maybe borderline/i.test(text) ? { verdict: 'unsure', risk: 'medium', confidence: 0.5, rules: ['false_information'], summary: 'Claims need checking.', author_note: 'We could not confirm the facts in this petition.' }
    : { verdict: 'ok', risk: 'low', confidence: 0.95, rules: [], summary: 'An ordinary petition.', author_note: '' };
  return { id: 'msg_e2e', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'text', text: JSON.stringify(r) }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } };
}
// Automatic translations (0026): "[de] " + the original, for every language asked for; kept for tests at /__translate.
const translateCalls = [];
function translateReply(body) {
  const text = body.messages.map((m) => (typeof m.content === 'string' ? m.content : m.content.map((c) => c.text ?? '').join(''))).join('\n');
  translateCalls.push(text);
  const field = (f) => (text.match(new RegExp(`<${f}>\\n([\\s\\S]*?)\\n</${f}>`)) ?? [])[1] ?? '';
  const langs = body.output_config?.format?.schema?.required ?? [];
  const out = Object.fromEntries(langs.map((l) => [l, Object.fromEntries(['title', 'target', 'ask', 'why'].map((f) => [f, field(f) ? `[${l}] ${field(f)}` : '']))]));
  return { id: 'msg_e2e', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'text', text: JSON.stringify(out) }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } };
}
const mails = [];         // UNIER's own emails (SMTP stand-in), read back at GET /__mail

const b64u = (b) => Buffer.from(b).toString('base64url');
export function jwt(claims) {
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64u(JSON.stringify({ iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, ...claims }));
  return `${h}.${p}.${b64u(crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest())}`;
}
function verify(token) {
  const [h, p, s] = String(token || '').split('.');
  if (!s || b64u(crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest()) !== s) return null;
  const c = JSON.parse(Buffer.from(p, 'base64url').toString());
  return c.exp * 1000 > Date.now() ? c : null;
}
const userOf = (c) => ({ id: c.sub, aud: 'authenticated', role: 'authenticated', email: c.email, email_confirmed_at: new Date().toISOString(), app_metadata: { provider: 'email' }, user_metadata: {}, created_at: new Date().toISOString() });
export function session(user) {
  const access_token = jwt({ sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated' });
  return { access_token, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: `r.${user.id}.${user.email}`, user: userOf({ sub: user.id, email: user.email }) };
}

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS', 'access-control-expose-headers': '*' };
const send = (res, code, body, headers = {}) => { res.writeHead(code, { 'content-type': 'application/json', ...CORS, ...headers }); res.end(body === undefined ? '' : JSON.stringify(body)); };
const read = (req) => new Promise((ok) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => ok(Buffer.concat(c))); });
const bearer = (req) => (req.headers.authorization || '').replace(/^Bearer /i, '');

async function proxy(req, res, url) {
  const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await read(req);
  const headers = { ...req.headers }; delete headers.host; delete headers['content-length'];
  const r = await fetch(REST + url.pathname.replace(/^\/rest\/v1/, '') + url.search, { method: req.method, headers, body });
  const out = Buffer.from(await r.arrayBuffer());
  const h = {}; r.headers.forEach((v, k) => { if (!['content-encoding', 'transfer-encoding', 'connection'].includes(k)) h[k] = v; });
  res.writeHead(r.status, h); res.end(out);
}

// A stand-in for the Claude API (ANTHROPIC_BASE_URL points here): every story becomes the same petition draft.
const claudeCalls = [];
async function claude(req, res, url) {
  if (req.method === 'GET') return send(res, 200, claudeCalls);
  const body = JSON.parse((await read(req)).toString() || '{}');
  if (/You translate petitions for UNIER/.test(JSON.stringify(body.system ?? ''))) return send(res, 200, translateReply(body));   // 0026, logged at /__translate
  if (/volunteer moderators of UNIER/.test(JSON.stringify(body.system ?? ''))) return send(res, 200, moderationReply(body));   // the AI check (0024), logged at /__anthropic
  claudeCalls.push(body);
  const draft = { decision: 'draft', reason: 'Two outlets report that the plastics treaty talks stalled.', duplicate_of: '',
    title: 'Agree a strong global plastics treaty', target: 'Governments at the UN plastics talks', region: 'Worldwide',
    ask: 'Agree a binding treaty that cuts plastic production, not only waste, before the end of next year.',
    why: 'According to BBC News, the latest round of talks ended without a deal. The Guardian reports that a small group of countries blocked limits on production. Plastic waste keeps growing every year, and recycling alone cannot keep up.',
    topic: 'oceans', goal: 1000000, note_for_moderator: 'Check which countries blocked the deal before approving.' };
  return send(res, 200, { id: 'msg_e2e', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'text', text: JSON.stringify(draft) }],
    stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 } }, { 'request-id': 'req_e2e' });
}

async function auth(req, res, url) {
  const p = url.pathname.replace(/^\/auth\/v1/, '');
  if (p === '/user' && req.method === 'GET') { const c = verify(bearer(req)); return c ? send(res, 200, userOf(c)) : send(res, 401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' }); }
  if (p === '/token') {
    const b = JSON.parse((await read(req)).toString() || '{}');
    if (url.searchParams.get('grant_type') === 'refresh_token') { const [, id, email] = String(b.refresh_token).split('.'); return id ? send(res, 200, session({ id, email })) : send(res, 400, { error: 'invalid_grant' }); }
    return send(res, 400, { error: 'unsupported_grant_type' });
  }
  if (p === '/logout') return send(res, 204);
  if (p.startsWith('/admin/users/') && req.method === 'DELETE') {                       // auth.admin.deleteUser
    const c = verify(bearer(req)); if (c?.role !== 'service_role') return send(res, 403, { msg: 'service role only' });
    const id = p.split('/').pop(); if (!/^[0-9a-f-]{36}$/.test(id)) return send(res, 400, { msg: 'bad id' });
    execFileSync('su', ['postgres', '-c', `psql -X -q -d ${process.env.DB || 'unite_e2e'} -c "delete from auth.users where id = '${id}'"`]);
    return send(res, 200, {});
  }
  if (p.startsWith('/admin/users/') && req.method === 'GET') {                          // auth.admin.getUserById
    const c = verify(bearer(req)); if (c?.role !== 'service_role') return send(res, 403, { msg: 'service role only' });
    const id = p.split('/').pop(); if (!/^[0-9a-f-]{36}$/.test(id)) return send(res, 400, { msg: 'bad id' });
    const email = execFileSync('su', ['postgres', '-c', `psql -X -At -d ${process.env.DB || 'unite_e2e'} -c "select email from auth.users where id = '${id}'"`], { encoding: 'utf8' }).trim();
    return email ? send(res, 200, { id, email, aud: 'authenticated', role: 'authenticated' }) : send(res, 404, { msg: 'User not found' });
  }
  if (p === '/otp') { const b = JSON.parse((await read(req)).toString() || '{}'); otps.push({ email: b.email, at: Date.now() }); return send(res, 200, {}); }
  if (p === '/.well-known/jwks.json') return send(res, 200, { keys: [] });
  if (p === '/settings') return send(res, 200, { external: { email: true }, disable_signup: false });
  return send(res, 404, { msg: `e2e mock: no ${req.method} ${p}` });
}

async function storage(req, res, url) {
  const p = decodeURIComponent(url.pathname.replace(/^\/storage\/v1/, ''));
  let m;
  if ((m = p.match(/^\/object\/sign\/([^/]+)$/)) && req.method === 'POST') {          // createSignedUrls
    const b = JSON.parse((await read(req)).toString());
    return send(res, 200, (b.paths || []).map((x) => ({ path: x, signedURL: `/object/sign/${m[1]}/${x}?token=e2e`, error: fs.existsSync(path.join(FILES, m[1], x)) ? null : null })));
  }
  if ((m = p.match(/^\/object\/sign\/([^/]+)\/(.+)$/)) && req.method === 'POST') {      // createSignedUrl
    return send(res, 200, { signedURL: `/object/sign/${m[1]}/${m[2]}?token=e2e` });
  }
  if ((m = p.match(/^\/object\/sign\/([^/]+)\/(.+)$/)) && req.method === 'GET') {       // download a signed link
    const f = path.join(FILES, m[1], m[2]);
    if (!fs.existsSync(f)) return send(res, 404, { error: 'not_found' });
    res.writeHead(200, { 'content-type': f.endsWith('.jpg') ? 'image/jpeg' : 'video/mp4', ...CORS }); return fs.createReadStream(f).pipe(res);
  }
  if ((m = p.match(/^\/object\/list\/([^/]+)$/)) && req.method === 'POST') {
    const b = JSON.parse((await read(req)).toString()); const d = path.join(FILES, m[1], b.prefix || '');
    return send(res, 200, fs.existsSync(d) ? fs.readdirSync(d).map((name) => ({ name })) : []);
  }
  if ((m = p.match(/^\/object\/([^/]+)$/)) && req.method === 'DELETE') {
    const b = JSON.parse((await read(req)).toString()); (b.prefixes || []).forEach((x) => fs.rmSync(path.join(FILES, m[1], x), { force: true }));
    return send(res, 200, (b.prefixes || []).map((name) => ({ name })));
  }
  if ((m = p.match(/^\/object\/([^/]+)\/(.+)$/)) && ['POST', 'PUT'].includes(req.method)) {   // upload
    const c = verify(bearer(req)); if (!c) return send(res, 403, { statusCode: '403', error: 'Unauthorized', message: 'no session' });
    if (m[1] === 'videos' && !m[2].startsWith(`${c.sub}/`) && c.role !== 'service_role') return send(res, 403, { statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' });
    const f = path.join(FILES, m[1], m[2]); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, await read(req));
    return send(res, 200, { Key: `${m[1]}/${m[2]}`, Id: crypto.randomUUID() });
  }
  return send(res, 404, { msg: `e2e mock: no ${req.method} ${p}` });
}

export function start() {
  const srv = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (req.method === 'OPTIONS' && !url.pathname.startsWith('/rest/v1')) return send(res, 204);
    try {
      if (url.pathname === '/__mail' && req.method === 'POST') { mails.push(JSON.parse((await read(req)).toString())); return send(res, 200, {}); }
      if (url.pathname === '/__mail') return send(res, 200, mails.filter((m) => !url.searchParams.get('to') || m.to === url.searchParams.get('to')));
      if (url.pathname.startsWith('/__claude')) return await claude(req, res, url);
      if (url.pathname === '/__translate') return send(res, 200, translateCalls);   // what was sent for translation
      if (url.pathname === '/__anthropic') return send(res, 200, aiCalls);   // what the AI check was sent
      if (url.pathname.startsWith('/rest/v1')) return await proxy(req, res, url);
      if (url.pathname.startsWith('/auth/v1')) return await auth(req, res, url);
      if (url.pathname.startsWith('/storage/v1')) return await storage(req, res, url);
      send(res, 404, { msg: 'e2e mock: unknown path' });
    } catch (e) { send(res, 500, { msg: String(e) }); }
  });
  return new Promise((ok) => srv.listen(PORT, () => ok(srv)));
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  await start();
  console.log(`e2e supabase mock on :${PORT} → ${REST}`);
  console.log(`ANON_KEY=${jwt({ role: 'anon', exp: 4e9 })}`);
  console.log(`SERVICE_KEY=${jwt({ role: 'service_role', exp: 4e9 })}`);
}
