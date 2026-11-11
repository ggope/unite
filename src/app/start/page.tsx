import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/supabase/server';
import { StartForm } from './StartForm';
import { getT } from '@/lib/i18n/server';

export default async function Start({ searchParams }: { searchParams: Promise<{ then?: string; source?: string; topic?: string }> }) {
  const { user } = await currentUser();
  if (!user) redirect('/login?next=/start');
  const { then, source, topic } = await searchParams;
  const { t } = await getT();
  return <div className="stack"><h1>{t('common.startPetition')}</h1><StartForm then={then === 'video' ? 'video' : 'page'} source={source?.startsWith('https://') ? source : undefined} topic={topic} /></div>;
}
