import * as fs from 'fs';
import * as path from 'path';
const MESSAGES_DIR = path.resolve(process.cwd(), 'src/i18n/messages');
const LOCALES = ['id', 'en', 'ko', 'ja', 'zh'];
type Tr = Record<string, string>;

const K: Record<string, Tr> = {
  overLimitBody: {
    id: 'Melebihi batas klien paket — upgrade untuk tetap patuh',
    en: 'Client count exceeds tier limit — upgrade to stay compliant',
    ko: '고객 수가 플랜 한도를 초과했습니다 — 업그레이드 필요',
    ja: '顧客数がプラン上限を超過しています — アップグレードが必要です',
    zh: '客户数超出方案上限 — 请升级',
  },
  nearLimitBody: {
    id: 'Mendekati batas {max} klien — pertimbangkan upgrade',
    en: 'Approaching {max}-client limit — consider upgrading',
    ko: '고객 한도 {max}명에 근접 — 업그레이드 검토',
    ja: '顧客上限{max}名に近づいています — アップグレードを検討',
    zh: '接近{max}位客户上限 — 请考虑升级',
  },
};

for (const locale of LOCALES) {
  const fp = path.join(MESSAGES_DIR, `${locale}.json`);
  const c = JSON.parse(fs.readFileSync(fp, 'utf-8'));
  if (!c.consultantTier) c.consultantTier = {};
  for (const [k, tr] of Object.entries(K)) {
    c.consultantTier[k] = tr[locale] || tr['en'] || '';
  }
  fs.writeFileSync(fp, JSON.stringify(c, null, 2) + '\n');
}
console.log('Done: consultantTier limit keys added');
