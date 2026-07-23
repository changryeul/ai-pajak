/**
 * Common nationality list for the customer profile form.
 *
 * ISO 3166-1 alpha-2 code + localized label for each of the 3 app locales (ko/en/id).
 * Ordered by regional adjacency to Indonesia / likelihood of appearance
 * among JTC customers: Indonesia first, then East/SE Asia, then the rest.
 */

export type Locale = 'ko' | 'en' | 'id';

export interface Nationality {
  code: string;          // ISO 3166-1 alpha-2
  labels: Record<Locale, string>;
}

export const NATIONALITIES: Nationality[] = [
  { code: 'ID', labels: { ko: '인도네시아', en: 'Indonesia', id: 'Indonesia' } },
  { code: 'KR', labels: { ko: '대한민국', en: 'South Korea', id: 'Korea Selatan' } },
  { code: 'JP', labels: { ko: '일본', en: 'Japan', id: 'Jepang' } },
  { code: 'CN', labels: { ko: '중국', en: 'China', id: 'Tiongkok' } },
  { code: 'TW', labels: { ko: '대만', en: 'Taiwan', id: 'Taiwan' } },
  { code: 'HK', labels: { ko: '홍콩', en: 'Hong Kong', id: 'Hong Kong' } },
  { code: 'SG', labels: { ko: '싱가포르', en: 'Singapore', id: 'Singapura' } },
  { code: 'MY', labels: { ko: '말레이시아', en: 'Malaysia', id: 'Malaysia' } },
  { code: 'TH', labels: { ko: '태국', en: 'Thailand', id: 'Thailand' } },
  { code: 'VN', labels: { ko: '베트남', en: 'Vietnam', id: 'Vietnam' } },
  { code: 'PH', labels: { ko: '필리핀', en: 'Philippines', id: 'Filipina' } },
  { code: 'MM', labels: { ko: '미얀마', en: 'Myanmar', id: 'Myanmar' } },
  { code: 'KH', labels: { ko: '캄보디아', en: 'Cambodia', id: 'Kamboja' } },
  { code: 'LA', labels: { ko: '라오스', en: 'Laos', id: 'Laos' } },
  { code: 'BN', labels: { ko: '브루나이', en: 'Brunei', id: 'Brunei' } },
  { code: 'IN', labels: { ko: '인도', en: 'India', id: 'India' } },
  { code: 'PK', labels: { ko: '파키스탄', en: 'Pakistan', id: 'Pakistan' } },
  { code: 'BD', labels: { ko: '방글라데시', en: 'Bangladesh', id: 'Bangladesh' } },
  { code: 'LK', labels: { ko: '스리랑카', en: 'Sri Lanka', id: 'Sri Lanka' } },
  { code: 'NP', labels: { ko: '네팔', en: 'Nepal', id: 'Nepal' } },
  { code: 'AU', labels: { ko: '호주', en: 'Australia', id: 'Australia' } },
  { code: 'NZ', labels: { ko: '뉴질랜드', en: 'New Zealand', id: 'Selandia Baru' } },
  { code: 'US', labels: { ko: '미국', en: 'United States', id: 'Amerika Serikat' } },
  { code: 'CA', labels: { ko: '캐나다', en: 'Canada', id: 'Kanada' } },
  { code: 'MX', labels: { ko: '멕시코', en: 'Mexico', id: 'Meksiko' } },
  { code: 'BR', labels: { ko: '브라질', en: 'Brazil', id: 'Brasil' } },
  { code: 'AR', labels: { ko: '아르헨티나', en: 'Argentina', id: 'Argentina' } },
  { code: 'GB', labels: { ko: '영국', en: 'United Kingdom', id: 'Britania Raya' } },
  { code: 'IE', labels: { ko: '아일랜드', en: 'Ireland', id: 'Irlandia' } },
  { code: 'DE', labels: { ko: '독일', en: 'Germany', id: 'Jerman' } },
  { code: 'FR', labels: { ko: '프랑스', en: 'France', id: 'Prancis' } },
  { code: 'IT', labels: { ko: '이탈리아', en: 'Italy', id: 'Italia' } },
  { code: 'ES', labels: { ko: '스페인', en: 'Spain', id: 'Spanyol' } },
  { code: 'PT', labels: { ko: '포르투갈', en: 'Portugal', id: 'Portugal' } },
  { code: 'NL', labels: { ko: '네덜란드', en: 'Netherlands', id: 'Belanda' } },
  { code: 'BE', labels: { ko: '벨기에', en: 'Belgium', id: 'Belgia' } },
  { code: 'CH', labels: { ko: '스위스', en: 'Switzerland', id: 'Swiss' } },
  { code: 'AT', labels: { ko: '오스트리아', en: 'Austria', id: 'Austria' } },
  { code: 'SE', labels: { ko: '스웨덴', en: 'Sweden', id: 'Swedia' } },
  { code: 'NO', labels: { ko: '노르웨이', en: 'Norway', id: 'Norwegia' } },
  { code: 'DK', labels: { ko: '덴마크', en: 'Denmark', id: 'Denmark' } },
  { code: 'FI', labels: { ko: '핀란드', en: 'Finland', id: 'Finlandia' } },
  { code: 'PL', labels: { ko: '폴란드', en: 'Poland', id: 'Polandia' } },
  { code: 'RU', labels: { ko: '러시아', en: 'Russia', id: 'Rusia' } },
  { code: 'TR', labels: { ko: '튀르키예', en: 'Türkiye', id: 'Turki' } },
  { code: 'AE', labels: { ko: 'UAE', en: 'UAE', id: 'UEA' } },
  { code: 'SA', labels: { ko: '사우디아라비아', en: 'Saudi Arabia', id: 'Arab Saudi' } },
  { code: 'QA', labels: { ko: '카타르', en: 'Qatar', id: 'Qatar' } },
  { code: 'IL', labels: { ko: '이스라엘', en: 'Israel', id: 'Israel' } },
  { code: 'EG', labels: { ko: '이집트', en: 'Egypt', id: 'Mesir' } },
  { code: 'ZA', labels: { ko: '남아프리카공화국', en: 'South Africa', id: 'Afrika Selatan' } },
  { code: 'NG', labels: { ko: '나이지리아', en: 'Nigeria', id: 'Nigeria' } },
  { code: 'OTHER', labels: { ko: '기타', en: 'Other', id: 'Lainnya' } },
];

export function nationalityLabel(code: string | null | undefined, locale: Locale): string {
  if (!code) return '';
  const n = NATIONALITIES.find((x) => x.code === code);
  return n ? n.labels[locale] : code;
}
