import { createClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';

// Public totals that are the same for everyone (transparency, "Who listens"). Every page reads the visitor's
// language cookie, so pages cannot be cached whole; the numbers are, for a few minutes, so a busy day does not
// recount the whole database for each visitor.
const anon = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

export const publicRpc = (fn: 'transparency_stats' | 'accountability', seconds = 300) =>
  unstable_cache(async () => {
    const { data, error } = await anon().rpc(fn);
    if (error) throw error;   // not cached: tried again on the next visit (for example before the migration has run)
    return data;
  }, ['public-rpc', fn], { revalidate: seconds })().catch(() => null);

export const publicPetitions = (ids: string[]) =>
  unstable_cache(async () => {
    const { data, error } = await anon().from('petitions').select('id, title, target, lang, tr').in('id', ids);
    if (error) throw error;
    return data;
  }, ['public-petitions', ids.join(',')], { revalidate: 300 })().catch(() => null);
