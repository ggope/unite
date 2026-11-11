import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/supabase/server';
import { StartForm } from './StartForm';

export default async function Start({ searchParams }: { searchParams: Promise<{ then?: string }> }) {
  const { user } = await currentUser();
  if (!user) redirect('/login?next=/start');
  const { then } = await searchParams;
  return <div className="stack"><h1>Start a petition</h1><StartForm then={then === 'video' ? 'video' : 'page'} /></div>;
}
