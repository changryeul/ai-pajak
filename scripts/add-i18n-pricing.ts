import * as fs from 'fs';
import * as path from 'path';

const MESSAGES_DIR = path.resolve(process.cwd(), 'src/i18n/messages');
const LOCALES = ['id', 'en', 'ko', 'ja', 'zh'];

const NEW_KEYS: Record<string, Record<string, Record<string, string>>> = {
  pricingPage: {
    title: { id: 'Harga', en: 'Pricing', ko: '요금제', ja: '料金プラン', zh: '价格' },
    subtitle: {
      id: 'Perusahaan berlangganan bulanan, perorangan bayar per pelaporan SPT. Pilih sesuai kebutuhan.',
      en: 'Corporate plans are monthly; individuals pay per SPT filing. Choose what fits you.',
      ko: '법인은 월 구독, 개인은 SPT 신고 건당 결제. 필요에 맞게 선택하세요.',
      ja: '法人は月額サブスク、個人はSPT申告ごとの支払い。ニーズに合わせて選択してください。',
      zh: '企业按月订阅,个人按SPT申报次数付费。根据需要选择。',
    },
    tabCorporate: { id: 'Perusahaan (Langganan Bulanan)', en: 'Corporate (Monthly)', ko: '법인 고객 (월 구독)', ja: '法人（月額）', zh: '企业（月度订阅）' },
    tabIndividual: { id: 'Perorangan (Per Pelaporan)', en: 'Individual (Per Filing)', ko: '개인 (건당 결제)', ja: '個人（申告ごと）', zh: '个人（按次）' },
    tabConsultant: { id: 'Kantor Konsultan (Langganan Bulanan)', en: 'Consultant Firm (Monthly)', ko: '세무 사무소 (월 구독)', ja: '税理士事務所（月額）', zh: '税务咨询所（月度）' },
    aiRecommendation: { id: 'Rekomendasi AI', en: 'AI Recommendation', ko: 'AI 추천', ja: 'AIのおすすめ', zh: 'AI推荐' },
    currentPlan: { id: 'Paket Saat Ini', en: 'Current Plan', ko: '현재 플랜', ja: '現在のプラン', zh: '当前方案' },
    currentTier: { id: 'Tier Saat Ini', en: 'Current Tier', ko: '현재 티어', ja: '現在のティア', zh: '当前级别' },
    monthlyVatExcluded: {
      id: 'Bulanan · PPN tidak termasuk (termasuk PPN {price})',
      en: 'Monthly · VAT excluded (VAT incl. {price})',
      ko: '월 · VAT 별도 (VAT 포함 {price})',
      ja: '月額・VAT別（VAT込み {price}）',
      zh: '按月 · 不含增值税（含增值税 {price}）',
    },
    sptPricingNote: { id: 'Per 1 pelaporan SPT (PPN tidak termasuk)', en: 'Per SPT filing (VAT excluded)', ko: 'SPT 신고 1건 (VAT 별도)', ja: 'SPT申告1件（VAT別）', zh: '每次SPT申报（不含增值税）' },
    limitsBadge: { id: 'Batas', en: 'Limits', ko: '한도', ja: '上限', zh: '上限' },
    employeesLabel: { id: 'Karyawan {count} orang', en: '{count} employees', ko: '직원 {count}명', ja: '従業員{count}名', zh: '员工{count}人' },
    withholdingLabel: { id: 'PPh Potongan {count} transaksi/bulan', en: '{count} withholding/month', ko: '원천세 월 {count}건', ja: '源泉徴収 月{count}件', zh: '代扣代缴每月{count}笔' },
    ppnLabel: { id: 'PPN {count} transaksi/bulan', en: 'PPN {count}/month', ko: 'PPN 월 {count}건', ja: 'PPN 月{count}件', zh: 'PPN每月{count}笔' },
    ppnNotApplicable: { id: 'Tidak berlaku', en: 'Not applicable', ko: '해당 없음', ja: '該当なし', zh: '不适用' },
    currentlyUsing: { id: 'Sedang Digunakan', en: 'Currently Active', ko: '현재 이용 중', ja: '利用中', zh: '使用中' },
    subscribe: { id: 'Berlangganan', en: 'Subscribe', ko: '구독하기', ja: '登録する', zh: '订阅' },
    signupAndSubscribe: { id: 'Daftar & Berlangganan', en: 'Sign Up & Subscribe', ko: '가입 후 구독', ja: '登録して契約', zh: '注册并订阅' },
    proExceeded: { id: 'Melebihi Batas Paket Pro', en: 'Exceeds Pro Limits', ko: 'Pro 플랜 한도 초과', ja: 'Proプランの上限超過', zh: '超出Pro方案限制' },
    proExceededNote: {
      id: 'Kami menawarkan penawaran khusus untuk perusahaan skala besar. Klik tombol di bawah untuk meminta konsultasi.',
      en: 'We offer custom quotes for large enterprises. Click the button below to request a consultation.',
      ko: '대규모 기업을 위한 맞춤 견적을 제공합니다. 아래 버튼으로 상담 요청을 보내주세요.',
      ja: '大規模企業向けのカスタム見積もりを提供します。以下のボタンから相談依頼を送信してください。',
      zh: '我们为大型企业提供定制报价。请点击下方按钮申请咨询。',
    },
    customQuoteCta: { id: 'Minta Konsultasi Penawaran Khusus →', en: 'Request Custom Quote →', ko: '맞춤 견적 상담 요청 →', ja: 'カスタム見積もりを依頼 →', zh: '申请定制报价 →' },
    preparing: { id: 'Mempersiapkan…', en: 'Preparing…', ko: '준비 중…', ja: '準備中…', zh: '准备中…' },
    payAndStart: { id: 'Bayar & Mulai', en: 'Pay & Start', ko: '결제하고 시작', ja: '支払って開始', zh: '支付并开始' },
    signupAndStart: { id: 'Daftar & Mulai', en: 'Sign Up & Start', ko: '가입하고 시작', ja: '登録して開始', zh: '注册并开始' },
    consultantTierTitle: { id: 'Langganan Bulanan Kantor Konsultan', en: 'Consultant Firm Monthly', ko: '세무 사무소 월 구독', ja: '税理士事務所 月額プラン', zh: '税务咨询所月度订阅' },
    consultantTierDesc: {
      id: 'Paket untuk konsultan eksternal yang menggunakan AI Pajak untuk mengelola klien sendiri. Anda dapat menagih klien Anda secara terpisah.',
      en: "External consultants who use AI Pajak to manage their own clients. You can bill your clients separately.",
      ko: 'AI Pajak을 사용해서 본인 사무소 고객을 관리하는 외부 세무사용 플랜. 본인 고객들에게는 별도 청구 가능합니다.',
      ja: 'AI Pajakで自社の顧客を管理する外部税理士向けプラン。顧客には別途請求できます。',
      zh: '使用AI Pajak管理自己客户的外部顾问方案。可向客户单独收费。',
    },
    managedClientCount: {
      id: 'Jumlah klien yang dikelola saat ini: {count} orang',
      en: 'Current managed clients: {count}',
      ko: '현재 관리 고객 수: {count}명',
      ja: '現在の管理顧客数: {count}名',
      zh: '当前管理客户数: {count}人',
    },
    unlimitedClients: { id: 'Klien Tak Terbatas', en: 'Unlimited Clients', ko: '무제한 고객', ja: '無制限の顧客', zh: '无限客户' },
    maxClientsLabel: { id: 'Maks {count} klien', en: 'Max {count} clients', ko: '최대 {count}명 고객', ja: '最大{count}名の顧客', zh: '最多{count}位客户' },
    footerNote: {
      id: 'Semua harga dalam Rupiah (IDR). PPN 11% ditagih terpisah.',
      en: 'All prices in Indonesian Rupiah (IDR). VAT 11% billed separately.',
      ko: '모든 가격은 인도네시아 루피아(IDR) 기준입니다. PPN 11%는 별도로 청구됩니다.',
      ja: 'すべての価格はインドネシアルピア（IDR）建てです。PPN 11%は別途請求されます。',
      zh: '所有价格以印尼盾(IDR)计算。PPN 11%另行收取。',
    },
    errConsultantOnly: {
      id: 'Hanya konsultan kantor pajak yang dapat berlangganan paket ini',
      en: 'Only tax-firm consultants can subscribe to this plan',
      ko: '세무 사무소 컨설턴트만 이 플랜을 구독할 수 있습니다',
      ja: '税理士事務所のコンサルタントのみこのプランに登録できます',
      zh: '仅税务咨询所顾问可订阅此方案',
    },
    errCorporateOnly: {
      id: 'Hanya pelanggan korporat yang dapat berlangganan paket ini',
      en: 'Only corporate customers can subscribe to this plan',
      ko: '법인 고객만 이 플랜을 구독할 수 있습니다',
      ja: '法人のお客様のみこのプランに登録できます',
      zh: '仅企业客户可订阅此方案',
    },
    errIndividualPlanForCompany: {
      id: 'Pelanggan korporat harap menggunakan paket korporat, bukan SPT Pribadi',
      en: 'Corporate customers should use a corporate plan, not SPT Pribadi',
      ko: '법인 고객은 SPT Pribadi가 아닌 법인 요금제를 이용해주세요',
      ja: '法人のお客様はSPT Pribadiではなく法人プランをご利用ください',
      zh: '企业客户请使用企业方案,而非SPT Pribadi',
    },
    errSubscribeFailed: {
      id: 'Pengajuan langganan gagal',
      en: 'Subscription request failed',
      ko: '구독 신청 실패',
      ja: 'サブスクリプション申請に失敗しました',
      zh: '订阅申请失败',
    },
    errPaymentPrepFailed: {
      id: 'Persiapan pembayaran gagal',
      en: 'Payment preparation failed',
      ko: '결제 준비 실패',
      ja: '決済準備に失敗しました',
      zh: '付款准备失败',
    },
    errPaymentPageFailed: {
      id: 'Gagal membuat halaman pembayaran',
      en: 'Failed to create payment page',
      ko: '결제 페이지 생성 실패',
      ja: '決済ページの作成に失敗しました',
      zh: '创建付款页面失败',
    },
    errServer: {
      id: 'Kesalahan server',
      en: 'Server error',
      ko: '서버 오류',
      ja: 'サーバーエラー',
      zh: '服务器错误',
    },
  },
};

for (const locale of LOCALES) {
  const fp = path.join(MESSAGES_DIR, `${locale}.json`);
  const c = JSON.parse(fs.readFileSync(fp, 'utf-8'));
  for (const [s, keys] of Object.entries(NEW_KEYS)) {
    if (!c[s]) c[s] = {};
    for (const [k, tr] of Object.entries(keys)) {
      c[s][k] = tr[locale] || tr['en'] || '';
    }
  }
  fs.writeFileSync(fp, JSON.stringify(c, null, 2) + '\n');
}
console.log('Done! Added: pricingPage namespace to all 5 locales');
