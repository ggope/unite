import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/supabase/server';
import { ResetForm } from './ResetForm';
import { getT } from '@/lib/i18n/server';
export default async function Reset() {
  const { user } = await currentUser();
  if (!user) redirect('/login?error=link');
  const { t } = await getT();
  return <div className="stack" style={{ maxWidth: 420 }}><h1 style={{ marginBottom: 0 }}>{t('reset.title')}</h1><ResetForm /></div>;
}
