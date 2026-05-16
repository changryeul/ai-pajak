import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import LandingPage from '@/components/landing/LandingPage';
import { getLandingContent } from '@/data/landing/translations';

const OG_LOCALE: Record<string, string> = {
  ko: 'ko_KR',
  en: 'en_US',
  id: 'id_ID',
  ja: 'ja_JP',
  zh: 'zh_CN',
};

const ALL_LOCALES = ['ko', 'en', 'id', 'ja', 'zh'] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const content = getLandingContent(locale);
  const title = `AI Pajak — ${content.heroMain}`;
  const description = content.heroDesc;
  const ogLocale = OG_LOCALE[locale] ?? 'id_ID';

  const languages = Object.fromEntries(
    ALL_LOCALES.map((l) => [l, `/${l}`]),
  ) as Record<string, string>;

  return {
    title,
    description,
    alternates: {
      canonical: `/${locale}`,
      languages,
    },
    openGraph: {
      type: 'website',
      url: `/${locale}`,
      siteName: 'AI Pajak',
      locale: ogLocale,
      alternateLocale: Object.values(OG_LOCALE).filter((l) => l !== ogLocale),
      title,
      description,
      images: [
        {
          url: '/og-image.svg',
          width: 1200,
          height: 630,
          alt: 'AI Pajak — Indonesian Tax Filing Automation',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/og-image.svg'],
    },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LandingPage locale={locale} />;
}
