import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Keeps the sign-in session fresh. Guests (no auth cookie) pass straight through with no network call.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!request.cookies.getAll().some((c) => c.name.startsWith('sb-') && c.name.includes('-auth-token'))) return response;
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
  return response;
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|api/card|manifest.webmanifest|icon|apple-icon|icons/|opengraph-image|api/news|.*\\.(?:png|svg|jpg|webp|ico)$).*)'] };
