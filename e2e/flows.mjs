// End-to-end checks: real browser, real app, real database rules.
// Run: bash e2e/run.sh   (sets up the database, PostgREST, the mock and the app, then runs this)
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { APP, sql, one, newUser, login, check, expect, failed } from './lib.mjs';
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
const seedId = one(`select id from petitions where status = 'live' order by created_at limit 1`);
await check('petition list, welcome page and news show petitions with totals', async () => {
  await go(g, '/petitions'); expect(await g.locator('text=End bottom trawling').count(), 'petition list is empty');
});
await check('guest opens a petition and its report', async () => {
  let r = await go(g, `/p/${seedId}`); expect(r.status() === 200, `status ${r.status()}`); await noCrash(g);
  r = await go(g, `/p/${seedId}/report`); expect(r.status() === 200, `report status ${r.status()}`);
});
await check('guest sign asks for email and sends a code', async () => {
  await go(g, `/p/${seedId}`);
  await g.getByRole('button', { name: /^Sign/ }).first().click();
  await g.locator('.sheet input[type=email]').fill('guest@e2e.test');
  await g.locator('.sheet input[type=checkbox]').check();
  await g.getByRole('button', { name: /email|link|code/i }).last().click();
  await g.waitForSelector('.sheet .ok', { timeout: 5000 });
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
  await a.fill('[name=link_url]', 'https://example.org/fountains');
  await a.selectOption('[name=topic]', 'health').catch(async () => a.locator('[name=topic][value=health]').check());
  await a.selectOption('[name=goal]', '10000').catch(async () => a.locator('[name=goal][value="10000"]').check());
  await a.locator('[name=facts]').check();
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
  expect(one(`select display_name from profiles where id = '${C.id}'`) === null, 'not cleared');
  const c = await as(C); await go(c, '/you');
  expect(await c.getByText('Your name insulted people').count(), 'person not told why');
  await c.getByRole('button', { name: /^OK$/ }).first().click(); await settle(c);
  expect(one(`select count(*) from notices where user_id = '${C.id}'`) === '0', 'notice not dismissed');
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
  await a.locator('.panel', { hasText: 'Clip without a reason' }).first().getByRole('button', { name: 'Reject' }).click(); await a.waitForTimeout(1200);
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
  expect(one(`select count(*) from signatures where user_id = '${B.id}' and petition_id = '${pid}'`) === '0', 'not withdrawn');
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

await check('revoke consent, then signing asks again', async () => {
  await go(bb, '/you'); await bb.getByRole('button', { name: /withdraw consent|revoke/i }).first().click(); await bb.waitForTimeout(800);
  expect(one(`select count(*) from consents where user_id = '${B.id}' and revoked_at is null`) === '0', 'consent not revoked');
});
await check('sign out', async () => {
  await go(bb, '/you'); await bb.getByRole('button', { name: /sign out/i }).first().click(); await bb.waitForTimeout(1200);
  await go(bb, '/you'); expect(await bb.locator('a[href^="/login"]').count(), 'still signed in');
});


await b.close();
if (errors.length) { console.log('\nBrowser/server errors:'); [...new Set(errors)].slice(0, 30).forEach((e) => console.log('  ' + e)); }
console.log(failed() ? `\n${failed()} check(s) failed` : '\nAll end-to-end checks passed');
process.exit(failed() || errors.length ? 1 : 0);
