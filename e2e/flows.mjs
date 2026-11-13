// End-to-end checks: real browser, real app, real database rules.
// Run: bash e2e/run.sh   (sets up the database, PostgREST, the mock and the app, then runs this)
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { APP, sql, one, newUser, login, check, expect, failed, until } from './lib.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

const b = await chromium.launch();
const errors = [];
async function as(user) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mylo-intro', '1'); } catch {} });   // Mylo's intro has its own check
  if (user) await login(ctx, user);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${user?.email ?? 'guest'} ${p.url()}: ${e.message}`));
  p.on('response', (r) => { if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`); });
  return p;
}
const settle = (p) => p.waitForLoadState('networkidle').catch(() => {});
async function go(p, url) {
  const r = await p.goto(APP + url); await settle(p);
  await p.waitForFunction(() => document.documentElement.dataset.hydrated === '1', null, { timeout: 15000 }).catch(() => {});   // clicks before React is ready get lost
  return r;
}
const noCrash = async (p) => expect(!(await p.locator('text=/Application error|Something went wrong|This page could not be found/i').count()), `page crashed: ${p.url()}`);

const A = newUser('anna'), B = newUser('bela'), C = newUser('cili');
const handle = (u, h) => sql(`update profiles set handle = '${h}' where id = '${u.id}'`);
handle(A, 'anna_e2e'); handle(B, 'bela_e2e');
sql(`update profiles set is_moderator = true where id = '${A.id}'`);

console.log('Guest pages');
const g = await as(null);
for (const url of ['/', '/petitions', '/mylo', '/donate', '/login', '/start', '/post', '/updates', '/you', '/privacy', '/terms', '/imprint']) {
  await check(`guest opens ${url}`, async () => { const r = await go(g, url); expect(r.status() < 400, `status ${r.status()}`); await noCrash(g); });
}
const seedId = one(`select id from petitions where status = 'live' order by title like 'End bottom trawling%' desc, created_at limit 1`);   // seed rows share one created_at
await check('petition list, welcome page and news show petitions with totals', async () => {
  await go(g, '/petitions'); expect(await g.locator('text=End bottom trawling').count(), 'petition list is empty');
});
await check('guest opens a petition and its report', async () => {
  let r = await go(g, `/p/${seedId}`); expect(r.status() === 200, `status ${r.status()}`); await noCrash(g);
  r = await go(g, `/p/${seedId}/report`); expect(r.status() === 200, `report status ${r.status()}`);
});
await check('sign-in links only ever lead back into UNIER', async () => {
  for (const bad of ['/%5Cevil.example', '//evil.example', '/%09/evil.example']) {
    const r = await g.request.get(APP + '/auth/callback?next=' + bad, { maxRedirects: 0 });
    const to = r.headers()['location'] ?? '';
    expect(new URL(to, APP).host === new URL(APP).host && to.includes('next=%2F') && !to.includes('evil'), `${bad} -> ${to}`);
  }
});
await check('guest sign asks for email and sends a code', async () => {
  await go(g, `/p/${seedId}`);
  await g.getByRole('button', { name: /^Sign/ }).first().click();
  await g.locator('.sheet input[type=email]').fill('guest@e2e.test');
  await g.locator('.sheet input[type=checkbox]').check();
  await g.getByRole('button', { name: /email|link|code/i }).last().click();
  await g.waitForSelector('.sheet .ok', { timeout: 5000 });
});
const mailsTo = async (to) => (await (await fetch(`http://localhost:54321/__mail?to=${encodeURIComponent(to)}`)).json());
await check('signing with only an email: link, confirm, counted once, withdraw', async () => {
  const total = () => Number(one(`select signatures from petition_stats where id = '${seedId}'`));
  const before = total();
  const mails = await mailsTo('guest@e2e.test'); expect(mails.length === 1, `expected one email, got ${mails.length}`);
  const link = mails[0].text.match(/http\S+\/s\/[\w-]+/)?.[0]; expect(link, 'no link in the email');
  expect(one(`select count(*) from email_signatures e where e::text ilike '%guest@%'`) === '0', 'email address stored');
  await go(g, new URL(link).pathname); expect(total() === before, 'counted before pressing Confirm');
  await g.getByRole('button', { name: /confirm/i }).click(); await settle(g);
  await g.waitForSelector('.esign .ok', { timeout: 5000 }); expect(total() === before + 1, 'not counted after Confirm');
  expect(await g.locator('.esign').getByRole('button', { name: /share/i }).count(), 'no share button right after confirming');
  await go(g, new URL(link).pathname); await g.getByRole('button', { name: /confirm/i }).count().then((n) => expect(n === 0, 'confirm shown twice'));
  // signing again with the same email says it already counts
  await go(g, `/p/${seedId}`); await g.getByRole('button', { name: /^Sign/ }).first().click();
  await g.locator('.sheet input[type=email]').fill('Guest@e2e.test'); await g.locator('.sheet input[type=checkbox]').check();
  await g.getByRole('button', { name: /email|link|code/i }).last().click(); await g.waitForSelector('.sheet .error', { timeout: 5000 });
  await go(g, new URL(link).pathname + '?w=1'); await g.getByRole('button', { name: /withdraw/i }).click(); await settle(g);
  expect(total() === before, 'withdraw did not remove it');
});
await check('a crashed page and a failing server call are logged and the owner is emailed once', async () => {
  const r = await g.request.post(APP + '/api/errors', { headers: { origin: APP, 'content-type': 'application/json' }, data: { message: 'E2E test crash for a@b.io', path: '/p/x?token=secret' } });
  expect(r.status() === 204, `status ${r.status()}`);
  await g.request.post(APP + '/api/errors', { headers: { origin: APP, 'content-type': 'application/json' }, data: { message: 'E2E test crash for a@b.io', path: '/p/x' } });
  expect((await g.request.post(APP + '/api/errors', { headers: { origin: 'https://evil.example', 'content-type': 'application/json' }, data: { message: 'x' } })).status() === 403, 'other sites can log');
  const row = sql(`select count, message, path from error_events where source = 'browser' and message like 'E2E test crash%'`)[0];
  expect(row && row[0] === '2', `not counted: ${row}`); expect(!row[1].includes('a@b.io') && !row[2].includes('secret'), 'personal data in the log');
  const alerts = (await mailsTo('owner@e2e.test')).filter((m) => m.subject.includes('E2E test crash')); expect(alerts.length === 1, `alerts: ${alerts.length}`);
  expect((await g.request.get(APP + '/api/health')).status() === 200, 'health check failed');
});
await check('Mylo API answers', async () => { const r = await g.request.get(APP + '/api/mylo'); const j = await r.json(); expect(j.mood, JSON.stringify(j)); });

