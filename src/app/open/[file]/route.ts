import { createClient } from '@supabase/supabase-js';

// Open numbers: the same public totals as the transparency page, as spreadsheets anyone can download.
// No names, ever. Countries under 10 signatures are left out by the database.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const FILES = ['totals', 'petitions', 'targets', 'countries'] as const;
type File = (typeof FILES)[number];

// Quotes every cell, and stops spreadsheet apps from running a cell that starts like a formula.
const cell = (v: unknown) => {
  let s = v === null || v === undefined ? '' : Array.isArray(v) ? v.join(' ') : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};
const csv = (head: string[], rows: unknown[][]) => [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';

export async function GET(req: Request, { params }: { params: Promise<{ file: string }> }) {
  const name = (await params).file.replace(/\.csv$/, '') as File;
  if (!FILES.includes(name)) return new Response('Not found', { status: 404 });
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const site = new URL(req.url).origin;
  let body = '';

  if (name === 'totals') {
    const { data } = await sb.rpc('transparency_stats');
    body = csv(['measure', 'value'], Object.entries((data ?? {}) as Record<string, unknown>).map(([k, v]) => [k, v]));
  } else if (name === 'petitions') {
    const { data } = await sb.from('petitions')
      .select('id, title, target, region, topic, goal, status, created_at, ends_on, petition_stats(signatures, combined)')
      .in('status', ['live', 'closed']).order('created_at', { ascending: false }).limit(5000);
    const st = (p: any) => (Array.isArray(p.petition_stats) ? p.petition_stats[0] : p.petition_stats) ?? {};
    body = csv(['id', 'title', 'target', 'region', 'topic', 'status', 'goal', 'signatures_on_unier', 'signatures_total', 'created_at', 'ends_on', 'url'],
      (data ?? []).map((p: any) => [p.id, p.title, p.target, p.region, p.topic, p.status, p.goal, st(p).signatures ?? 0, st(p).combined ?? 0, p.created_at, p.ends_on, `${site}/p/${p.id}`]));
  } else if (name === 'targets') {
    const { data } = await sb.rpc('accountability');
    body = csv(['target', 'petitions', 'signatures', 'delivered', 'answered', 'wins', 'days_silent_since_delivery'],
      (data ?? []).map((r: any) => [r.target, r.petitions, r.signatures, r.delivered, r.answered, r.wins, r.silent_days]));
  } else {
    const { data } = await sb.rpc('country_totals');
    body = csv(['country', 'signatures', 'petitions'], (data ?? []).map((r: any) => [r.country, r.signatures, r.petitions]));
  }

  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="unier-${name}.csv"`,
      'Cache-Control': 'public, max-age=600, s-maxage=600, stale-while-revalidate=3600',   // served from the CDN, not the database, on every download
      'Access-Control-Allow-Origin': '*',
    },
  });
}
