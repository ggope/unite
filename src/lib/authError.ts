// Turn Supabase's error into something a person can act on; keep the raw text for anything unknown.
export function authError(t: (k: any) => string, e: { message: string; code?: string }, fallback: string) {
  const m = `${e.code ?? ''} ${e.message}`;
  if (/rate.?limit/i.test(m)) return t('login.errRate');
  if (/not.?authori[sz]ed/i.test(m)) return t('login.errNotAllowed');
  if (/already|exists/i.test(m)) return t('login.errExists');
  if (/weak|password/i.test(m)) return t('login.errWeak');
  return `${t(fallback)} (${e.message})`;
}
