import * as fs from 'fs';
import * as path from 'path';
const MESSAGES_DIR = path.resolve(process.cwd(), 'src/i18n/messages');
const LOCALES = ['id', 'en', 'ko', 'ja', 'zh'];
type Tr = Record<string, string>;

const K: Record<string, Tr> = {
  aiTotalThisYear: {
    id: 'Total pajak tahun ini',
    en: 'Total tax this year',
    ko: '올해 총 세액',
    ja: '今年の税額合計',
    zh: '今年税额合计',
  },
  aiUnpaidWarning: {
    id: 'Pajak belum dibayar {amount} — segera lunasi',
    en: '{amount} unpaid — settle soon to avoid penalties',
    ko: '미납 세액 {amount} — 가산세 전에 납부하세요',
    ja: '未納税額 {amount} — 加算税前に納付してください',
    zh: '未缴税款 {amount} — 请尽快缴纳以免滞纳金',
  },
  aiUpcomingCount: {
    id: '{count} pelaporan yang akan datang',
    en: '{count} upcoming filings',
    ko: '예정된 신고 {count}건',
    ja: '予定申告 {count}件',
    zh: '即将到来的申报 {count} 件',
  },
  aiAllClear: {
    id: 'Semua pelaporan bersih — tidak ada tindakan mendesak',
    en: 'All filings clear — no urgent action',
    ko: '모든 신고가 정상입니다 — 긴급 조치 없음',
    ja: 'すべての申告は正常 — 緊急対応なし',
    zh: '所有申报正常 — 无紧急处理事项',
  },
  ctaMonthlyFiling: {
    id: 'Pelaporan Bulanan',
    en: 'Monthly Filing',
    ko: '월간 신고',
    ja: '月次申告',
    zh: '月度申报',
  },
};

for (const locale of LOCALES) {
  const fp = path.join(MESSAGES_DIR, `${locale}.json`);
  const c = JSON.parse(fs.readFileSync(fp, 'utf-8'));
  if (!c.corpDashboardV2) c.corpDashboardV2 = {};
  for (const [k, tr] of Object.entries(K)) {
    c.corpDashboardV2[k] = tr[locale] || tr['en'] || '';
  }
  fs.writeFileSync(fp, JSON.stringify(c, null, 2) + '\n');
}
console.log('Done: corpDashboardV2 extras added');