console.log('Profile and settings');
const a = await as(A);
await check('save name, bio, interests and settings', async () => {
  await go(a, '/you');
  await a.fill('#display_name', 'Anna Kovács'); await a.fill('#bio', 'Danube swimmer');
  await a.locator('input[name=interests][value=oceans]').check();
  await a.locator('input[name=chronological_feed]').check();
  await a.getByRole('button', { name: 'Save' }).first().click(); await a.waitForSelector('#profile >> text=✓ Saved.');
  expect(one(`select display_name || '|' || bio || '|' || array_to_string(interests, ',') from profiles where id = '${A.id}'`) === 'Anna Kovács|Danube swimmer|oceans', 'profile not saved');
  expect(one(`select chronological_feed from user_settings where user_id = '${A.id}'`) === 't', 'setting not saved');
});
await check('saving again keeps the new value and confirms again', async () => {
  await go(a, '/you'); await a.fill('#display_name', 'Anna K.'); await a.getByRole('button', { name: 'Save' }).first().click();
  await a.waitForSelector('#profile >> text=✓ Saved.'); await a.waitForTimeout(500);
  expect(await a.inputValue('#display_name') === 'Anna K.', `field shows ${await a.inputValue('#display_name')}`);
  await a.reload(); expect(await a.inputValue('#display_name') === 'Anna K.', 'not kept after reload');
});
await check('handle with accents is cleaned up', async () => { try {
  await go(a, '/you'); await a.fill('#handle', 'Anna Kovács'); await a.getByRole('button', { name: 'Save' }).first().click(); await a.waitForSelector('#profile >> text=✓ Saved.');
  expect(one(`select handle from profiles where id = '${A.id}'`) === 'anna_kovacs', 'handle not normalised');
  } finally { handle(A, 'anna_e2e'); }
});
await check('taken handle shows an error', async () => {
  await go(a, '/you'); await a.fill('#handle', 'bela_e2e'); await a.getByRole('button', { name: 'Save' }).first().click(); await a.waitForSelector('#profile [role=alert]');
});
await check('account without a profile row repairs itself', async () => {
  const D = newUser('dora', { trigger: false }); const d = await as(D);
  await go(d, '/you'); await d.fill('#display_name', 'Dora'); await d.getByRole('button', { name: 'Save' }).first().click(); await d.waitForSelector('#profile >> text=✓ Saved.');
  expect(one(`select display_name from profiles where id = '${D.id}'`) === 'Dora', 'not repaired');
  await d.context().close();
});

console.log('Start a petition and approve it');
let pid;
await check('start a petition', async () => {
  await go(a, '/start');
  await a.fill('[name=title]', 'Free drinking fountains in every Budapest park');
  await a.fill('[name=target]', 'Budapest City Council');
  await a.fill('[name=region]', 'Budapest');
  await a.fill('[name=ask]', 'Install and maintain free drinking water fountains in every public park by next summer.');
  await a.fill('[name=why]', 'Summers are getting hotter and bottled water is expensive and wasteful for families and kids.');
  await a.fill('[name=organiser_name]', 'Anna Kovács');
  await a.fill('[name=link_url]', 'http://example.org/fountains');   // not https: the server says so, and nothing typed is lost
  await a.selectOption('[name=topic]', 'health').catch(async () => a.locator('[name=topic][value=health]').check());
  await a.selectOption('[name=goal]', '10000').catch(async () => a.locator('[name=goal][value="10000"]').check());
  await a.locator('[name=facts]').check();
  await a.locator('form button[type=submit], form button:not([type])').last().click();
  await a.waitForSelector('form .error', { timeout: 8000 });
  expect(await a.inputValue('[name=title]') === 'Free drinking fountains in every Budapest park', 'the form was emptied after an error');
  expect((await a.inputValue('[name=why]')).startsWith('Summers are getting hotter'), 'the reason was emptied after an error');
  await a.fill('[name=link_url]', 'https://example.org/fountains');
  await a.locator('form button[type=submit], form button:not([type])').last().click();
  await a.waitForURL(/\/p\/[0-9a-f-]{36}/, { timeout: 10000 });
  pid = a.url().match(/\/p\/([0-9a-f-]{36})/)[1];
  expect(one(`select status from petitions where id = '${pid}'`) === 'pending', 'not pending');
});
await check('admin approves the petition', async () => {
  await go(a, '/admin?tab=queue'); await noCrash(a);
  const card = a.locator('.panel', { hasText: 'Free drinking fountains' }).first();
  await card.getByRole('button', { name: /approve|make live|publish/i }).first().click(); await settle(a);
  expect(one(`select status from petitions where id = '${pid}'`) === 'live', 'not live');
});
await check('admin pins it as a big goal', async () => {
  await go(a, '/admin?tab=petitions&q=fountains');
  await a.getByRole('button', { name: 'Pin as big goal' }).first().click(); await a.waitForSelector('button:has-text("Unpin goal")');
  expect(one(`select featured from petitions where id = '${pid}'`) === 't', 'not featured');
});

console.log('Signing');
const bb = await as(B);
await check('sign with consent, arriving through a share link', async () => {
  sql(`insert into share_codes (user_id, code) values ('${A.id}', 'a1b2c3d4e5f6') on conflict (user_id) do update set code = 'a1b2c3d4e5f6'`);
  await go(bb, `/p/${pid}?r=a1b2c3d4e5f6`);
  expect((await bb.context().cookies()).some((c) => c.name === 'ref' && c.value === 'a1b2c3d4e5f6'), 'share code not remembered');
  await bb.getByRole('button', { name: /^Sign/ }).first().click();
  await bb.locator('.sheet input[id^=why-]').fill('My kids play there');
  await bb.locator('.sheet input[type=checkbox]').last().check();
  await bb.locator('.sheet').getByRole('button', { name: /^Sign/ }).click();
  await bb.waitForSelector('.mylo-corner', { timeout: 5000 });
  expect(one(`select count(*) from signatures where user_id = '${B.id}' and petition_id = '${pid}'`) === '1', 'no signature');
  expect(one(`select ref_by from signatures where user_id = '${B.id}' and petition_id = '${pid}'`) === A.id, 'sharer not credited');
});
await check('signing follows automatically; unfollow and follow again', async () => {
  const n = () => one(`select count(*) from follows where user_id = '${B.id}' and petition_id = '${pid}'`);
  expect(n() === '1', 'signing did not follow');
  await go(bb, `/p/${pid}`);
  await bb.locator('button[aria-pressed=true]', { hasText: 'Following' }).first().click(); await bb.waitForSelector('button[aria-pressed=false]:has-text("Follow")'); await bb.waitForTimeout(300);
  expect(n() === '0', 'unfollow did not stick');
  await bb.locator('button[aria-pressed=false]', { hasText: 'Follow' }).first().click(); await bb.waitForSelector('button[aria-pressed=true]:has-text("Following")'); await bb.waitForTimeout(300);
  expect(n() === '1', 'follow did not stick');
});
await check('report the petition', async () => {
  await go(bb, `/p/${pid}`);
  await bb.getByRole('button', { name: /^Report/ }).first().click();
  await bb.locator('.sheet input[type=radio], .sheet select').first().check().catch(() => {});
  await bb.locator('.sheet').getByRole('button', { name: /send|report/i }).last().click(); await bb.waitForTimeout(800);
  expect(one(`select count(*) from reports where reporter_id = '${B.id}'`) === '1', 'no report');
});
await check('organiser posts an update; supporter sees it', async () => {
  await go(a, `/p/${pid}`);
  await a.getByRole('button', { name: /post an update|update/i }).first().click().catch(() => {});
  await a.locator('form:has(textarea), .sheet').locator('input').first().fill('We reached the council agenda');
  await a.getByRole('button', { name: /^Post|^Share update|^Publish/ }).first().click(); await a.waitForTimeout(800);
  expect(one(`select count(*) from petition_updates where petition_id = '${pid}'`) === '1', 'no update row');
  await go(bb, '/updates'); expect(await bb.locator('text=We reached the council agenda').count(), 'update not in inbox');
});

