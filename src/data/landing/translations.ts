import type { LandingContent, LandingModule, LandingPlan, SupportedLocale } from './types';
import autoTranslated from './auto-translated.json';

type RawBundle = {
  modules: LandingModule[];
  pricing: LandingPlan[];
  text: Omit<LandingContent, 'modules' | 'pricing'>;
};

function buildContent(data: RawBundle): LandingContent {
  return {
    ...data.text,
    modules: data.modules,
    pricing: data.pricing,
  };
}

const bundle = autoTranslated as unknown as Record<SupportedLocale, RawBundle>;

const contents: Record<SupportedLocale, LandingContent> = {
  ko: buildContent(bundle.ko),
  en: buildContent(bundle.en),
  id: buildContent(bundle.id),
  zh: buildContent(bundle.zh),
  ja: buildContent(bundle.ja),
};

export function getLandingContent(locale: string): LandingContent {
  return contents[locale as SupportedLocale] ?? contents.ko;
}
