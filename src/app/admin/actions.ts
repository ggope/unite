'use server';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/supabase/server';
import { isLang, LANGS } from '@/lib/i18n/dict';
import { EASY_TEXT, EASY_TITLE } from '@/lib/easy';
import { tellAuthor } from '@/lib/decisionMail';

const LANG_KEYS = Object.keys(LANGS) as (keyof typeof LANGS)[];

async function mod() {
  const { sb, user } = await currentUser();
  if (!user) throw new Error('not_signed_in');
  const { data } = await sb.from('profiles').select('is_moderator').eq('id', user.id).single();
  if (!data?.is_moderator) throw new Error('not_moderator');
  return sb;   // row level security also checks every write
}
// Every action returns to the same admin tab, with a short note when something went wrong.
async function done(error?: { message: string } | null) {
  revalidatePath('/admin'); revalidatePath('/'); revalidatePath('/petitions');
  const u = new URL((await headers()).get('referer') ?? '/admin', 'http://x');
  if (!error && !u.searchParams.has('err')) return;
  if (error) u.searchParams.set('err', error.message.slice(0, 120)); else u.searchParams.delete('err');
  redirect((u.pathname.startsWith('/admin') ? u.pathname : '/admin') + u.search);   // never off-site, whatever the Referer says
}
const s = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
// Accepts a petition id or a pasted link to one.
const pid = (v: string) => v.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] ?? '';

// Each button binds its own choice (button name/value pairs did not reach server actions,
// so "Approve" was read as "Reject").
export async function noop() {}

// The EU Digital Services Act asks for a clear reason whenever we remove or decline someone's content.
const NEED_REASON = { message: 'Write the reason first. The author sees it, and the law requires one.' };

export async function review(decision: 'approve' | 'reject', f: FormData) {
  const sb = await mod();
  const table = s(f, 'kind') === 'petition' ? 'petitions' : 'videos';
  const approve = decision === 'approve';
  if (!approve && !s(f, 'note')) return done(NEED_REASON);
  const status = table === 'petitions' ? (approve ? 'live' : 'removed') : (approve ? 'approved' : 'rejected');
  const { data: changed, error } = await sb.from(table).update({ status, moderation_note: approve ? null : s(f, 'note') || null }).eq('id', s(f, 'id')).select('id');
  if (!error && changed?.length) await tellAuthor(table === 'petitions' ? 'petition' : 'video', s(f, 'id'), approve ? 'live' : 'off', s(f, 'note'));
  await done(error);
}

export async function petitionStatus(status: 'live' | 'closed' | 'removed', f: FormData) {
  const sb = await mod();
  if (!['live', 'closed', 'removed'].includes(status)) return;
  if (status === 'removed' && !s(f, 'note')) return done(NEED_REASON);
  const { data: before } = await sb.from('petitions').select('status').eq('id', s(f, 'id')).maybeSingle();
  const { error } = await sb.from('petitions').update({ status, moderation_note: status === 'removed' ? s(f, 'note') || null : null }).eq('id', s(f, 'id'));
  if (!error && before && before.status !== status && (status === 'removed' || before.status === 'pending')) await tellAuthor('petition', s(f, 'id'), status === 'removed' ? 'off' : 'live', s(f, 'note'));
  await done(error);
}

// The optional official channel (ECI, parliament e-petition) shown to signers who want to go further.
export async function setOfficial(f: FormData) {
  const sb = await mod();
  const url = s(f, 'url');
  if (url && !url.startsWith('https://')) return done({ message: 'The link must start with https://' });
  await done((await sb.from('petitions').update({ official_url: url || null }).eq('id', s(f, 'id'))).error);
}

// The organiser's link bar. Moderators can fix or remove it at any time.
export async function setLink(f: FormData) {
  const sb = await mod();
  const url = s(f, 'url'), cta = s(f, 'cta');
  if (url && !url.startsWith('https://')) return done({ message: 'The link must start with https://' });
  await done((await sb.from('petitions').update({ link_url: url || null, link_cta: ['learn', 'visit', 'donate', 'join', 'event'].includes(cta) ? cta : 'learn' }).eq('id', s(f, 'id'))).error);
}