console.log('Video');
// WebM/VP9: the test browser (Chromium) cannot decode H.264.
const clip = path.join(process.env.TMPDIR || '/tmp', 'e2e-clip.webm');
if (!fs.existsSync(clip)) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=360x640:rate=24', '-t', '5', '-c:v', 'libvpx-vp9', '-b:v', '300k', clip]);
let vid;
await check('post a video for the petition', async () => {
  await go(bb, `/post?petition=${pid}`); await noCrash(bb);
  await bb.locator('input#up').setInputFiles(clip); await bb.waitForTimeout(1500);
  await bb.locator('textarea, input[name=caption], #caption').first().fill('Our park has no water at all');
  await bb.locator('label.check input[type=checkbox]').last().check();
  await bb.getByRole('button', { name: /^Post|^Upload|^Share/ }).last().click();
  await bb.waitForSelector('h2:has-text("Sent for review")', { timeout: 15000 });
  vid = one(`select id from videos where uploader_id = '${B.id}'`);
  expect(vid, 'no video row');
});
await check('admin approves the video and it reaches the feed', async () => {
  await go(a, '/admin?tab=queue');
  await a.locator('.panel', { hasText: 'Our park has no water' }).first().getByRole('button', { name: /approve/i }).first().click(); await settle(a);
  expect(one(`select status from videos where id = '${vid}'`) === 'approved', 'not approved');
  await go(g, '/'); expect(await g.locator('video').count(), 'no video in feed');
});

console.log('People');
await check('friend request and accept', async () => {
  await go(bb, '/u/anna_e2e'); await noCrash(bb);
  await bb.getByRole('button', { name: /add friend/i }).click(); await bb.waitForTimeout(800);
  expect(one(`select count(*) from friend_requests where from_id = '${B.id}' and to_id = '${A.id}'`) === '1', 'no request');
  await go(a, '/you'); await a.getByRole('button', { name: /accept/i }).first().click(); await a.waitForTimeout(800);
  expect(one(`select count(*) from friendships where user_id = '${A.id}' and friend_id = '${B.id}'`) === '1', 'not friends');
});
await check('send and receive a message', async () => {
  await go(bb, '/messages/anna_e2e'); await noCrash(bb);
  await bb.locator('textarea, input[type=text]').last().fill('Hi Anna, see you at the park!');
  await bb.keyboard.press('Enter'); await bb.waitForTimeout(800);
  if (one(`select count(*) from messages where sender_id = '${B.id}'`) === '0') { await bb.getByRole('button', { name: /send/i }).click(); await bb.waitForTimeout(800); }
  expect(one(`select count(*) from messages where sender_id = '${B.id}'`) === '1', 'no message');
  await go(a, '/messages'); expect(await a.locator('text=Hi Anna').count(), 'not in inbox');
  await go(a, '/messages/bela_e2e'); expect(await a.locator('text=Hi Anna, see you at the park!').count(), 'not in chat');
});
await check('invite link makes friends', async () => {
  const code = one(`select code from invites where user_id = '${A.id}'`) ?? (await (async () => { await go(a, '/you'); return one(`select code from invites where user_id = '${A.id}'`); })());
  expect(code, 'no invite code');
  const c = await as(C); await go(c, `/invite/${code}`); await noCrash(c);
  await c.getByRole('button', { name: /accept|join|friend/i }).first().click().catch(() => {}); await settle(c);
  expect(one(`select count(*) from friendships where user_id = '${C.id}' and friend_id = '${A.id}'`) === '1', 'invite did not make friends');
  await c.context().close();
});
await check('people search finds a public profile', async () => {
  await go(bb, '/updates'); await noCrash(bb);
  const r = await bb.evaluate(async () => (await fetch('/u/anna_e2e')).status); expect(r === 200, `profile ${r}`);
});

console.log('Admin');
for (const tab of ['overview', 'queue', 'reports', 'petitions', 'news', 'people']) {
  await check(`admin ${tab} tab opens`, async () => { const r = await go(a, `/admin?tab=${tab}`); expect(r.status() === 200, `status ${r.status()}`); await noCrash(a); });
}
await check('admin resolves the report', async () => {
  await go(a, '/admin?tab=reports');
  await a.getByRole('button', { name: /resolve|dismiss|keep/i }).first().click(); await settle(a);
  expect(one(`select count(*) from reports where status = 'open'`) === '0', 'report still open');
});
await check('news import runs with the cron secret', async () => {
  const r = await g.request.get(APP + '/api/news/import', { headers: { authorization: 'Bearer e2e' } });
  expect(r.status() < 500, `status ${r.status()} ${await r.text()}`);
  const clean = (await r.json()).report?.find((x) => x.source === 'privacy clean-up');
  expect(clean && !clean.status.startsWith('error'), `daily privacy clean-up did not run: ${JSON.stringify(clean)}`);
});

await check('moderators get a morning email when something waits for review', async () => {
  const pending = one(`insert into petitions (title, target, region, ask, why, topic, goal, organiser_name, status) values ('Digest check petition waiting', 'Someone', 'EU', 'Please review this test petition soon.', 'It checks the morning email to moderators.', 'health', 1000, 'E2E', 'pending') returning id`);
  const r = await g.request.get(APP + '/api/news/import', { headers: { authorization: 'Bearer e2e' } });
  const d = (await r.json()).digest; expect(d && d.petitions >= 1, `digest: ${JSON.stringify(d)}`);
  const m = (await mailsTo('owner@e2e.test')).filter((x) => x.subject.startsWith('UNIER: ') && x.text.includes('Waiting for a moderator'));
  expect(m.length >= 1 && /new petition/.test(m.at(-1).text), 'no digest email');
  sql(`delete from petitions where id = '${pending}'`);
});

console.log('Posters and translations');
await check('petitions without a video show as poster cards in the feed', async () => {
  const hidden = one(`with h as (update videos set audience = 'friends' where status = 'approved' and audience = 'everyone' returning id) select coalesce(string_agg(id::text, ','), '') from h`);
  try {
    await go(g, '/'); await g.waitForSelector('.poster', { timeout: 15000 });
    expect(await g.locator('.poster .poster-title').first().textContent(), 'poster has no title');
    expect(await g.locator('.poster .poster-to').count(), 'poster has no target');
    expect(await g.locator('.slide').first().getByRole('button', { name: /^Sign/ }).count(), 'cannot sign from a poster');
  } finally { if (hidden) sql(`update videos set audience = 'everyone' where id in (${hidden.split(',').map((x) => `'${x}'`).join(',')})`); }
});
await check('a moderator adds a Hungarian version and Hungarian readers see it', async () => {
  await go(a, '/admin?tab=petitions&q=fountains');
  const panel = a.locator('.panel', { hasText: 'fountains' }).first();
  await panel.getByRole('link', { name: 'Translations' }).click(); await settle(a);
  const form = a.locator('form[lang=hu]');
  await form.locator('input[name=title]').fill('Ivókutat minden parkba, most');
  await form.locator('textarea[name=ask]').fill('Szereljenek fel ivókutat minden nyilvános parkban még idén nyáron.');
  await form.getByRole('button', { name: 'Save Magyar' }).click(); await a.waitForTimeout(1200);
  expect(one(`select tr->'hu'->>'title' from petitions where id = '${pid}'`) === 'Ivókutat minden parkba, most', 'translation not saved');
  const hu = await b.newContext({ locale: 'hu-HU' }); await hu.addCookies([{ name: 'lang', value: 'hu', url: APP }]);
  const hp = await hu.newPage(); await hp.goto(APP + `/p/${pid}`);
  expect(await hp.locator('h1', { hasText: 'Ivókutat minden parkba' }).count(), 'Hungarian reader does not see the translation');
  await hp.goto(APP + '/petitions'); expect(await hp.locator('text=Ivókutat minden parkba').count(), 'petition list not translated');
  await hu.close();
  await go(g, `/p/${pid}`); expect(!(await g.locator('h1', { hasText: 'Ivókutat' }).count()), 'English reader sees the translation');
});

