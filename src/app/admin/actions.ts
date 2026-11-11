'use server';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/supabase/server';

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
  redirect(u.pathname + u.search);
}
const s = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

export async function review(f: FormData) {
  const sb = await mod();
  const table = s(f, 'kind') === 'petition' ? 'petitions' : 'videos';
  const approve = s(f, 'decision') === 'approve';
  const status = table === 'petitions' ? (approve ? 'live' : 'removed') : (approve ? 'approved' : 'rejected');
  const { error } = await sb.from(table).update({ status, moderation_note: approve ? null : s(f, 'note') || null }).eq('id', s(f, 'id'));
  await done(error);
}

export async function petitionStatus(f: FormData) {
  const sb = await mod();
  const status = s(f, 'status');
  if (!['live', 'closed', 'removed'].includes(status)) return;
  const { error } = await sb.from('petitions').update({ status, moderation_note: status === 'removed' ? s(f, 'note') || null : null }).eq('id', s(f, 'id'));
  await done(error);
}

// Unite: both petitions join one group; each keeps its own count, and the total is shown on both.
export async function unite(f: FormData) {
  const sb = await mod();
  const a = s(f, 'id'), b = s(f, 'with'); if (!a || !b || a === b) return;
  const { data: ps } = await sb.from('petitions').select('id, title, cluster_id').in('id', [a, b]);
  if (!ps || ps.length !== 2) return;
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

export async function resolveReport(f: FormData) {
  const sb = await mod();
  const action = s(f, 'action'), note = s(f, 'note') || null;
  const video = s(f, 'video_id'), petition = s(f, 'petition_id');
  const resolved = { status: 'resolved', resolved_at: new Date().toISOString() };
  if (action === 'remove') {
    const { error } = video
      ? await sb.from('videos').update({ status: 'rejected', moderation_note: note }).eq('id', video)
      : await sb.from('petitions').update({ status: 'removed', moderation_note: note }).eq('id', petition);
    if (error) return done(error);
    // Removing the item settles every open report about it, not just this one.
    const q = sb.from('reports').update(resolved).eq('status', 'open');
    return done((await (video ? q.eq('video_id', video) : q.eq('petition_id', petition))).error);
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
export async function newsAction(f: FormData) {
  const sb = await mod();
  const patch = s(f, 'do') === 'hide' ? { status: 'hidden' } : { petition_id: s(f, 'petition_id') || null };
  await done((await sb.from('news_items').update(patch).eq('id', s(f, 'id'))).error);
}
export async function toggleSource(f: FormData) {
  const sb = await mod();
  await done((await sb.from('news_sources').update({ active: s(f, 'active') === 'true' }).eq('id', s(f, 'id'))).error);
}
