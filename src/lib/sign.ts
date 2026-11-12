import { geo } from './geo';
import { arrivedVia } from './shareCode';

// Signs with the approximate country. Falls back to the older database function until 0005_report.sql has run.
export async function signRpc(sb: any, p: { petition: string; why: string | null; show: boolean }) {
  const args = { p_petition: p.petition, p_why: p.why, p_show_reason: p.show };
  const missing = (r: any) => r.error && (r.error.code === 'PGRST202' || /could not find the function/i.test(r.error.message));
  const ref = arrivedVia();
  let r = await sb.rpc('sign_petition', { ...args, p_country: geo(), ...(ref ? { p_ref: ref } : {}) });
  if (missing(r) && ref) r = await sb.rpc('sign_petition', { ...args, p_country: geo() });   // before 0015_reach.sql
  if (missing(r)) r = await sb.rpc('sign_petition', args);
  return r;
}
