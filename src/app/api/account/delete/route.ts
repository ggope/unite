import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { currentUser } from '@/lib/supabase/server';

// Deletes the auth user; everything else is removed by "on delete cascade".
export async function POST() {
  const { sb, user } = await currentUser();
  if (!user) return NextResponse.json({ error: 'not signed in' }, { status: 401 });
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: files } = await admin.storage.from('videos').list(user.id);
  if (files?.length) await admin.storage.from('videos').remove(files.map((f) => `${user.id}/${f.name}`));
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ error: 'delete failed' }, { status: 500 });
  await sb.auth.signOut();
  return NextResponse.json({ ok: true });
}
