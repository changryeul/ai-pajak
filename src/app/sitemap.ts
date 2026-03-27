import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://aipajak.com';
const LOCALES = ['id', 'en', 'ko', 'ja', 'zh'];

export default function sitemap(): MetadataRoute.Sitemap {
  const publicPages = [
    { path: '', priority: 1.0, changeFrequency: 'weekly' as const },
    { path: '/login', priority: 0.8, changeFrequency: 'monthly' as const },
    { path: '/register', priority: 0.8, changeFrequency: 'monthly' as const },
    { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' as const },
    { path: '/terms', priority: 0.3, changeFrequency: 'yearly' as const },
  ];

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of LOCALES) {
    for (const page of publicPages) {
      entries.push({
        url: `${BASE_URL}/${locale}${page.path}`,
        lastModified: new Date(),
        changeFrequency: page.changeFrequency,
        priority: page.priority,
        alternates: {
          languages: Object.fromEntries(
            LOCALES.map(l => [l, `${BASE_URL}/${l}${page.path}`])
          ),
        },
      });
    }
  }

  return entries;
}
