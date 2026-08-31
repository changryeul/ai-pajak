import { getRequestConfig } from 'next-intl/server';
import { Locale, LOCALES, DEFAULT_LOCALE } from '@/config/constants';

/** en(베이스) 위에 로케일 메시지를 덮어쓰는 깊은 병합. 번역 누락 시 en 으로 폴백. */
function deepMerge(base: Record<string, unknown>, over: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(over)) {
    const b = out[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && b && typeof b === 'object' && !Array.isArray(b)) {
      out[k] = deepMerge(b as Record<string, unknown>, v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !LOCALES.includes(locale as Locale)) {
    locale = DEFAULT_LOCALE;
  }

  // 로케일 메시지를 로드하되, en 을 폴백 베이스로 병합한다.
  // ja/zh 처럼 일부 네임스페이스(예: 운영팀 전용)가 번역되지 않은 경우,
  // 누락 키가 raw "namespace.key" 대신 영어로 표시되도록 한다.
  const localeMessages = (await import(`./messages/${locale}.json`)).default as Record<string, unknown>;
  let messages = localeMessages;
  if (locale !== 'en') {
    const enMessages = (await import('./messages/en.json')).default as Record<string, unknown>;
    messages = deepMerge(enMessages, localeMessages);
  }

  return {
    locale,
    messages,
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
