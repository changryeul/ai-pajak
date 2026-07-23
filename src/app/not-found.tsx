import Link from 'next/link';
import { headers } from 'next/headers';
import { FileQuestion, ArrowLeft } from 'lucide-react';

/**
 * Root not-found — reached when a URL falls outside every matched route,
 * including the locale segment. We parse the incoming pathname (and fall
 * back to Accept-Language) so the user stays in their current language
 * instead of being dropped into Indonesian.
 *
 * The locale-scoped version lives at src/app/[locale]/not-found.tsx and
 * is used when the /[locale] prefix matches but a child route does not.
 */

type Locale = 'id' | 'en' | 'ko';
const LOCALES: readonly Locale[] = ['id', 'en', 'ko'];

const COPY: Record<Locale, { title: string; description: string; back: string }> = {
  id: {
    title: 'Halaman tidak ditemukan',
    description: 'Halaman yang Anda cari tidak tersedia atau telah dipindahkan.',
    back: 'Kembali ke Dasbor',
  },
  en: {
    title: 'Page not found',
    description: 'The page you are looking for is unavailable or has been moved.',
    back: 'Back to Dashboard',
  },
  ko: {
    title: '페이지를 찾을 수 없습니다',
    description: '요청하신 페이지가 존재하지 않거나 이동되었습니다.',
    back: '대시보드로 돌아가기',
  },
};

async function detectLocale(): Promise<Locale> {
  try {
    const h = await headers();
    const path =
      h.get('x-invoke-path') ||
      h.get('x-pathname') ||
      h.get('referer') ||
      '';
    for (const l of LOCALES) {
      if (path.includes(`/${l}/`) || path.endsWith(`/${l}`)) return l;
    }
    const al = (h.get('accept-language') || '').toLowerCase();
    for (const l of LOCALES) {
      if (al.startsWith(l)) return l;
    }
  } catch {
    // Missing headers in some build contexts — fall through
  }
  return 'id';
}

export default async function NotFound() {
  const locale = await detectLocale();
  const copy = COPY[locale];
  return (
    <html lang={locale}>
      <body className="bg-gray-50">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileQuestion className="h-8 w-8 text-blue-500" />
            </div>
            <p className="text-xs font-mono text-gray-400 mb-2">404</p>
            <h1 className="text-xl font-bold text-gray-900 mb-2">{copy.title}</h1>
            <p className="text-sm text-gray-500 mb-6">{copy.description}</p>
            <Link
              href={`/${locale}/dashboard`}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white text-sm font-medium hover:bg-blue-700"
            >
              <ArrowLeft className="h-4 w-4" />
              {copy.back}
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
