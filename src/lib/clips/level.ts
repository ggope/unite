// The shared "team content" switch (0023_team_content.sql): 'full', 'less' or 'off'.
// Before that database update has run, team content counts as fully on.
export type TeamLevel = 'full' | 'less' | 'off';
export async function teamLevel(sb: any): Promise<TeamLevel> {
  try {
    const { data, error } = await sb.rpc('team_content_level');
    return !error && (data === 'less' || data === 'off') ? data : 'full';
  } catch { return 'full'; }
}
