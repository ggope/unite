import type { Metadata, Viewport } from 'next';
import { Anton, Inter } from 'next/font/google';
import { Nav } from '@/components/Nav';
import { LangProvider } from '@/lib/i18n/client';
import { PendingSign } from '@/components/PendingSign';
import { Hydrated } from '@/components/Hydrated';
import { MyloCorner } from '@/components/mylo/MyloCorner';
import { getT } from '@/lib/i18n/server';
import { messagesFor } from '@/lib/i18n/dict';
import { siteUrl } from '@/lib/topics';
import './globals.css';

// Anton for headlines and big buttons (the protest-sign voice), Inter for everything people read.
const anton = Anton({ subsets: ['latin', 'latin-ext'], weight: '400', variable: '--font-anton' });
const inter = Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-inter' });

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    metadataBase: new URL(siteUrl()),
    title: 'UNIER', description: t('meta.description'),
    openGraph: { siteName: 'UNIER', title: 'UNIER', description: t('meta.description'), type: 'website' },
    twitter: { card: 'summary_large_image' },
    appleWebApp: { capable: true, title: 'UNIER', statusBarStyle: 'default' },
    applicationName: 'UNIER',
  };
}
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: [{ media: '(prefers-color-scheme: light)', color: '#F2EEE6' }, { media: '(prefers-color-scheme: dark)', color: '#15130F' }] };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { lang, t } = await getT();
  return (
    <html lang={lang} className={`${anton.variable} ${inter.variable}`}>
      <body><LangProvider lang={lang} messages={messagesFor(lang)}><a className="skip" href="#main">{t('a11y.skip')}</a><div className="app"><Nav /><main id="main" tabIndex={-1}>{children}</main></div><PendingSign /><Hydrated /><MyloCorner /></LangProvider></body>
    </html>
  );
}
