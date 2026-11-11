import { geo } from './geo';

// Signs with the approximate country. Falls back to the older database function until 0005_report.sql has run.
export async function signRpc(sb: any, p: { petition: string; why: string | null; show: boolean }) {
  const args = { p_petition: p.petition, p_why: p.why, p_show_reason: p.show };
  const r = await sb.rpc('sign_petition', { ...args, p_country: geo() });
  if (r.error && (r.error.code === 'PGRST202' || /could not find the function/i.test(r.error.message))) return sb.rpc('sign_petition', args);
  return r;
}