// A petition's text in another language (0012, 0015). Empty fields fall back to the original.
export async function setTranslation(f: FormData) {
  const sb = await mod();
  const to = s(f, 'to'); if (!isLang(to)) return done({ message: 'Unknown language.' });
  const lim = { title: 90, target: 120, ask: 2000, why: 5000 } as const;
  const t: Record<string, string> = {};
  for (const [k, n] of Object.entries(lim)) { const v = s(f, k).slice(0, n); if (v) t[k] = v; }
  const { data: p } = await sb.from('petitions').select('tr').eq('id', s(f, 'id')).single();
  const tr = { ...((p?.tr as Record<string, unknown>) ?? {}) };
  if (Object.keys(t).length) tr[to] = t; else delete tr[to];
  await done((await sb.from('petitions').update({ tr }).eq('id', s(f, 'id'))).error);
}
// The easy-read version for kids (0019), all languages in one form. Saving it empty takes the petition out of the kids corner.
export async function setEasy(f: FormData) {
  const sb = await mod();
  const easy: Record<string, { title: string; text: string }> = {};
  for (const l of LANG_KEYS) {
    const title = s(f, `title_${l}`).slice(0, EASY_TITLE), text = s(f, `text_${l}`).slice(0, EASY_TEXT);
    if (title && text) easy[l] = { title, text };
    else if (title || text) return done({ message: `${l.toUpperCase()}: write both the kids' title and the text, or leave both empty.` });
  }
  revalidatePath('/kids');
  await done((await sb.from('petitions').update({ easy }).eq('id', s(f, 'id'))).error);
}
export async function setOriginalLang(f: FormData) {
  const sb = await mod();
  const lang = s(f, 'lang'); if (!isLang(lang)) return done({ message: 'Unknown language.' });
  await done((await sb.from('petitions').update({ lang }).eq('id', s(f, 'id'))).error);
}

// Big community goals: pinned petitions lead the list on the Mylo page.
export async function setFeatured(f: FormData) {
  const sb = await mod();
  await done((await sb.rpc('set_featured', { p_petition: s(f, 'id'), p_on: !!s(f, 'on') })).error);
}

// Unite: both petitions join one group; each keeps its own count, and the total is shown on both.
export async function unite(f: FormData) {
  const sb = await mod();
  const a = s(f, 'id'), b = pid(s(f, 'with')); if (!a || !b || a === b) return done({ message: 'Pick another petition from the list' });
  const { data: ps } = await sb.from('petitions').select('id, title, cluster_id').in('id', [a, b]);
  if (!ps || ps.length !== 2) return done({ message: 'Petition not found' });
  let cluster = ps.find((p: any) => p.cluster_id)?.cluster_id as string | undefined;
  if (!cluster) { const { data } = await sb.from('clusters').insert({ label: ps.find((p: any) => p.id === a)!.title }).select('id').single(); cluster = data?.id; }
  if (!cluster) return done({ message: 'Could not create the group' });
  const others = ps.map((p: any) => p.cluster_id).filter((c: any) => c && c !== cluster);
  if (others.length) await sb.from('petitions').update({ cluster_id: cluster }).in('cluster_id', others);   // merge two groups
  const { error } = await sb.from('petitions').update({ cluster_id: cluster }).in('id', [a, b]);
  await done(error);
}
export async function separate(f: FormData) {
  const sb = await mod();
  const { error } = await sb.from('petitions').update({ cluster_id: null }).eq('id', s(f, 'id'));
  await done(error);
}

