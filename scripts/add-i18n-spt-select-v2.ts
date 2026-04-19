import * as fs from 'fs';
import * as path from 'path';
const MESSAGES_DIR = path.resolve(process.cwd(), 'src/i18n/messages');
const LOCALES = ['id', 'en', 'ko', 'ja', 'zh'];
type Tr = Record<string, string>;

const K: Record<string, Tr> = {
  pageSubtitle: {
    id: 'Pilih formulir Pelaporan Tahunan sesuai situasi Anda',
    en: 'Select the annual filing form that fits your situation',
    ko: '상황에 맞는 연간 세금 신고서를 선택하세요',
    ja: 'ご状況に合った年次申告書を選択してください',
    zh: '请根据您的情况选择年度申报表',
  },
  // Card subtitles (1-liner above bullet list)
  ssSubtitle: {
    id: 'Pelaporan sangat sederhana',
    en: 'Very simple individual filing',
    ko: '매우 간단한 개인 신고',
    ja: '非常にシンプルな個人申告',
    zh: '极简个人申报',
  },
  sSubtitle: {
    id: 'Karyawan biasa',
    en: 'Standard employee',
    ko: '일반 직장인',
    ja: '一般会社員',
    zh: '普通职员',
  },
  fullSubtitle: {
    id: 'Pelaku usaha / penghasilan kompleks',
    en: 'Business owner / mixed income',
    ko: '사업자 / 복합소득',
    ja: '事業主・混合所得',
    zh: '个体户 / 复合收入',
  },

  // 1770SS bullets
  ssBul1: { id: 'Penghasilan ≤ Rp 60 juta/tahun', en: 'Annual income ≤ Rp 60M', ko: '연소득 약 Rp 60 juta 이하', ja: '年収6,000万ルピア以下', zh: '年收入≤6000万卢比' },
  ssBul2: { id: 'Satu pemberi kerja saja', en: 'Only one employer', ko: '근로소득 1곳만 있는 경우', ja: '給与所得が1社のみ', zh: '仅有一个雇主' },
  ssBul3: { id: 'Aset/utang sederhana', en: 'Simple assets/liabilities', ko: '자산/부채가 단순한 경우', ja: '資産・負債がシンプル', zh: '资产/负债简单' },
  ssBul4: { id: 'Tidak ada penghasilan tambahan', en: 'No additional income', ko: '추가 소득 없음', ja: '追加所得なし', zh: '无额外收入' },

  // 1770S bullets
  sBul1: { id: 'Penghasilan > Rp 60 juta/tahun', en: 'Annual income > Rp 60M', ko: '연소득 60 juta 이상', ja: '年収6,000万ルピア超', zh: '年收入 > 6000万卢比' },
  sBul2: { id: '1~2 pemberi kerja', en: '1–2 employers', ko: '근로소득 1~2곳', ja: '給与所得1〜2社', zh: '1~2个雇主' },
  sBul3: { id: 'Sebagian penghasilan keuangan', en: 'Some financial income', ko: '금융소득 일부', ja: '金融所得の一部', zh: '部分金融收入' },

  // 1770 bullets
  fullBul1: { id: 'Punya penghasilan usaha', en: 'Has business income', ko: '사업소득 있음', ja: '事業所得あり', zh: '有经营收入' },
  fullBul2: { id: 'Penghasilan kompleks', en: 'Mixed / complex income', ko: '복합소득', ja: '複合所得', zh: '复合收入' },

  // Select CTA
  selectCta: { id: 'Pilih', en: 'Select', ko: '선택하기', ja: '選択する', zh: '选择' },

  // AI recommendation card
  aiCardTitle: {
    id: 'Rekomendasi AI',
    en: 'AI Recommendation',
    ko: 'AI 추천',
    ja: 'AIのおすすめ',
    zh: 'AI推荐',
  },
  aiHasBusiness: {
    id: 'Punya penghasilan usaha',
    en: 'Has business income',
    ko: '사업소득 있음',
    ja: '事業所得あり',
    zh: '有经营收入',
  },
  aiMultipleEmployers: {
    id: 'Punya 2+ pemberi kerja',
    en: 'Has 2+ employers',
    ko: '근로소득 2곳 이상',
    ja: '給与所得2社以上',
    zh: '有2个以上雇主',
  },
  aiFinancialIncome: {
    id: 'Punya penghasilan keuangan',
    en: 'Has financial income',
    ko: '금융소득 있음',
    ja: '金融所得あり',
    zh: '有金融收入',
  },
  aiApplyCta: {
    id: 'Terapkan Rekomendasi AI',
    en: 'Apply AI Recommendation',
    ko: 'AI 추천 적용하기',
    ja: 'AIのおすすめを適用',
    zh: '应用AI推荐',
  },
  aiResultPrefix: {
    id: 'Rekomendasi:',
    en: 'Recommended:',
    ko: '추천:',
    ja: 'おすすめ:',
    zh: '推荐:',
  },
};

for (const locale of LOCALES) {
  const fp = path.join(MESSAGES_DIR, `${locale}.json`);
  const c = JSON.parse(fs.readFileSync(fp, 'utf-8'));
  if (!c.sptSelectV2) c.sptSelectV2 = {};
  for (const [k, tr] of Object.entries(K)) {
    c.sptSelectV2[k] = tr[locale] || tr['en'] || '';
  }
  fs.writeFileSync(fp, JSON.stringify(c, null, 2) + '\n');
}
console.log('Done: sptSelectV2 added');
