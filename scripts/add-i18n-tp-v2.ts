import * as fs from 'fs';
import * as path from 'path';
const MESSAGES_DIR = path.resolve(process.cwd(), 'src/i18n/messages');
const LOCALES = ['id', 'en', 'ko', 'ja', 'zh'];
type Tr = Record<string, string>;

const K: Record<string, Tr> = {
  industryLabel: { id: 'Industri', en: 'Industry', ko: '업종', ja: '業種', zh: '行业' },
  annualRevenueLabel: { id: 'Pendapatan Tahunan (IDR)', en: 'Annual Revenue (IDR)', ko: '연간 매출 (IDR)', ja: '年間売上 (IDR)', zh: '年度营收 (IDR)' },
  transactionsTitle: { id: 'Transaksi Afiliasi', en: 'Related-Party Transactions', ko: '관계사 거래', ja: '関連当事者取引', zh: '关联方交易' },
  relatedParty: { id: 'Pihak Afiliasi', en: 'Related Party', ko: '관계 회사', ja: '関連当事者', zh: '关联方' },
  category: { id: 'Kategori', en: 'Category', ko: '분류', ja: 'カテゴリ', zh: '类别' },
  transactionTypeLabel: { id: 'Jenis', en: 'Type', ko: '유형', ja: '種類', zh: '类型' },
  amountLabel: { id: 'Nilai (Rp)', en: 'Amount (Rp)', ko: '금액 (Rp)', ja: '金額 (Rp)', zh: '金额 (Rp)' },
  marketPriceLabel: { id: 'Harga Pasar (Rp)', en: 'Market Price (Rp)', ko: '시장 가격 (Rp)', ja: '市場価格 (Rp)', zh: '市场价格 (Rp)' },
  functionsLabel: { id: 'Fungsi', en: 'Functions', ko: '기능', ja: '機能', zh: '职能' },
  functionsPlaceholder: {
    id: 'Mis: produksi, distribusi, pemasaran',
    en: 'e.g., manufacturing, distribution, marketing',
    ko: '예: 생산, 유통, 마케팅',
    ja: '例: 製造、流通、マーケティング',
    zh: '例如: 生产、分销、营销',
  },
  assetsLabel: { id: 'Aset', en: 'Assets', ko: '자산', ja: '資産', zh: '资产' },
  assetsPlaceholder: {
    id: 'Mis: mesin, merek, paten',
    en: 'e.g., machinery, trademarks, patents',
    ko: '예: 기계, 상표, 특허',
    ja: '例: 機械、商標、特許',
    zh: '例如: 机器、商标、专利',
  },
  risksLabel: { id: 'Risiko', en: 'Risks', ko: '리스크', ja: 'リスク', zh: '风险' },
  risksPlaceholder: {
    id: 'Mis: risiko pasar, kredit, valuta asing',
    en: 'e.g., market, credit, FX risk',
    ko: '예: 시장, 신용, 환율 리스크',
    ja: '例: 市場、信用、為替リスク',
    zh: '例如: 市场、信用、外汇风险',
  },
  addRow: { id: 'Tambah Transaksi', en: 'Add transaction', ko: '거래 추가', ja: '取引を追加', zh: '添加交易' },
  kpiTotal: { id: 'Total Transaksi', en: 'Total Tx', ko: '총 거래', ja: '総取引数', zh: '交易总数' },
  kpiArmLength: { id: 'Arm\'s Length', en: "Arm's Length", ko: '정상가격', ja: '独立企業間', zh: '公允价格' },
  kpiAdjustment: { id: 'Perlu Penyesuaian', en: 'Adjustment', ko: '조정 필요', ja: '調整必要', zh: '需调整' },
  kpiTotalAdjustment: { id: 'Total Penyesuaian', en: 'Total Adjustment', ko: '총 조정액', ja: '調整総額', zh: '总调整额' },
  complianceTitle: { id: 'Kepatuhan PMK 213/2016', en: 'PMK 213/2016 Compliance', ko: 'PMK 213/2016 준수', ja: 'PMK 213/2016準拠', zh: 'PMK 213/2016合规' },
  required: { id: 'Wajib', en: 'Required', ko: '필수', ja: '必須', zh: '必填' },
  notRequired: { id: 'Tidak Wajib', en: 'Not Required', ko: '해당 없음', ja: '不要', zh: '非必须' },
  perTxAnalysis: { id: 'Analisis per Transaksi', en: 'Per-Transaction Analysis', ko: '거래별 분석', ja: '取引別分析', zh: '逐项交易分析' },
};

for (const locale of LOCALES) {
  const fp = path.join(MESSAGES_DIR, `${locale}.json`);
  const c = JSON.parse(fs.readFileSync(fp, 'utf-8'));
  if (!c.transferPricing) c.transferPricing = {};
  for (const [k, tr] of Object.entries(K)) {
    c.transferPricing[k] = tr[locale] || tr['en'];
  }
  fs.writeFileSync(fp, JSON.stringify(c, null, 2) + '\n');
}
console.log('Done: transferPricing extras added');
