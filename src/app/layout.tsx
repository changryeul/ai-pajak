import type { Metadata } from 'next';
import { Inter, Noto_Sans_KR } from 'next/font/google';
import { APP_NAME, APP_DESCRIPTION } from '@/config/constants';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { GoogleAnalytics } from '@/components/analytics/GoogleAnalytics';
import { WebVitals } from '@/components/analytics/WebVitals';
import { ServiceWorkerRegistration } from '@/components/pwa/ServiceWorkerRegistration';
import '@/app/globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});
const notoSansKr = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  variable: '--font-noto-kr',
  display: 'swap',
});

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://aipajak.com';

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} - Platform Pajak Cerdas Indonesia`,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION || 'AI Pajak adalah platform pajak cerdas Indonesia. Hitung, lapor, dan optimalkan pajak Anda dengan teknologi AI terdepan.',
  keywords: [
    'pajak', 'tax', 'indonesia', 'ai pajak', 'spt tahunan', 'pph 21', 'ppn',
    'tax filing', 'e-filing', 'djp', 'npwp', 'efin', 'bukti potong',
    'konsultan pajak', 'tax consultant', 'umkm', 'pph final',
    'lapor pajak online', 'hitung pajak', 'tax calculator indonesia',
  ],
  authors: [{ name: 'AI Pajak', url: BASE_URL }],
  creator: 'AI Pajak by Mono Flip Global',
  publisher: 'Mono Flip Global',
  metadataBase: new URL(BASE_URL),
  alternates: {
    canonical: '/',
    languages: {
      'id': '/id',
      'en': '/en',
      'ko': '/ko',
    },
  },
  openGraph: {
    type: 'website',
    locale: 'id_ID',
    alternateLocale: ['en_US', 'ko_KR'],
    url: BASE_URL,
    siteName: APP_NAME,
    title: `${APP_NAME} - Platform Pajak Cerdas Indonesia`,
    description: 'Hitung, lapor, dan optimalkan pajak Anda dengan AI. SPT otomatis, OCR bukti potong, rekomendasi hemat pajak.',
    images: [
      {
        url: '/og-image.svg',
        width: 1200,
        height: 630,
        alt: 'AI Pajak - Platform Pajak Cerdas Indonesia',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${APP_NAME} - Platform Pajak Cerdas Indonesia`,
    description: 'Hitung, lapor, dan optimalkan pajak Anda dengan AI.',
    images: ['/og-image.svg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  manifest: '/manifest.json',
  themeColor: '#2563eb',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: APP_NAME,
  },
  formatDetection: {
    telephone: false,
  },
  verification: {
    // Add Google Search Console verification when available
    // google: 'your-verification-code',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'AI Pajak',
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    description: 'Platform pajak cerdas Indonesia dengan teknologi AI untuk hitung, lapor, dan optimalisasi pajak.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'IDR',
      description: 'Free tier available',
    },
    author: {
      '@type': 'Organization',
      name: 'Mono Flip Global',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '150',
    },
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${inter.variable} ${notoSansKr.variable} font-sans antialiased`} suppressHydrationWarning>
        <GoogleAnalytics />
        <WebVitals />
        <ServiceWorkerRegistration />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
