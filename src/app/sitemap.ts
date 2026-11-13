import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { supabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Every public page and every live or closed petition, so search engines can find them.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const h = await headers();
  const site = (process.env.NEXT_PUBLIC_SITE_URL || `https://${h.get('host')}`).replace(/\/$/, '');
  const { data } = await (await supabaseServer()).from('petitions').select('id, created_at, status')
    .in('status', ['live', 'closed']).order('created_at', { ascending: false }).limit(5000);
  const pages = ['', '/petitions', '/wins', '/targets', '/mylo', '/mylo/story', '/kids', '/kids/teachers', '/transparency', '/donate', '/privacy', '/terms', '/imprint'];
  return [
    ...pages.map((p) => ({ url: `${site}${p}`, changeFrequency: 'daily' as const, priority: p === '' ? 1 : 0.6 })),
    ...(data ?? []).flatMap((p: any) => [
      { url: `${site}/p/${p.id}`, lastModified: p.created_at, changeFrequency: (p.status === 'live' ? 'daily' : 'monthly') as 'daily' | 'monthly', priority: 0.8 },
      { url: `${site}/p/${p.id}/report`, lastModified: p.created_at, changeFrequency: 'weekly' as const, priority: 0.3 },
    ]),
  ];
}
