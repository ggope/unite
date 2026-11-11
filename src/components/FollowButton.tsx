'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Icon } from './Icon';

export function FollowButton({ petitionId, following: initial, loggedIn }: { petitionId: string; following: boolean; loggedIn: boolean }) {
  const [on, setOn] = useState(initial); const router = useRouter(); const sb = supabaseBrowser();
  async function toggle() {
    if (!loggedIn) { router.push('/login'); return; }
    const { data } = await sb.auth.getUser(); if (!data.user) return;
    if (on) await sb.from('follows').delete().eq('petition_id', petitionId);
    else await sb.from('follows').insert({ petition_id: petitionId, user_id: data.user.id });
    setOn(!on);
  }
  return <button className="btn ghost small" aria-pressed={on} onClick={toggle}><Icon name="follow" />{on ? 'Following' : 'Follow'}</button>;
}
