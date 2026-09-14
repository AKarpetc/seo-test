import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { SITE_NAME, siteUrl } from '@/lib/site';
import { Analytics } from '@/components/Analytics';
import { AdSenseScript } from '@/components/Ads';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${SITE_NAME} — Public US Government Data, Searchable`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    'Search millions of records from US federal open data: doctor NPI numbers, FDIC bank branches, FAA aircraft registrations, DOT carriers, USDA nutrition and NOAA climate normals.',
  openGraph: { siteName: SITE_NAME, type: 'website', locale: 'en_US' },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
};

/** Matches the browser chrome to the page in both themes. */
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f6f8' },
    { media: '(prefers-color-scheme: dark)', color: '#0c0f16' },
  ],
  colorScheme: 'light dark',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
        <AdSenseScript />
      </body>
    </html>
  );
}
