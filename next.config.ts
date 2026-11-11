import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // staleTimes: tabs you just visited open instantly from memory for 30 s (a sign or follow refreshes them anyway)
  experimental: { serverActions: { bodySizeLimit: '2mb' }, staleTimes: { dynamic: 30, static: 300 } },
  async headers() {
    return [{ source: '/(.*)', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
    ] }];
  },
};
export default nextConfig;