export async function resolveReport(action: 'dismiss' | 'remove', f: FormData) {
  const sb = await mod();
  const note = s(f, 'note') || null;
  const video = s(f, 'video_id'), petition = s(f, 'petition_id'), person = s(f, 'profile_id');
  const reason = s(f, 'reason_key'), answer = s(f, 'update_id');
  const resolved = { status: 'resolved', resolved_at: new Date().toISOString() };
  if (action === 'remove') {
    if (!note) return done(NEED_REASON);
    // A reason for signing: hidden from every page, and the signer is told why. Its reports close with it.
    if (reason) return done((await sb.rpc('hide_reason', { p_key: reason, p_note: note })).error);
    // An official answer: deleted. Its open reports are closed by the database as it goes.
    if (answer) return done((await sb.from('petition_updates').delete().eq('id', answer)).error);
    const { error } = video
      ? await sb.from('videos').update({ status: 'rejected', moderation_note: note }).eq('id', video)
      : petition ? await sb.from('petitions').update({ status: 'removed', moderation_note: note }).eq('id', petition)
      : await sb.rpc('clear_profile', { p_user: person, p_note: note });
    if (error) return done(error);
    if (video || petition) await tellAuthor(video ? 'video' : 'petition', video || petition, 'off', note);
    // Removing the item settles every open report about it, not just this one.
    const q = sb.from('reports').update(resolved).eq('status', 'open');
    return done((await (video ? q.eq('video_id', video) : petition ? q.eq('petition_id', petition) : q.eq('profile_id', person).is('video_id', null).is('petition_id', null))).error);
  }
  await done((await sb.from('reports').update(resolved).eq('id', Number(s(f, 'report_id')))).error);
}

export async function setModerator(f: FormData) {
  const sb = await mod();
  const { error } = await sb.rpc('set_moderator', { p_user: s(f, 'id'), p_on: s(f, 'on') === 'true' });
  await done(error && { message: error.message.includes('last_moderator') ? 'UNIER needs at least one moderator.' : error.message });
}

export async function importNews() {
  await mod();
  const { runImport } = await import('@/lib/news/importer');
  await runImport();
  await done();
}
export async function newsAction(op: 'attach' | 'hide', f: FormData) {
  const sb = await mod();
  const patch = op === 'hide' ? { status: 'hidden' } : { petition_id: pid(s(f, 'petition_id')) || null };
  await done((await sb.from('news_items').update(patch).eq('id', s(f, 'id'))).error);
}
export async function toggleSource(f: FormData) {
  const sb = await mod();
  await done((await sb.from('news_sources').update({ active: s(f, 'active') === 'true' }).eq('id', s(f, 'id'))).error);
}

// Team videos (0025): import now, pause a channel, hide a clip or move it to a better petition.
export async function importClips() {
  await mod();
  const { runClipImport } = await import('@/lib/clips/importer');
  await runClipImport();
  await done();
}
export async function clipAction(op: 'attach' | 'hide' | 'show', f: FormData) {
  const sb = await mod();
  const patch = op === 'attach' ? { petition_id: pid(s(f, 'petition_id')) } : { status: op === 'hide' ? 'hidden' : 'live' };
  if (op === 'attach' && !patch.petition_id) return done({ message: 'Pick a petition first.' });
  await done((await sb.from('team_videos').update(patch).eq('id', s(f, 'clip'))).error);
}
export async function toggleVideoSource(f: FormData) {
  const sb = await mod();
  await done((await sb.from('video_sources').update({ active: s(f, 'active') === 'true' }).eq('id', s(f, 'source'))).error);
}

export async function setHumanCheck(f: FormData) {
  const sb = await mod();
  const on = s(f, 'on') === 'true';
  if (on && !(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY)) return done({ message: 'Add the Cloudflare Turnstile keys in Vercel first.' });
  const { error } = await sb.from('site_settings').update({ require_human_check: on }).eq('id', true);
  await done(error);
}

// Before launch: takes every sample petition down at once. They stay in the database and can be put back under Petitions.
export async function removeSamples() {
  const sb = await mod();
  await done((await sb.from('petitions').update({ status: 'removed', moderation_note: 'Sample petition, taken down before launch.' })
    .ilike('organiser_name', '%(sample)%').neq('status', 'removed')).error);
}

// Appeals (0018): a second look at a decision. Either way the author is told the reason.
export async function decideAppeal(reverse: boolean, f: FormData) {
  const sb = await mod();
  if (!s(f, 'note')) return done(NEED_REASON);
  const { error } = await sb.rpc('decide_appeal', { p_id: Number(s(f, 'id')), p_reverse: reverse, p_note: s(f, 'note') });
  await done(error && { message: error.message.includes('not_open') ? 'Someone already decided this appeal.' : error.message });
}