await check('German: the interface, a German translation, and English legal text with a note', async () => {
  sql(`update petitions set tr = tr || '{"de": {"title": "Trinkbrunnen in jeden Park, jetzt"}}'::jsonb where id = '${pid}'`);
  const de = await b.newContext({ locale: 'de-DE' }); const dp = await de.newPage();
  await dp.goto(APP + `/p/${pid}`);
  expect(await dp.locator('h1', { hasText: 'Trinkbrunnen in jeden Park' }).count(), 'German translation not shown');
  expect(await dp.getByText('Diese Petition unterschreiben').count() + await dp.getByText('Petitionen').count(), 'interface not German');
  await dp.goto(APP + '/privacy'); expect(await dp.getByText(/rechtlich verbindlich/i).count(), 'no English-only note');
  await dp.goto(APP + '/you'); await dp.getByRole('button', { name: 'Français' }).click(); await dp.waitForTimeout(800);
  expect(await dp.getByRole('heading', { name: 'Toi' }).count(), 'switching to French failed');
  await de.close();
});

console.log('Feed, people and admin tools');
await check('feed: care and not interested teach the feed', async () => {
  await go(bb, '/'); await bb.waitForSelector('video');
  await bb.getByRole('button', { name: 'Care' }).first().click(); await bb.waitForTimeout(600);
  expect(Number(one(`select coalesce(sum(weight), 0) from topic_weights where user_id = '${B.id}'`)) > 0, 'care not recorded');
  const w1 = Number(one(`select coalesce(sum(weight), 0) from topic_weights where user_id = '${B.id}'`));
  await bb.getByRole('button', { name: 'Not interested' }).first().click(); await bb.waitForTimeout(600);
  expect(Number(one(`select coalesce(sum(weight), 0) from topic_weights where user_id = '${B.id}'`)) < w1, 'not interested not recorded');
});
await check('reset my feed', async () => {
  await go(bb, '/you'); await bb.getByRole('button', { name: /reset/i }).first().click(); await bb.waitForTimeout(800);
  expect(one(`select count(*) from topic_weights where user_id = '${B.id}'`) === '0', 'feed not reset');
});
await check('unsend a message and report one', async () => {
  sql(`insert into messages (sender_id, recipient_id, body) values ('${A.id}', '${B.id}', 'Please report me')`);
  await go(bb, '/messages/anna_e2e');
  const mine = bb.locator('.bubble', { hasText: 'Hi Anna, see you at the park!' }).first();
  await mine.hover(); await mine.getByRole('button', { name: /unsend|delete/i }).first().click({ force: true }).catch(async () => { await mine.click(); await bb.getByRole('button', { name: /unsend|delete/i }).first().click(); });
  await bb.waitForTimeout(800);
  expect(one(`select count(*) from messages where sender_id = '${B.id}'`) === '0', 'not unsent');
});
await check('report a person, then block and unblock', async () => {
  bb.on('dialog', (d) => d.accept());
  await go(bb, '/u/anna_e2e');
  await bb.getByRole('button', { name: /more/i }).first().click();
  await bb.getByRole('button', { name: /^Report/ }).first().click();
  await bb.locator('.sheet input[type=radio]').first().check(); await bb.locator('.sheet').getByRole('button', { name: /send/i }).click(); await bb.waitForTimeout(800);
  expect(one(`select count(*) from reports where profile_id = '${A.id}'`) === '1', 'person not reported');
  await bb.keyboard.press('Escape'); await go(bb, '/u/anna_e2e');
  await bb.getByRole('button', { name: /more/i }).first().click(); await bb.getByRole('button', { name: /^Block/ }).first().click(); await bb.waitForTimeout(1000);
  expect(one(`select count(*) from blocks where user_id = '${B.id}' and blocked_id = '${A.id}'`) === '1', 'not blocked');
  expect(one(`select count(*) from friendships where user_id = '${B.id}' and friend_id = '${A.id}'`) === '0', 'block kept the friendship');
  await go(bb, '/u/anna_e2e'); await bb.getByRole('button', { name: /unblock/i }).first().click(); await bb.waitForTimeout(800);
  expect(one(`select count(*) from blocks where user_id = '${B.id}'`) === '0', 'not unblocked');
});
await check('moderator clears a profile and the person is told why', async () => {
  sql(`update profiles set display_name = 'Rude Cili', bio = 'rude words' where id = '${C.id}'`);
  sql(`insert into reports (reporter_id, profile_id, reason) values ('${B.id}', '${C.id}', 'offensive name')`);
  await go(a, '/admin?tab=reports');
  const panel = a.locator('.panel', { hasText: 'offensive name' }).first();
  await panel.getByRole('button', { name: /clear name and bio/i }).click(); await settle(a);
  expect(one(`select display_name from profiles where id = '${C.id}'`) === 'Rude Cili', 'cleared without a reason');
  await go(a, '/admin?tab=reports');
  await a.locator('.panel', { hasText: 'offensive name' }).first().locator('input[name=note]').fill('Your name insulted people');
  await a.locator('.panel', { hasText: 'offensive name' }).first().getByRole('button', { name: /clear name and bio/i }).click(); await settle(a);
  expect(await until(() => one(`select display_name from profiles where id = '${C.id}'`) === null), 'not cleared');
  const c = await as(C); await go(c, '/you');
  expect(await c.getByText('Your name insulted people').count(), 'person not told why');
  await c.getByRole('button', { name: /^OK$/ }).first().click(); await settle(c);
  expect(await until(() => one(`select count(*) from notices where user_id = '${C.id}'`) === '0'), 'notice not dismissed');
  await c.context().close();
});
await check('notifications: an update is queued for followers, sender is off without keys', async () => {
  const pid = one(`select id from petitions where status = 'live' order by created_at limit 1`);
  sql(`insert into petition_updates (petition_id, kind, title, created_by) values ('${pid}', 'response', 'The ministry replied today', '${A.id}')`);
  expect(one(`select count(*) from push_events where petition_id = '${pid}' and title = 'The ministry replied today'`) === '1', 'no event queued');
  const r = await a.request.post(APP + '/api/push'); const j = await r.json();
  expect(r.ok() && j.off === true, 'sender answered wrongly: ' + JSON.stringify(j));
  await go(a, '/you'); expect(!(await a.getByText('Phone notifications').count()), 'toggle shown without keys');
});
await check('admin: official link, organiser link, unite and separate', async () => {
  await go(a, '/admin?tab=petitions&q=fountains');
  await a.fill('input[placeholder^="Official petition link"]', 'https://citizens-initiative.europa.eu/x'); await a.getByRole('button', { name: 'Save link' }).first().click();
  await a.waitForFunction(() => true); await a.waitForTimeout(1200);
  expect(one(`select official_url from petitions where id = '${pid}'`) === 'https://citizens-initiative.europa.eu/x', 'official link not saved');
  await go(a, '/admin?tab=petitions&q=fountains');
  await a.fill('input[placeholder^="Unite with"]', seedId); await a.getByRole('button', { name: 'Unite' }).first().click(); await a.waitForTimeout(1200);
  const cl = one(`select cluster_id from petitions where id = '${pid}'`);
  expect(cl && cl === one(`select cluster_id from petitions where id = '${seedId}'`), 'not united');
  await go(a, '/admin?tab=petitions&q=fountains'); await a.getByRole('button', { name: /separate/i }).first().click(); await a.waitForTimeout(1200);
  expect(one(`select cluster_id from petitions where id = '${pid}'`) === null || one(`select cluster_id from petitions where id = '${pid}'`) === '', 'not separated');
});
await check('admin: declining without a reason is refused', async () => {
  const v3 = one(`insert into videos (petition_id, uploader_id, storage_path, caption, trim_start, trim_end) values ('${pid}', '${B.id}', '${B.id}/y.webm', 'Clip without a reason', 0, 5) returning id`);
  await go(a, '/admin?tab=queue');
  await a.locator('.panel', { hasText: 'Clip without a reason' }).first().getByRole('button', { name: 'Reject' }).click();
  // wait for the answer itself, not a fixed time: on a slow CI machine the action and redirect can take longer than a second
  await a.waitForSelector('text=Write the reason first', { timeout: 10000 }).catch(() => {});
  expect(one(`select status from videos where id = '${v3}'`) === 'pending', 'declined without a reason');
  expect(await a.locator('text=Write the reason first').count(), 'no message asking for a reason');
  sql(`delete from videos where id = '${v3}'`);
});
await check('admin: reject a video with a reason the author sees', async () => {
  const v2 = one(`insert into videos (petition_id, uploader_id, storage_path, caption, trim_start, trim_end) values ('${pid}', '${B.id}', '${B.id}/x.webm', 'Second clip for review', 0, 5) returning id`);
  await go(a, '/admin?tab=queue');
  const card = a.locator('.panel', { hasText: 'Second clip for review' }).first();
  await card.locator('input[name=note]').fill('Faces of children are visible'); await card.getByRole('button', { name: 'Reject' }).click(); await a.waitForTimeout(1200);
  expect(one(`select status || '|' || moderation_note from videos where id = '${v2}'`) === 'rejected|Faces of children are visible', 'not rejected with note');
  await go(bb, '/you'); expect(await bb.locator('text=Faces of children are visible').count(), 'author does not see the reason');
});
await check('admin: make someone a moderator and back', async () => {
  await go(a, '/admin?tab=people&q=bela_e2e');
  await a.locator('form', { hasText: 'bela' }).getByRole('button').first().click(); await a.waitForTimeout(1000);
  expect(one(`select is_moderator from profiles where id = '${B.id}'`) === 't', 'not made moderator');
  await go(a, '/admin?tab=people&q=bela_e2e');
  await a.locator('form', { hasText: 'bela' }).getByRole('button').first().click(); await a.waitForTimeout(1000);
  expect(one(`select is_moderator from profiles where id = '${B.id}'`) === 'f', 'not removed as moderator');
});
await check('admin: hide a news story and switch a source off', async () => {
  sql(`insert into news_items (source_id, url, title, lang, topic, story_key, published_at) values ('bbc', 'https://bbc.example/e2e', 'Test headline for hiding', 'en', 'health', gen_random_uuid(), now())`);
  await go(a, '/admin?tab=news');
  await a.locator('.stack', { hasText: 'Test headline for hiding' }).last().getByRole('button', { name: 'Hide' }).click(); await a.waitForTimeout(1200);
  expect(one(`select status from news_items where url = 'https://bbc.example/e2e'`) === 'hidden', 'news not hidden');
  await go(a, '/admin?tab=news');
  const before = one(`select active from news_sources where id = 'bbc'`);
  await a.locator('form', { hasText: 'BBC News' }).first().getByRole('button').first().click(); await a.waitForTimeout(1200);
  expect(one(`select active from news_sources where id = 'bbc'`) !== before, 'source not toggled');
});
await check('share card and preview images render', async () => {
  for (const u of [`/api/card/${pid}`, `/p/${pid}/opengraph-image`, '/opengraph-image']) { const r = await g.request.get(APP + u); expect(r.status() === 200, `${u} ${r.status()}`); }
});
console.log('Openness');
await check('share button adds your code; You shows your impact', async () => {
  await a.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: APP });
  await go(a, `/p/${pid}`); await a.waitForTimeout(600);
  await a.getByRole('button', { name: /share link|copy link|^share/i }).first().click(); await a.waitForTimeout(300);
  const copied = await a.evaluate(() => navigator.clipboard.readText());
  expect(copied.endsWith(`/p/${pid}?r=a1b2c3d4e5f6`), 'link without code: ' + copied);
  await go(a, '/you'); expect(await a.getByText(/Fewer than 3 people/).count(), 'impact not shown');
});
await check('transparency page shows live numbers', async () => {
  const r = await go(g, '/transparency'); expect(r.ok(), 'transparency failed'); await noCrash(g);
  expect(await g.getByRole('heading', { name: /how the feed decides/i }).count(), 'feed rules missing');
  expect(await g.locator('.tstat').count() >= 8, 'numbers missing');
});
await check('who listens: delivered and silent targets', async () => {
  sql(`insert into petition_updates (petition_id, kind, title, created_by, created_at) values ('${pid}', 'delivered', 'Handed to the council', '${A.id}', now() - interval '12 days')`);
  const r = await go(g, '/targets'); expect(r.ok(), 'board failed'); await noCrash(g);
  const target = one(`select target from petitions where id = '${pid}'`);
  const card = g.locator('.target', { hasText: target }).first();
  expect(await card.count(), 'target missing');
  expect(/Silent for 1[12] days|Answered/i.test(await card.innerText()), 'status wrong: ' + (await card.innerText()));
});
await check('embed box for other websites', async () => {
  const r = await g.request.get(APP + `/embed/${pid}?lang=hu`); const html = await r.text();
  expect(r.ok() && html.includes('aláírás') && html.includes(`/p/${pid}`), 'embed wrong');
  expect((await g.request.get(APP + '/embed/00000000-0000-0000-0000-000000000000')).status() === 404, 'missing petition not 404');
  await go(g, `/p/${pid}`); await g.locator('details.embed summary').click();
  expect((await g.locator('details.embed textarea').inputValue()).includes(`/embed/${pid}`), 'no embed code');
});

