import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Keeps the sign-in session fresh. Guests (no auth cookie) pass straight through with no network call.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  // Approximate country from the connection (Vercel adds it). Only used as a total in petition reports.
  const country = request.headers.get('x-vercel-ip-country');
  // A share link (?r=code) is remembered for 30 days, so a signature can count for whoever shared it.
  const ref = request.nextUrl.searchParams.get('r');
  const setGeo = (r: NextResponse) => {
    if (country && request.cookies.get('geo')?.value !== country) r.cookies.set('geo', country, { path: '/', sameSite: 'lax', maxAge: 86400 });
    if (ref && /^[a-f0-9]{12}$/.test(ref)) r.cookies.set('ref', ref, { path: '/', sameSite: 'lax', maxAge: 30 * 86400 });
    return r;
  };
  if (!request.cookies.getAll().some((c) => c.name.startsWith('sb-') && c.name.includes('-auth-token'))) return setGeo(response);
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await sb.auth.getClaims();   // refreshes an expired token; verifies locally otherwise
  return setGeo(response);
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|api/card|manifest.webmanifest|icon|apple-icon|icons/|opengraph-image|api/news|.*\\.(?:png|svg|jpg|webp|ico)$).*)'] };