// The nightly job (closing ended petitions, delivery reminders, silence notifications), started by hand.
export async function runLifecycle() {
  const sb = await mod();
  const { error } = await sb.rpc('run_lifecycle_now');
  if (!error) { const { sendPending } = await import('@/lib/push/send'); await sendPending(50).catch(() => {}); }
  await done(error);
}

// Errors tab: mark one as fixed (it comes back, and alerts again, if it happens again).
export async function resolveError(f: FormData) {
  const sb = await mod();
  await done((await sb.rpc('resolve_error', { p_fingerprint: s(f, 'fp') })).error);
}

// Errors tab: sends a test alert, so the owner knows the emails arrive.
export async function testAlert() {
  await mod();
  const { mailReady, sendMail } = await import('@/lib/mail/send');
  if (!process.env.ALERT_EMAIL || !mailReady()) return done({ message: 'Set ALERT_EMAIL and the SMTP settings in Vercel first.' });
  const r = await sendMail({ to: process.env.ALERT_EMAIL, subject: 'UNIER test alert', text: 'This is a test. Error alerts from UNIER will arrive like this.' });
  await done(r.ok ? null : { message: `Sending failed: ${r.error}` });
}

// AI check (0024): off, suggest (labels only) or auto (also handles the clearest petitions).
export async function setAiMode(mode: 'off' | 'suggest' | 'auto') {
  const sb = await mod();
  if (!['off', 'suggest', 'auto'].includes(mode)) return;
  await done((await sb.from('site_settings').update({ ai_moderation: mode }).eq('id', true)).error);
}
// AI check: looks at everything still waiting now, instead of waiting for the next new item or the nightly run.
export async function runAiNow() {
  await mod();
  const { aiReady, runAiChecks } = await import('@/lib/ai/moderate');
  if (!aiReady()) return done({ message: 'Add ANTHROPIC_API_KEY (and SUPABASE_SERVICE_ROLE_KEY) in Vercel first.' });
  const r = await runAiChecks({ limit: 20, seconds: 50 });
  await done(r.skipped === 'daily_limit' ? { message: 'The daily AI limit is reached (AI_DAILY_LIMIT).' } : r.skipped === 'off' ? { message: 'The AI check is switched off.' }
    : r.skipped === 'run_0024' ? { message: 'Run 0024_ai_moderation.sql first.' } : r.errors ? { message: `${r.errors} check(s) failed. See Errors.` } : null);
}

// UNIER team content (0023): one switch for team petitions and team videos.
export async function setTeamContent(f: FormData) {
  const sb = await mod();
  const level = s(f, 'level');
  if (!['auto', 'full', 'less', 'off'].includes(level)) return;
  const { error } = await sb.from('site_settings').update({ team_content: level }).eq('id', true);
  await done(error && { message: /team_content/.test(error.message) ? 'Run 0023_team_content.sql first (see Launch checklist).' : error.message });
}

// Starts the daily drafting by hand. Drafts land in the review queue.
export async function draftNow() {
  await mod();
  const { runDrafts } = await import('@/lib/team/draft');
  const r = await runDrafts({ force: true });
  const summary = `${r.status}: ${r.drafted} drafted, ${r.duplicates} already covered, ${r.skipped} skipped, ${r.failed} failed`;
  const u = new URL((await headers()).get('referer') ?? '/admin?tab=team', 'http://x');
  u.searchParams.delete('err'); u.searchParams.set('ran', summary.slice(0, 160));
  revalidatePath('/admin'); redirect(u.pathname + u.search);
}

// A moderator fixes a team draft before approving it.
export async function editDraft(f: FormData) {
  const sb = await mod();
  const row = { title: s(f, 'title'), target: s(f, 'target'), region: s(f, 'region'), ask: s(f, 'ask'), why: s(f, 'why') };
  const { error } = await sb.from('petitions').update(row).eq('id', s(f, 'id')).eq('origin', 'team').eq('status', 'pending');
  await done(error && { message: error.message.includes('check') ? 'A field is too short or too long.' : error.message });
}
