import { redirect } from 'next/navigation';
import { loadViewer } from '@/lib/viewer';
import { PostFlow } from './PostFlow';

export const dynamic = 'force-dynamic';

export default async function Post({ searchParams }: { searchParams: Promise<{ petition?: string }> }) {
  const { sb, user, viewer, signed } = await loadViewer();
  if (!user) redirect('/login?next=/post');
  const { petition } = await searchParams;
  const [{ data: mine }, { data: live }] = await Promise.all([
    sb.from('petitions').select('id, title, status').eq('created_by', user.id),
    sb.from('petitions').select('id, title, created_by').eq('status', 'live').order('created_at', { ascending: false }).limit(200),
  ]);
  const list = [...(mine ?? []).map((p: any) => ({ id: p.id, title: p.title, role: 'founder' as const })),
    ...(live ?? []).filter((p: any) => p.created_by !== user.id).map((p: any) => ({ id: p.id, title: p.title, role: signed.has(p.id) ? 'supporter' as const : null }))];
  return <div className="stack"><h1>Post a video</h1><PostFlow userId={user.id} petitions={list} initial={petition ?? null} viewer={viewer} /></div>;
}
