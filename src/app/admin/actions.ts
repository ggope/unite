'use server';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/supabase/server';
import { isLang } from '@/lib/i18n/dict';

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
  const { error } = await sb.from(table).update({ status, moderation_note: approve ? null : s(f, 'note') || null }).eq('id', s(f, 'id'));
  await done(error);
}

export async function petitionStatus(status: 'live' | 'closed' | 'removed', f: FormData) {
  const sb = await mod();
  if (!['live', 'closed', 'removed'].includes(status)) return;
  if (status === 'removed' && !s(f, 'note')) return done(NEED_REASON);
  const { error } = await sb.from('petitions').update({ status, moderation_note: status === 'removed' ? s(f, 'note') || null : null }).eq('id', s(f, 'id'));
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
