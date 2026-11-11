import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/supabase/server';
import { ResetForm } from './ResetForm';
export default async function Reset() {
  const { user } = await currentUser();
  if (!user) redirect('/login?error=link');
  return <div className="stack" style={{ maxWidth: 420 }}><h1 style={{ marginBottom: 0 }}>Set a new password</h1><ResetForm /></div>;
}
