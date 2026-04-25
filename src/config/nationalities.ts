/**
 * Common nationality list for the customer profile form.
 *
 * ISO 3166-1 alpha-2 code + localized label for each of the 5 app locales.
 * Ordered by regional adjacency to Indonesia / likelihood of appearance
 * among JTC customers: Indonesia first, then East/SE Asia, then the rest.
 */

export type Locale = 'ko' | 'en' | 'id' | 'ja' | 'zh';

export interface Nationality {
  code: string;          // ISO 3166-1 alpha-2
  labels: Record<Locale, string>;
}

export const NATIONALITIES: Nationality[] = [
  { code: 'ID', labels: { ko: '인도네시아', en: 'Indonesia', id: 'Indonesia', ja: 'インドネシア', zh: '印度尼西亚' } },
  { code: 'KR', labels: { ko: '대한민국', en: 'South Korea', id: 'Korea Selatan', ja: '韓国', zh: '韩国' } },
  { code: 'JP', labels: { ko: '일본', en: 'Japan', id: 'Jepang', ja: '日本', zh: '日本' } },
  { code: 'CN', labels: { ko: '중국', en: 'China', id: 'Tiongkok', ja: '中国', zh: '中国' } },
  { code: 'TW', labels: { ko: '대만', en: 'Taiwan', id: 'Taiwan', ja: '台湾', zh: '台湾' } },
  { code: 'HK', labels: { ko: '홍콩', en: 'Hong Kong', id: 'Hong Kong', ja: '香港', zh: '香港' } },
  { code: 'SG', labels: { ko: '싱가포르', en: 'Singapore', id: 'Singapura', ja: 'シンガポール', zh: '新加坡' } },
  { code: 'MY', labels: { ko: '말레이시아', en: 'Malaysia', id: 'Malaysia', ja: 'マレーシア', zh: '马来西亚' } },
  { code: 'TH', labels: { ko: '태국', en: 'Thailand', id: 'Thailand', ja: 'タイ', zh: '泰国' } },
  { code: 'VN', labels: { ko: '베트남', en: 'Vietnam', id: 'Vietnam', ja: 'ベトナム', zh: '越南' } },
  { code: 'PH', labels: { ko: '필리핀', en: 'Philippines', id: 'Filipina', ja: 'フィリピン', zh: '菲律宾' } },
  { code: 'MM', labels: { ko: '미얀마', en: 'Myanmar', id: 'Myanmar', ja: 'ミャンマー', zh: '缅甸' } },
  { code: 'KH', labels: { ko: '캄보디아', en: 'Cambodia', id: 'Kamboja', ja: 'カンボジア', zh: '柬埔寨' } },
  { code: 'LA', labels: { ko: '라오스', en: 'Laos', id: 'Laos', ja: 'ラオス', zh: '老挝' } },
  { code: 'BN', labels: { ko: '브루나이', en: 'Brunei', id: 'Brunei', ja: 'ブルネイ', zh: '文莱' } },
  { code: 'IN', labels: { ko: '인도', en: 'India', id: 'India', ja: 'インド', zh: '印度' } },
  { code: 'PK', labels: { ko: '파키스탄', en: 'Pakistan', id: 'Pakistan', ja: 'パキスタン', zh: '巴基斯坦' } },
  { code: 'BD', labels: { ko: '방글라데시', en: 'Bangladesh', id: 'Bangladesh', ja: 'バングラデシュ', zh: '孟加拉国' } },
  { code: 'LK', labels: { ko: '스리랑카', en: 'Sri Lanka', id: 'Sri Lanka', ja: 'スリランカ', zh: '斯里兰卡' } },
  { code: 'NP', labels: { ko: '네팔', en: 'Nepal', id: 'Nepal', ja: 'ネパール', zh: '尼泊尔' } },
  { code: 'AU', labels: { ko: '호주', en: 'Australia', id: 'Australia', ja: 'オーストラリア', zh: '澳大利亚' } },
  { code: 'NZ', labels: { ko: '뉴질랜드', en: 'New Zealand', id: 'Selandia Baru', ja: 'ニュージーランド', zh: '新西兰' } },
  { code: 'US', labels: { ko: '미국', en: 'United States', id: 'Amerika Serikat', ja: 'アメリカ', zh: '美国' } },
  { code: 'CA', labels: { ko: '캐나다', en: 'Canada', id: 'Kanada', ja: 'カナダ', zh: '加拿大' } },
  { code: 'MX', labels: { ko: '멕시코', en: 'Mexico', id: 'Meksiko', ja: 'メキシコ', zh: '墨西哥' } },
  { code: 'BR', labels: { ko: '브라질', en: 'Brazil', id: 'Brasil', ja: 'ブラジル', zh: '巴西' } },
  { code: 'AR', labels: { ko: '아르헨티나', en: 'Argentina', id: 'Argentina', ja: 'アルゼンチン', zh: '阿根廷' } },
  { code: 'GB', labels: { ko: '영국', en: 'United Kingdom', id: 'Britania Raya', ja: 'イギリス', zh: '英国' } },
  { code: 'IE', labels: { ko: '아일랜드', en: 'Ireland', id: 'Irlandia', ja: 'アイルランド', zh: '爱尔兰' } },
  { code: 'DE', labels: { ko: '독일', en: 'Germany', id: 'Jerman', ja: 'ドイツ', zh: '德国' } },
  { code: 'FR', labels: { ko: '프랑스', en: 'France', id: 'Prancis', ja: 'フランス', zh: '法国' } },
  { code: 'IT', labels: { ko: '이탈리아', en: 'Italy', id: 'Italia', ja: 'イタリア', zh: '意大利' } },
  { code: 'ES', labels: { ko: '스페인', en: 'Spain', id: 'Spanyol', ja: 'スペイン', zh: '西班牙' } },
  { code: 'PT', labels: { ko: '포르투갈', en: 'Portugal', id: 'Portugal', ja: 'ポルトガル', zh: '葡萄牙' } },
  { code: 'NL', labels: { ko: '네덜란드', en: 'Netherlands', id: 'Belanda', ja: 'オランダ', zh: '荷兰' } },
  { code: 'BE', labels: { ko: '벨기에', en: 'Belgium', id: 'Belgia', ja: 'ベルギー', zh: '比利时' } },
  { code: 'CH', labels: { ko: '스위스', en: 'Switzerland', id: 'Swiss', ja: 'スイス', zh: '瑞士' } },
  { code: 'AT', labels: { ko: '오스트리아', en: 'Austria', id: 'Austria', ja: 'オーストリア', zh: '奥地利' } },
  { code: 'SE', labels: { ko: '스웨덴', en: 'Sweden', id: 'Swedia', ja: 'スウェーデン', zh: '瑞典' } },
  { code: 'NO', labels: { ko: '노르웨이', en: 'Norway', id: 'Norwegia', ja: 'ノルウェー', zh: '挪威' } },
  { code: 'DK', labels: { ko: '덴마크', en: 'Denmark', id: 'Denmark', ja: 'デンマーク', zh: '丹麦' } },
  { code: 'FI', labels: { ko: '핀란드', en: 'Finland', id: 'Finlandia', ja: 'フィンランド', zh: '芬兰' } },
  { code: 'PL', labels: { ko: '폴란드', en: 'Poland', id: 'Polandia', ja: 'ポーランド', zh: '波兰' } },
  { code: 'RU', labels: { ko: '러시아', en: 'Russia', id: 'Rusia', ja: 'ロシア', zh: '俄罗斯' } },
  { code: 'TR', labels: { ko: '튀르키예', en: 'Türkiye', id: 'Turki', ja: 'トルコ', zh: '土耳其' } },
  { code: 'AE', labels: { ko: 'UAE', en: 'UAE', id: 'UEA', ja: 'アラブ首長国連邦', zh: '阿联酋' } },
  { code: 'SA', labels: { ko: '사우디아라비아', en: 'Saudi Arabia', id: 'Arab Saudi', ja: 'サウジアラビア', zh: '沙特阿拉伯' } },
  { code: 'QA', labels: { ko: '카타르', en: 'Qatar', id: 'Qatar', ja: 'カタール', zh: '卡塔尔' } },
  { code: 'IL', labels: { ko: '이스라엘', en: 'Israel', id: 'Israel', ja: 'イスラエル', zh: '以色列' } },
  { code: 'EG', labels: { ko: '이집트', en: 'Egypt', id: 'Mesir', ja: 'エジプト', zh: '埃及' } },
  { code: 'ZA', labels: { ko: '남아프리카공화국', en: 'South Africa', id: 'Afrika Selatan', ja: '南アフリカ', zh: '南非' } },
  { code: 'NG', labels: { ko: '나이지리아', en: 'Nigeria', id: 'Nigeria', ja: 'ナイジェリア', zh: '尼日利亚' } },
  { code: 'OTHER', labels: { ko: '기타', en: 'Other', id: 'Lainnya', ja: 'その他', zh: '其他' } },
];

export function nationalityLabel(code: string | null | undefined, locale: Locale): string {
  if (!code) return '';
  const n = NATIONALITIES.find((x) => x.code === code);
  return n ? n.labels[locale] : code;
}
