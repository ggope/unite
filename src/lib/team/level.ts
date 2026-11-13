import type { SupabaseClient } from '@supabase/supabase-js';

// Admin → Team content (0023_team_content.sql), with "auto" already resolved by the database.
// 'full' until 0023 has been run, so nothing changes before then.
export type Level = 'full' | 'less' | 'off';
export async function teamLevel(sb: SupabaseClient): Promise<Level> {
  const { data, error } = await sb.rpc('team_content_level');
  return !error && (data === 'less' || data === 'off') ? data : 'full';
}
