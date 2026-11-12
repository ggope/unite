import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/supabase/server';

// GDPR Art. 15 and 20: everything we hold about you, as one JSON file. Uses your own session,
// so it returns exactly what the database lets you see about yourself.
export async function GET() {
  const { sb, user } = await currentUser();
  if (!user) return NextResponse.json({ error: 'not signed in' }, { status: 401 });
  const q = (p: PromiseLike<{ data: any }>) => Promise.resolve(p).then((r) => r.data ?? null);
  const [profile, settings, consents, signatures, follows, friends, petitions, videos, updates, weights] = await Promise.all([
    q(sb.from('profiles').select('*').eq('id', user.id).maybeSingle()),
    q(sb.from('user_settings').select('*').eq('user_id', user.id).maybeSingle()),
    q(sb.from('consents').select('kind, text_version, granted_at, revoked_at')),
    // the sharer's id stays private: the export only says whether a share link brought you
    q(sb.from('signatures').select('*, petitions(title)')).then((rows) => rows?.map(({ user_id, ref_by, ...r }: any) => ({ ...r, came_through_a_share: !!ref_by }))),
    q(sb.from('follows').select('petition_id, created_at, petitions(title)')),
    q(sb.from('friendships').select('friend_id, created_at, profiles!friendships_friend_id_fkey(handle, display_name)').eq('user_id', user.id)),
    q(sb.from('petitions').select('*').eq('created_by', user.id)),
    q(sb.from('videos').select('id, petition_id, caption, status, moderation_note, audience, created_at').eq('uploader_id', user.id)),
    q(sb.from('petition_updates').select('*').eq('created_by', user.id)),
    q(sb.from('topic_weights').select('topic, weight')),
  ]);
  // People features (0006_social.sql): your messages, requests and blocks.
  const [messages, friend_requests, blocks, reports_sent, invite, notices, devices] = await Promise.all([
    q(sb.from('messages').select('id, sender_id, recipient_id, body, created_at, read_at').order('id')),
    q(sb.from('friend_requests').select('from_id, to_id, created_at')),
    q(sb.from('blocks').select('blocked_id, created_at')),
    q(sb.from('reports').select('video_id, petition_id, profile_id, reason, status, created_at, resolved_at').eq('reporter_id', user.id)),
    q(sb.from('invites').select('code, created_at').eq('user_id', user.id).maybeSingle()),
    q(sb.from('notices').select('kind, body, created_at').eq('user_id', user.id)),
    q(sb.from('push_subscriptions').select('endpoint, lang, created_at').eq('user_id', user.id)),
  ]);
  const body = { exported_at: new Date().toISOString(), account: { id: user.id, email: user.email }, profile, settings, consents, signatures, follows, friends, petitions, videos, updates_posted: updates, feed_learning: weights, messages, friend_requests, blocks, reports_sent, invite, notices, notification_devices: devices,
    note: 'Video files are stored privately; they are deleted with your account. Write to us if you want copies of the files.' };
  return new NextResponse(JSON.stringify(body, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="unier-my-data-${new Date().toISOString().slice(0, 10)}.json"`, 'Cache-Control': 'no-store' } });
}
