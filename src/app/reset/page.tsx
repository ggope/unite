import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { ResetForm } from './ResetForm';
export default async function Reset() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login?error=link');
  return <div className="stack" style={{ maxWidth: 420 }}><h1 style={{ marginBottom: 0 }}>Set a new password</h1><ResetForm /></div>;
}
