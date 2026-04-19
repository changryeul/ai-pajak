import * as fs from 'fs';
import * as path from 'path';
const MESSAGES_DIR = path.resolve(process.cwd(), 'src/i18n/messages');
const LOCALES = ['id', 'en', 'ko', 'ja', 'zh'];
type Tr = Record<string, string>;

const K: Record<string, Tr> = {
  headerTitleS: {
    id: 'Input Data Pelaporan 1770S',
    en: '1770S Filing Intake',
    ko: '1770S 신고 자료 입력',
    ja: '1770S申告データ入力',
    zh: '1770S申报数据录入',
  },
  headerTitleFull: {
    id: 'Input Data Pelaporan 1770',
    en: '1770 Filing Intake',
    ko: '1770 신고 자료 입력',
    ja: '1770申告データ入力',
    zh: '1770申报数据录入',
  },
  businessIncomeTitle: {
    id: 'Data Penghasilan Usaha',
    en: 'Business Income Documents',
    ko: '사업소득 자료',
    ja: '事業所得資料',
    zh: '经营收入资料',
  },
  pph23Placeholder: {
    id: 'PPh 23 / 26 (선택)',
    en: 'PPh 23 / 26 (optional)',
    ko: 'PPh 23 (선택)',
    ja: 'PPh 23（任意）',
    zh: 'PPh 23 (可选)',
  },
};

for (const locale of LOCALES) {
  const fp = path.join(MESSAGES_DIR, `${locale}.json`);
  const c = JSON.parse(fs.readFileSync(fp, 'utf-8'));
  if (!c.sptIntake) c.sptIntake = {};
  for (const [k, tr] of Object.entries(K)) {
    c.sptIntake[k] = tr[locale] || tr['en'] || '';
  }
  fs.writeFileSync(fp, JSON.stringify(c, null, 2) + '\n');
}
console.log('Done: sptIntake extended keys added');
