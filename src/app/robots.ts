import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

// Public pages are open to search engines; private and personal ones are not.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers();
  const site = (process.env.NEXT_PUBLIC_SITE_URL || `https://${h.get('host')}`).replace(/\/$/, '');
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/moderate', '/answer/', '/api/', '/you', '/messages', '/updates', '/invite/', '/auth/', '/reset', '/login', '/post', '/p/*/dashboard', '/embed/'] }],
    sitemap: `${site}/sitemap.xml`,
  };
}
