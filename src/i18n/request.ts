import { getRequestConfig } from 'next-intl/server';
import { Locale, LOCALES, DEFAULT_LOCALE } from '@/config/constants';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !LOCALES.includes(locale as Locale)) {
    locale = DEFAULT_LOCALE;
  }

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
    // 누락 키가 발생해도 페이지를 깨뜨리지 않고 raw key를 fallback으로 보여준다.
    // 운영팀 화면처럼 enum 값(API status, event_type 등)을 직접 키로 받는 곳에서
    // 새 enum이 추가되었을 때 페이지가 죽지 않도록 방어.
    onError(error) {
      if (error.code === 'MISSING_MESSAGE') {
        if (typeof console !== 'undefined') console.warn(`[i18n] missing: ${error.message}`);
        return;
      }
      console.error('[i18n]', error);
    },
    getMessageFallback({ namespace, key }) {
      return namespace ? `${namespace}.${key}` : key;
    },
  };
});
