import * as fs from 'fs';
import * as path from 'path';
const MESSAGES_DIR = path.resolve(process.cwd(), 'src/i18n/messages');
const LOCALES = ['id', 'en', 'ko', 'ja', 'zh'];
type Tr = Record<string, string>;

const K: Record<string, Tr> = {
  headerTitle: { id: 'Langganan Firma Pajak', en: 'Consultant Firm Subscription', ko: '세무 사무소 구독', ja: '税理士事務所サブスク', zh: '税务咨询所订阅' },
  headerSubtitle: {
    id: 'Ringkasan langganan untuk {partner}',
    en: 'Subscription summary for {partner}',
    ko: '{partner}의 구독 요약',
    ja: '{partner}のサブスク概要',
    zh: '{partner}的订阅摘要',
  },
  noAccess: {
    id: 'Halaman ini hanya untuk konsultan kantor pajak eksternal',
    en: 'This page is only for external tax-firm consultants',
    ko: '이 페이지는 외부 세무 사무소 컨설턴트 전용입니다',
    ja: 'このページは外部税理士事務所コンサルタント専用です',
    zh: '本页仅供外部税务咨询所顾问使用',
  },
  monthlyFee: { id: 'Biaya Bulanan', en: 'Monthly Fee', ko: '월 요금', ja: '月額料金', zh: '月费' },
  renewsOn: { id: 'Pembaruan Pada', en: 'Renews On', ko: '갱신일', ja: '更新日', zh: '续订日' },
  status: { id: 'Status', en: 'Status', ko: '상태', ja: 'ステータス', zh: '状态' },
  clientCapacity: { id: 'Kapasitas Klien', en: 'Client Capacity', ko: '고객 한도', ja: '顧客キャパシティ', zh: '客户容量' },
  availableTiers: { id: 'Tier Tersedia', en: 'Available Tiers', ko: '사용 가능 티어', ja: '利用可能なティア', zh: '可用级别' },
  nearLimitTitle: { id: 'Mendekati batas klien', en: 'Approaching client limit', ko: '고객 한도 근접', ja: '顧客上限に近づいています', zh: '接近客户上限' },
  nearLimitBody: {
    id: 'Paket saat ini mengizinkan {count} klien. Pertimbangkan upgrade sebelum melebihi.',
    en: 'Your current tier allows {count} clients. Consider upgrading before you exceed.',
    ko: '현재 플랜의 한도는 {count}명입니다. 초과 전에 업그레이드를 고려하세요.',
    ja: '現在のプランは{count}名まで。超える前のアップグレードを検討してください。',
    zh: '当前方案允许{count}位客户。请在超限前考虑升级。',
  },
  overLimitTitle: { id: 'Melebihi batas klien', en: 'Exceeded client limit', ko: '고객 한도 초과', ja: '顧客上限を超過', zh: '超出客户上限' },
  overLimitBody: {
    id: 'Jumlah klien sudah melebihi batas paket Anda. Upgrade untuk menjaga kepatuhan.',
    en: 'Your client count exceeds your tier limit. Upgrade to remain compliant.',
    ko: '고객 수가 플랜 한도를 초과했습니다. 컴플라이언스를 위해 업그레이드하세요.',
    ja: '顧客数がプラン上限を超過しました。コンプライアンス維持のためアップグレードしてください。',
    zh: '客户数已超出方案上限。请升级以保持合规。',
  },
};

for (const locale of LOCALES) {
  const fp = path.join(MESSAGES_DIR, `${locale}.json`);
  const c = JSON.parse(fs.readFileSync(fp, 'utf-8'));
  if (!c.consultantBilling) c.consultantBilling = {};
  for (const [k, tr] of Object.entries(K)) {
    c.consultantBilling[k] = tr[locale] || tr['en'] || '';
  }
  fs.writeFileSync(fp, JSON.stringify(c, null, 2) + '\n');
}
console.log('Done: consultantBilling namespace added');
