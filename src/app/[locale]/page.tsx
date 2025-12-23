import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

export default async function LocaleHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Redirect to dashboard or login
  redirect(`/${locale}/login`);
}
