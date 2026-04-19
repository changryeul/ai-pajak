import * as fs from 'fs';
import * as path from 'path';
const MESSAGES_DIR = path.resolve(process.cwd(), 'src/i18n/messages');
const LOCALES = ['id', 'en', 'ko', 'ja', 'zh'];
type Tr = Record<string, string>;

const K: Record<string, Tr> = {
  kpiEntities: { id: 'Jumlah Entitas', en: 'Entities', ko: '등록 법인', ja: '登録エンティティ', zh: '企业数' },
  kpiOpenFilings: { id: 'Pelaporan Aktif', en: 'Open Filings', ko: '진행 중 신고', ja: '進行中申告', zh: '进行中申报' },
  kpiOverdue: { id: 'Terlambat', en: 'Overdue', ko: '기한 초과', ja: '期限超過', zh: '逾期' },
  kpiYtdTax: { id: 'Pajak YTD', en: 'Tax YTD', ko: '올해 납부 세액', ja: '今年度納税額', zh: '年内已缴税款' },
  upcomingTitle: { id: 'Tenggat Mendatang (45 hari)', en: 'Upcoming Deadlines (45 days)', ko: '임박 마감 (45일)', ja: '直近の期限（45日）', zh: '即将到期 (45天)' },
  daysLeft: { id: '{n} hari lagi', en: '{n} days left', ko: 'D-{n}', ja: 'あと{n}日', zh: '剩{n}天' },
  daysOverdue: { id: 'Terlambat {n} hari', en: '{n} days overdue', ko: '{n}일 연체', ja: '{n}日超過', zh: '逾期{n}天' },
  dueToday: { id: 'Hari ini', en: 'Due today', ko: '오늘 마감', ja: '本日期限', zh: '今日到期' },
  overdueChip: { id: '{n} terlambat', en: '{n} overdue', ko: '{n}건 연체', ja: '{n}件超過', zh: '{n}项逾期' },
  draft: { id: 'Draft', en: 'Draft', ko: '초안', ja: '下書き', zh: '草稿' },
  underReview: { id: 'Diperiksa', en: 'Under Review', ko: '검토 중', ja: '審査中', zh: '审核中' },
  filedYear: { id: 'Filed (Tahun Ini)', en: 'Filed (YTD)', ko: '신고 완료', ja: '申告済', zh: '已申报' },
  openQueue: { id: 'Antrean', en: 'Queue', ko: '진행 큐', ja: 'キュー', zh: '队列' },
  ytdTax: { id: 'Pajak YTD', en: 'Tax YTD', ko: 'YTD 납부', ja: 'YTD納税', zh: 'YTD税款' },
  nextDeadline: { id: 'Tenggat berikut', en: 'Next deadline', ko: '다음 마감', ja: '次の期限', zh: '下一期限' },
  actMonthly: { id: 'Pelaporan Bulanan', en: 'Monthly Filing', ko: '월 신고', ja: '月次申告', zh: '月度申报' },
  actBilling: { id: 'ID Billing', en: 'ID Billing', ko: 'ID Billing', ja: 'ID Billing', zh: 'ID Billing' },
  filings: { id: 'Pelaporan', en: 'Filings', ko: '신고 수', ja: '申告数', zh: '申报数' },
  overdueHeader: { id: 'Terlambat', en: 'Overdue', ko: '연체', ja: '超過', zh: '逾期' },
  statusBreakdown: {
    id: 'Distribusi Status (Seluruh Entitas)',
    en: 'Status Breakdown (All Entities)',
    ko: '상태 분포 (전체 법인)',
    ja: 'ステータス内訳（全エンティティ）',
    zh: '状态分布（所有企业）',
  },
};

for (const locale of LOCALES) {
  const fp = path.join(MESSAGES_DIR, `${locale}.json`);
  const c = JSON.parse(fs.readFileSync(fp, 'utf-8'));
  if (!c.multiEntity) c.multiEntity = {};
  for (const [k, tr] of Object.entries(K)) {
    c.multiEntity[k] = tr[locale] || tr['en'];
  }
  fs.writeFileSync(fp, JSON.stringify(c, null, 2) + '\n');
}
console.log('Done: multiEntity extras added');
