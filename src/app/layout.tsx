import type { Metadata, Viewport } from 'next';
import { Archivo, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import { Nav } from '@/components/Nav';
import { LangProvider } from '@/lib/i18n/client';
import { getT } from '@/lib/i18n/server';
import { siteUrl } from '@/lib/topics';
import './globals.css';

const archivo = Archivo({ subsets: ['latin', 'latin-ext'], axes: ['wdth'], variable: '--font-archivo' });
const plex = IBM_Plex_Sans({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600'], variable: '--font-plex' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['500'], variable: '--font-mono' });

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    metadataBase: new URL(siteUrl()),
    title: 'UNIER', description: t('meta.description'),
    openGraph: { siteName: 'UNIER', title: 'UNIER', description: t('meta.description'), type: 'website' },
    twitter: { card: 'summary_large_image' },
    appleWebApp: { capable: true, title: 'UNIER', statusBarStyle: 'black-translucent' },
    applicationName: 'UNIER',
  };
}
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#05060C' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { lang } = await getT();
  return (
    <html lang={lang} className={`${archivo.variable} ${plex.variable} ${mono.variable}`}>
      <body><LangProvider lang={lang}><div className="app"><Nav /><main>{children}</main></div></LangProvider></body>
    </html>
  );
}
