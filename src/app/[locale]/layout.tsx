import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { LOCALES, type Locale } from '@/config/constants';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { Toaster } from '@/components/ui/sonner';

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!LOCALES.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <NextIntlClientProvider
      messages={messages}
      onError={(error) => {
        if (error.code === 'MISSING_MESSAGE') {
          if (typeof console !== 'undefined') console.warn('[i18n]', error.message);
          return;
        }
        console.error('[i18n]', error);
      }}
      getMessageFallback={({ namespace, key }) => namespace ? `${namespace}.${key}` : key}
    >
      {children}
      <InstallPrompt />
      <Toaster position="top-right" richColors />
    </NextIntlClientProvider>
  );
}