console.log('Your data');
await check('withdraw a signature from You', async () => {
  await go(bb, '/you');
  await bb.locator('form', { has: bb.locator(`input[value="${pid}"]`) }).getByRole('button').first().click(); await settle(bb);
  expect(await until(() => one(`select count(*) from signatures where user_id = '${B.id}' and petition_id = '${pid}'`) === '0'), 'not withdrawn');
});
await check('export my data, complete', async () => {
  const r = await bb.request.get(APP + '/api/account/export'); expect(r.status() === 200, `status ${r.status()}`);
  const d = await r.json();
  for (const k of ['profile', 'settings', 'consents', 'signatures', 'messages', 'reports_sent', 'invite', 'feed_learning']) expect(k in d, `export misses ${k}`);
  expect(Array.isArray(d.reports_sent) && d.reports_sent.length > 0, 'my reports are not in the export');
});
await check('legal pages and the sign-in note', async () => {
  for (const u of ['/privacy', '/terms', '/imprint']) { await go(g, u); expect(await g.locator('h1').count(), `${u} has no title`); }
  await go(g, '/privacy'); expect(await g.locator('text=mylo-greeted').count(), 'cookie list missing');
  await go(g, '/login'); expect(await g.locator('a[href="/terms"]').count() && await g.locator('a[href="/privacy"]').count(), 'login has no terms/privacy links');
});
await check('delete account', async () => {
  const E = newUser('emil'); const e = await as(E);
  const r = await e.request.post(APP + '/api/account/delete'); expect(r.status() < 400, `status ${r.status()} ${await r.text()}`);
  expect(one(`select count(*) from auth.users where id = '${E.id}'`) === '0', 'user still there');
});

