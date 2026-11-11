import type { MetadataRoute } from 'next';

// Lets people "Add to Home Screen": UNIER then opens full screen with its own icon, like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'UNIER',
    short_name: 'UNIER',
    description: 'See what is happening. Sign what matters. Hear what happened next.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#05060C',
    theme_color: '#05060C',
    icons: [
      { src: '/icons/192', sizes: '192x192', type: 'image/png' },
      { src: '/icons/512', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
