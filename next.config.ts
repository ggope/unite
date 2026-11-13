import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // staleTimes: tabs you just visited open instantly from memory for 30 s (a sign or follow refreshes them anyway)
  experimental: { serverActions: { bodySizeLimit: '2mb' }, staleTimes: { dynamic: 30, static: 300 } },
  async headers() {
    return [{ source: '/(.*)', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
    ] }, {
      // Other sites may not show UNIER inside a frame, so nobody can trick a click on "Sign" (clickjacking).
      // The small sign box at /embed is the one page made to be framed.
      source: '/((?!embed/).*)', headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
      ] }];
  },
};
export default nextConfig;