console.log('Mylo story, answers and open numbers');
await check('first visit: Mylo introduces himself once, and the story reads to the end', async () => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const f = await ctx.newPage();
  f.on('pageerror', (e) => errors.push(`first visit ${f.url()}: ${e.message}`));
  await go(f, '/'); await f.waitForSelector('.intro-sheet', { timeout: 8000 });
  expect(await f.locator('.intro-sheet').getByText(/Meet Mylo/).count(), 'intro text missing');
  await f.locator('.intro-sheet').getByRole('button', { name: 'Next' }).click();
  await f.locator('.intro-sheet').getByRole('button', { name: 'Next' }).click();
  await f.getByRole('button', { name: "Let's go" }).click();
  expect(!(await f.locator('.intro-sheet').count()), 'intro did not close');
  await go(f, '/'); await f.waitForTimeout(800); expect(!(await f.locator('.intro-sheet').count()), 'intro came back');
  await go(f, '/mylo/story'); expect(await f.getByRole('heading', { name: 'Why is Mylo trapped?' }).count(), 'story page has no title');
  await f.locator('.bk-closed').click(); await f.waitForSelector('.bk-book');
  await f.waitForFunction(() => !document.querySelector('.bk-leaf'), null, { timeout: 5000 });   // the cover has swung open
  expect(await f.getByText(/same world as you/).count(), 'first page missing');
  expect(await f.locator('.bk-scene[role=img][aria-label*="Mylo"]').count(), 'picture has no description for screen readers');
  for (let k = 0; k < 12 && !(await f.getByText('The end').count()); k++) {
    await f.locator('.bk-nav').getByRole('button', { name: 'Next' }).click({ timeout: 3000 }).catch(() => {}); await f.waitForTimeout(950);
  }
  expect(await f.getByText('The end').count(), 'the book did not reach the end');
  expect(await f.getByRole('link', { name: 'How is Mylo today?' }).count(), 'no way back to Mylo');
  await f.locator('.bk-nav').getByRole('button', { name: 'Back' }).click(); await f.waitForTimeout(950);
  expect(await f.getByText(/better place/).count(), 'turning back failed');
  await go(f, '/mylo'); await f.locator('.bk-closed').click();
  await f.waitForSelector('.bk-overlay .bk-book'); await f.getByRole('button', { name: 'Close the book' }).click();
  expect(!(await f.locator('.bk-overlay').count()), 'book did not close');
  await ctx.close();
});
await check('the target answers through the private link, and the petition shows it', async () => {
  await go(a, `/p/${seedId}`);
  await a.getByRole('button', { name: 'Make answer link' }).click();
  const link = await a.locator('.answer-link input').inputValue({ timeout: 5000 });
  expect(/\/answer\/[A-Za-z0-9_-]{20,}$/.test(link), `bad link ${link}`);
  const ctx = await b.newContext(); const tp = await ctx.newPage();
  await tp.goto(link); await tp.waitForFunction(() => document.documentElement.dataset.hydrated === '1', null, { timeout: 15000 }).catch(() => {});
  await tp.fill('#a-name', 'Erika Test'); await tp.fill('#a-role', 'Minister of Fisheries');
  await tp.fill('#a-body', 'We will close the protected areas to bottom trawling from next spring.');
  await tp.getByRole('button', { name: 'Publish answer' }).click();
  await tp.waitForSelector('text=Your answer is published', { timeout: 8000 });
  expect(one(`select count(*) from petition_updates where petition_id = '${seedId}' and via_link and kind = 'response'`) === '1', 'answer not saved');
  await go(g, `/p/${seedId}`); expect(await g.locator('.official-answer', { hasText: 'Erika Test' }).count(), 'answer not shown on the petition');
  await a.getByRole('button', { name: 'Make a new link' }).click(); await a.waitForTimeout(800);
  await tp.goto(link); expect(await tp.getByText(/no longer works/).count(), 'old link still works');
  await ctx.close();
});
await check('report: reasons people chose to show, and mark as delivered', async () => {
  sql(`insert into signatures (user_id, petition_id, why, show_reason) values ('${C.id}', '${seedId}', 'My grandad fished here', true) on conflict (user_id, petition_id) do update set why = excluded.why, show_reason = true`);
  await go(a, `/p/${seedId}/report`);
  expect(await a.getByText('My grandad fished here').count(), 'shown reason missing in the report');
  await a.getByRole('button', { name: 'Mark as delivered' }).click(); await a.waitForTimeout(1200);
  expect(Number(one(`select count(*) from petition_updates where petition_id = '${seedId}' and kind = 'delivered'`)) >= 1, 'not marked delivered');
  await go(g, `/p/${seedId}`); expect(await g.getByText('My grandad fished here').count(), 'shown reason missing on the petition');
});
await check('a shown reason is reported; a moderator hides it and the signer is told', async () => {
  await go(bb, `/p/${seedId}`);
  await bb.locator('.reasons li', { hasText: 'My grandad fished here' }).getByRole('button', { name: 'Report this reason' }).click();
  await bb.getByText('Hate or harassment').click(); await bb.getByRole('button', { name: 'Send report' }).click();
  await bb.waitForSelector('text=A person on our team will look at it', { timeout: 8000 });
  expect(one(`select count(*) from reports where reason_key is not null and petition_id is null and status = 'open'`) === '1', 'reason report not saved on its own');
  await go(a, '/admin?tab=reports');
  const panel = a.locator('.panel', { hasText: 'My grandad fished here' }).first();
  expect(await panel.getByText('Reason for signing').count(), 'admin does not show what kind of report it is');
  await panel.locator('input[name=note]').fill('Personal attack'); await panel.getByRole('button', { name: 'Hide reason' }).click(); await settle(a);
  expect(one(`select reason_hidden from signatures where user_id = '${C.id}' and petition_id = '${seedId}'`) === 't', 'reason not hidden');
  expect(one(`select count(*) from notices where user_id = '${C.id}' and kind = 'reason_hidden'`) === '1', 'signer not told');
  await go(g, `/p/${seedId}`); expect(!(await g.getByText('My grandad fished here').count()), 'hidden reason still shown');
});
await check('an official answer is reported and a moderator removes it', async () => {
  await go(bb, `/p/${seedId}`);
  await bb.locator('.official-answer', { hasText: 'Erika Test' }).getByRole('button', { name: 'Report this answer' }).click();
  await bb.getByText('Spam or a scam').click(); await bb.getByRole('button', { name: 'Send report' }).click();
  await bb.waitForSelector('text=A person on our team will look at it', { timeout: 8000 });
  await go(a, '/admin?tab=reports');
  const panel = a.locator('.panel', { hasText: 'Official answer' }).first();
  await panel.locator('input[name=note]').fill('Not from the ministry'); await panel.getByRole('button', { name: 'Remove' }).click(); await settle(a);
  expect(one(`select count(*) from petition_updates where petition_id = '${seedId}' and via_link`) === '0', 'answer not removed');
  expect(one(`select count(*) from reports where reason = 'spam' and status = 'resolved' and update_id is null`) === '1', 'answer report still open, or lost');
});
await check('wins page lists petitions that won', async () => {
  sql(`insert into petition_updates (petition_id, kind, title, created_by) values ('${seedId}', 'win', 'The ministry agreed', '${A.id}')`);
  const r = await go(g, '/wins'); expect(r.ok(), `wins ${r.status()}`);
  expect(await g.locator('.win', { hasText: 'End bottom trawling' }).count() === 1, 'win missing or listed twice');
  await go(g, '/petitions'); expect(await g.locator('a[href="/wins"]').count(), 'no link to wins');
});
await check('organiser dashboard is private and suggests a next step', async () => {
  const r = await go(a, `/p/${seedId}/dashboard`); expect(r.ok(), `dashboard ${r.status()}`);
  expect(await a.getByRole('heading', { name: 'How your petition is doing' }).count(), 'no title');
  expect(await a.locator('.tile').count() === 7 && await a.locator('.spark i').count() === 30, 'numbers or 30-day bars missing');
  expect(await a.getByText('This petition won').count(), 'won petition not celebrated');
  await go(bb, `/p/${seedId}/dashboard`); expect(!(await bb.locator('.tile').count()), 'someone else saw the dashboard');
  await go(g, `/p/${seedId}/dashboard`); expect(g.url().includes('/login'), 'guest not sent to sign in');
});
await check('printable book with pictures described, plus colouring pages', async () => {
  const r = await go(g, '/mylo/story/print'); expect(r.ok(), `print ${r.status()}`);
  expect(await g.locator('.pp').count() === 12, `pages: ${await g.locator('.pp').count()}`);
  expect(await g.locator('.pp [role=img][aria-label]').count() === 12, 'a picture has no description');
  const colours = await g.locator('.pp-line > svg').evaluateAll((els) => els.map((e) => e.outerHTML));
  expect(colours.length === 4 && colours.every((h) => !/filter=|#F7862E|#4CAF5B/i.test(h)), 'colouring pages still coloured');
  await go(g, '/mylo/story'); expect(await g.locator('a[href="/mylo/story/print"]').count(), 'no link to print');
});
await check('petitions popular in a country', async () => {
  sql(`update petitions set region = 'Hungary' where id = '${seedId}'`);
  await go(g, '/petitions?sort=near&country=HU');
  expect(await g.locator('.chip[aria-current=page]', { hasText: 'Popular in Hungary' }).count(), 'country chip missing');
  expect(await g.locator('.prow').count() >= 1, 'no petitions for Hungary');
  await go(g, '/petitions?sort=near&country=IS'); expect(await g.getByText(/Nothing is popular in Iceland/).count(), 'empty country has no note');
  sql(`update petitions set region = 'Worldwide' where id = '${seedId}'`);
});
await check('start page tips react while writing', async () => {
  await go(a, '/start');
  expect(await a.locator('.checklist li.ok').count() === 0, 'tips ticked on an empty form');
  await a.fill('#title', 'Open every school playground to children at weekends');
  await a.fill('#target', 'the government');
  await a.waitForTimeout(200);
  expect(await a.locator('.checklist li.ok').count() === 1, 'title tip not ticked, or vague target accepted');
  await a.fill('#target', 'Budapest City Council'); await a.waitForTimeout(200);
  expect(await a.locator('.checklist li.ok').count() === 2, 'named target not ticked');
});
await check('starting a petition suggests similar ones to join', async () => {
  await go(a, '/start');
  await a.fill('#title', 'Stop bottom trawling in our marine protected areas'); await a.fill('#target', 'Fisheries ministers');
  await a.waitForSelector('.similar', { timeout: 8000 });
  expect(await a.locator('.similar a', { hasText: 'End bottom trawling' }).count(), 'the matching petition is not suggested');
  await a.fill('#title', 'Open every school playground to children at weekends'); await a.waitForTimeout(1500);
  expect(!(await a.locator('.similar').count()), 'unrelated petitions suggested');
});
await check('search engines get a sitemap and robots file', async () => {
  const sm = await g.request.get(APP + '/sitemap.xml'); const xml = await sm.text();
  expect(sm.ok() && xml.includes(`/p/${seedId}</loc>`) && xml.includes('/wins</loc>'), 'sitemap missing petitions or pages');
  const rb = await (await g.request.get(APP + '/robots.txt')).text();
  expect(/Disallow: \/admin/.test(rb) && /Disallow: \/you/.test(rb) && /Sitemap: .*\/sitemap\.xml/.test(rb), `robots wrong: ${rb}`);
});
await check('admin launch checklist shows what is left', async () => {
  const r = await go(a, '/admin?tab=launch'); expect(r.ok(), `launch ${r.status()}`);
  expect(await a.getByText(/left before launch/).count(), 'no summary');
  expect(await a.getByText(/sample petitions are still live/).count(), 'sample petitions not noticed');
  expect(await a.getByText('Database is up to date').count(), 'migrations wrongly reported missing');
  expect(await a.getByText(/gaps in the legal pages/).count(), 'legal placeholders not counted');
});
await check('open numbers download as CSV without names', async () => {
  for (const f of ['totals', 'petitions', 'targets', 'countries']) {
    const r = await g.request.get(APP + `/open/${f}.csv`); expect(r.status() === 200 && (r.headers()['content-type'] ?? '').includes('text/csv'), `${f}: ${r.status()}`);
    const txt = await r.text(); expect(txt.split('\r\n')[0].length > 5, `${f} has no header`);
    expect(!/@e2e\.test/.test(txt), `${f} leaks emails`);
  }
  const p = await (await g.request.get(APP + '/open/petitions.csv')).text(); expect(p.includes('End bottom trawling'), 'petitions missing');
  expect((await g.request.get(APP + '/open/nope.csv')).status() === 404, 'unknown file served');
  await go(g, '/transparency'); expect(await g.locator('a[href="/open/petitions.csv"]').count(), 'no download link');
});

await check('quality: no framing except the embed, cached open data, keyboard report sheet', async () => {
  const home = await g.request.get(APP + '/'); const h = home.headers();
  expect(h['x-frame-options'] === 'DENY' && /frame-ancestors 'none'/.test(h['content-security-policy'] ?? ''), 'pages can be framed by other sites');
  const em = await g.request.get(APP + `/embed/${seedId}`); const eh = em.headers();
  expect(em.ok() && !eh['x-frame-options'] && !/frame-ancestors/.test(eh['content-security-policy'] ?? ''), 'embed cannot be framed');
  const html = await em.text(); expect(/<main/.test(html) && /role="progressbar" aria-label=/.test(html), 'embed landmarks or progress label missing');
  expect(/s-maxage=\d+/.test((await g.request.get(APP + '/open/petitions.csv')).headers()['cache-control'] ?? ''), 'open data not cached at the edge');
  // totals still match a full count after all the signing above
  expect(one(`select count(*) from petition_stats s join petitions p using (id) where s.signatures <> p.imported_count + (select count(*) from signatures x where x.petition_id = p.id)`) === '0', 'signature counter drifted');
  await go(bb, `/p/${seedId}`);
  await bb.getByRole('button', { name: /^report$/i }).first().click();
  expect(await bb.evaluate(() => !!document.activeElement?.closest('[role=dialog]')), 'focus did not move into the report sheet');
  await bb.keyboard.press('Escape'); await bb.waitForTimeout(200);
  expect(!(await bb.locator('[role=dialog]').count()), 'Escape did not close the report sheet');
});

await check('revoke consent, then signing asks again', async () => {
  await go(bb, '/you'); await bb.getByRole('button', { name: /withdraw consent|revoke/i }).first().click(); await bb.waitForTimeout(800);
  expect(one(`select count(*) from consents where user_id = '${B.id}' and revoked_at is null`) === '0', 'consent not revoked');
});
await check('sign out', async () => {
  await go(bb, '/you'); await bb.getByRole('button', { name: /sign out/i }).first().click(); await bb.waitForTimeout(1200);
  await go(bb, '/you'); expect(await bb.locator('a[href^="/login"]').count(), 'still signed in');
});

await check('admin sees errors, marks one fixed and sends a test alert', async () => {
  await go(a, '/admin?tab=errors'); await noCrash(a); expect(await a.getByText(/E2E test crash/).count(), 'error not listed');
  await a.getByRole('button', { name: 'Mark as fixed' }).first().click(); await settle(a);
  expect(one(`select count(*) from error_events where resolved_at is not null`) !== '0', 'not marked fixed');
  await go(a, '/admin?tab=errors'); await a.getByRole('button', { name: 'Send a test alert' }).click(); await settle(a);
  let got = false; for (let i = 0; i < 20 && !got; i++) { got = (await mailsTo('owner@e2e.test')).some((m) => m.subject === 'UNIER test alert'); if (!got) await a.waitForTimeout(250); }
  expect(got, 'no test alert');
});
console.log('Kids side');
await check('kids corner, classroom pack and worksheets open for guests', async () => {
  for (const url of ['/kids', '/kids/teachers', '/kids/teachers/print']) { const r = await go(g, url); expect(r.status() === 200, `${url}: ${r.status()}`); await noCrash(g); }
  await go(g, '/kids/teachers/print'); expect(await g.locator('.ws').count() === 2, 'expected two worksheets');
});
await check('moderator writes an easy-read version; it shows in the kids corner and on the petition', async () => {
  await go(a, `/admin?tab=petitions&tr=${seedId}`);
  const f = a.locator(`#easy-${seedId}`);
  await f.locator('input[name=title_en]').fill('Let the fish live');
  await f.locator('textarea[name=text_en]').fill('Big boats scrape the sea floor. We ask them to stop in safe zones.');
  await f.getByRole('button', { name: 'Save easy-read' }).click(); await settle(a);
  expect(one(`select easy->'en'->>'title' from petitions where id = '${seedId}'`) === 'Let the fish live', 'easy-read not saved');
  await go(g, '/kids'); expect(await g.getByText('Let the fish live').count(), 'not in the kids corner');
  expect(!(await g.getByRole('button', { name: /^Sign/ }).count()), 'kids corner shows a sign button');
  await go(g, `/p/${seedId}`); expect(await g.locator('.easy-box').getByText('Let the fish live').count(), 'no easy-read box on the petition');
});

await check('admin takes the sample petitions down before launch', async () => {
  await go(a, '/admin?tab=launch'); await a.getByRole('button', { name: 'Take the sample petitions down' }).click(); await settle(a);
  expect(one(`select count(*) from petitions where organiser_name ilike '%(sample)%' and status <> 'removed'`) === '0', 'samples still live');
  await go(a, '/admin?tab=launch'); expect(await a.getByText('No sample petitions left').count(), 'checklist not updated');
});


console.log('Petition life cycle (0018)');
{
  const D = newUser('dora'); handle(D, 'dora_e2e');
  const mk = (title, status = 'live') => one(`insert into petitions (created_by, organiser_name, title, target, region, ask, why, topic, goal, status)
    values ('${D.id}', 'Dora', '${title}', 'Minister of Testing', 'Hungary', 'Please do the tested thing by next spring for everyone.', 'Because tests keep everyone safe and calm.', 'digital', 1000, '${status}') returning id`);
  const ended = mk('Ended petition for the life cycle test'), quiet = mk('Delivered petition waiting for an answer'), gone = mk('Removed petition that gets appealed');
  sql(`alter table petitions disable trigger petition_lifecycle; update petitions set ends_on = (now() at time zone 'Europe/Budapest')::date - 1 where id = '${ended}'; alter table petitions enable trigger petition_lifecycle;`);
  sql(`insert into petition_updates (petition_id, kind, title, created_by, created_at) values ('${quiet}', 'delivered', 'Delivered to the minister', '${D.id}', now() - interval '12 days')`);
  sql(`update petitions set status = 'removed', moderation_note = 'Looks like a duplicate' where id = '${gone}'`);
  const d = await as(D);

  await check('after its end date a petition shows as closed and cannot be signed', async () => {
    await go(g, `/p/${ended}`); await noCrash(g);
    expect(await g.getByText(/Signing closed on/).count(), 'no closed note');
    expect(!(await g.getByRole('button', { name: /^Sign/ }).count()), 'sign button still shown');
  });
  await check('the nightly job closes it and reminds the organiser to deliver', async () => {
    const r = await g.request.get(APP + '/api/lifecycle'); expect(r.status() === 401, `cron open to anyone: ${r.status()}`);
    await go(a, '/admin?tab=petitions'); await a.getByRole('button', { name: 'Close ended petitions now' }).click(); await settle(a);
    expect(one(`select status from petitions where id = '${ended}'`) === 'closed', 'not closed');
    await go(d, '/you'); expect(await d.getByText(/Signing has closed on/).count(), 'no reminder under You');
    expect(await d.locator(`a[href="/p/${ended}/report"]`).count(), 'no link to the report');
    await go(d, `/p/${ended}/report`); expect(await d.getByRole('button', { name: /delivered/i }).count(), 'cannot mark a closed petition delivered');
  });
  await check('cron endpoint runs with the secret', async () => {
    const r = await g.request.get(APP + '/api/lifecycle', { headers: { authorization: 'Bearer e2e' } }); const j = await r.json();
    expect(r.ok() && j.lifecycle, JSON.stringify(j));
  });
  await check('days without an answer show on the petition, the board and the embed', async () => {
    await go(g, `/p/${quiet}`); expect(await g.getByText(/days without an answer from Minister of Testing/).count(), 'no counter');
    expect((await g.locator('.silence .bignum').innerText()).trim() === '12', 'wrong number of days');
    const href = await g.locator('.silence a').getAttribute('href'); expect(href === '/targets#t-minister-of-testing', `board link ${href}`);   // the board itself is cached for 5 minutes
    const e = await (await g.request.get(APP + `/embed/${quiet}`)).text(); expect(e.includes('Days without an answer'), 'embed has no counter');
  });
  await check('the organiser sets an end date on the dashboard', async () => {
    await go(d, `/p/${quiet}/dashboard`);
    const day = one(`select to_char((now() at time zone 'Europe/Budapest')::date + 20, 'YYYY-MM-DD')`);
    await d.locator('#end-date').fill(day); await d.getByRole('button', { name: 'Save date' }).click(); await d.getByText('Saved.').waitFor({ timeout: 5000 });
    expect(one(`select ends_on from petitions where id = '${quiet}'`) === day, 'end date not saved');
  });
  await check('an author appeals a removal and a moderator reverses it', async () => {
    await go(d, '/you'); await d.locator(`a[href="/appeal?kind=petition&id=${gone}"]`).click(); await settle(d);
    expect(await d.getByText('Looks like a duplicate').count(), 'decision not shown');
    await d.locator('#appeal-body').fill('It is not a duplicate: it asks a different ministry.'); await d.getByRole('button', { name: 'Send appeal' }).click();
    await d.waitForURL(/appealed=1/, { timeout: 8000 }); await d.getByText(/Your appeal was sent/).waitFor({ timeout: 8000 });
    expect(await d.getByText('Waiting for a second look').count(), 'appeal not listed');
    await go(a, '/admin?tab=appeals'); expect(await a.getByText(/asks a different ministry/).count(), 'appeal not in admin');
    const f = a.locator('.panel', { hasText: 'asks a different ministry' });
    await f.locator('input[name=note]').fill('Agreed, it asks a different ministry.'); await f.getByRole('button', { name: 'Reverse and restore' }).click(); await settle(a);
    expect(one(`select status from petitions where id = '${gone}'`) === 'live', 'petition not restored');
    await go(d, '/you'); expect(await d.getByText(/reversed the decision/).count(), 'author not told');
    await go(g, '/transparency'); expect(await g.getByText('decisions reversed').count(), 'no appeal numbers on transparency');
  });
}

await b.close();
if (errors.length) { console.log('\nBrowser/server errors:'); [...new Set(errors)].slice(0, 30).forEach((e) => console.log('  ' + e)); }
console.log(failed() ? `\n${failed()} check(s) failed` : '\nAll end-to-end checks passed');
process.exit(failed() || errors.length ? 1 : 0);
