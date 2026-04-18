import * as fs from 'fs';
import * as path from 'path';

const MESSAGES_DIR = path.resolve(process.cwd(), 'src/i18n/messages');
const LOCALES = ['id', 'en', 'ko', 'ja', 'zh'];

type Tr = Record<string, string>;
type PlanTr = { name: Tr; description: Tr; features: Record<string, Tr> };

const PLANS: Record<string, PlanTr> = {
  UMKM: {
    name: { id: 'UMKM (Usaha Mikro)', en: 'UMKM (Micro Enterprise)', ko: 'UMKM (소기업)', ja: 'UMKM（零細企業）', zh: 'UMKM（小微企业）' },
    description: {
      id: 'Untuk usaha kecil dengan ≤10 karyawan dan ≤30 transaksi per bulan',
      en: 'For small businesses with ≤10 employees and ≤30 transactions/month',
      ko: '직원 10명 / 월 거래 30건 이하의 소규모 사업자 전용',
      ja: '従業員10名以下・月30件以下の小規模事業者向け',
      zh: '适合员工10人以下、每月交易30笔以下的小型企业',
    },
    features: {
      f1: {
        id: 'Kalkulasi otomatis PPh Final UMKM 0.5%',
        en: 'Automatic PPh Final UMKM 0.5% calculation',
        ko: 'PPh Final UMKM 0.5% 자동 계산',
        ja: 'PPh Final UMKM 0.5%の自動計算',
        zh: '自动计算PPh Final UMKM 0.5%',
      },
      f2: {
        id: 'PPh 21 payroll (hingga 10 karyawan)',
        en: 'PPh 21 payroll (up to 10 employees)',
        ko: 'PPh 21 급여 세무 (최대 10명)',
        ja: 'PPh 21給与（最大10名）',
        zh: 'PPh 21薪资（最多10人）',
      },
      f3: {
        id: 'Otomatisasi PPh potongan hingga 30 transaksi/bulan',
        en: 'Automated withholding tax for up to 30 transactions/month',
        ko: '월 30건까지 원천세 자동 처리',
        ja: '月30件までの源泉徴収自動処理',
        zh: '每月自动处理最多30笔代扣代缴',
      },
      f4: {
        id: 'Pembuatan SPT Badan tahunan otomatis',
        en: 'Automatic annual SPT Badan generation',
        ko: '연간 SPT Badan 자동 생성',
        ja: '年次SPT Badanの自動生成',
        zh: '自动生成年度SPT Badan',
      },
    },
  },
  BASIC: {
    name: { id: 'Basic (UKM)', en: 'Basic (SME)', ko: 'Basic (중소기업)', ja: 'Basic（中小企業）', zh: 'Basic（中小企业）' },
    description: {
      id: 'Untuk UKM yang ingin mengotomatiskan pajak badan standar dengan AI',
      en: 'For SMEs automating standard corporate tax with AI',
      ko: '표준적인 법인 세무를 AI로 자동화하고자 하는 중소기업',
      ja: '標準的な法人税務をAIで自動化したい中小企業向け',
      zh: '适合希望用AI自动化标准企业税务的中小企业',
    },
    features: {
      f1: {
        id: 'Otomatisasi PPh 21 payroll (hingga 50 karyawan)',
        en: 'PPh 21 payroll automation (up to 50 employees)',
        ko: 'PPh 21 급여 세무 자동화 (최대 50명)',
        ja: 'PPh 21給与自動化（最大50名）',
        zh: 'PPh 21薪资自动化（最多50人）',
      },
      f2: {
        id: 'AI PPh potongan 100 transaksi/bulan (22/23/4(2))',
        en: 'AI withholding 100 transactions/month (22/23/4(2))',
        ko: '원천세 월 100건 AI 자동 처리 (PPh 22/23/4(2))',
        ja: '源泉徴収 月100件 AI自動処理（22/23/4(2)）',
        zh: '每月AI自动处理100笔代扣代缴（PPh 22/23/4(2)）',
      },
      f3: {
        id: 'Pemrosesan faktur PPN 200/bulan',
        en: 'PPN invoice processing 200/month',
        ko: '부가세 월 200건 인보이스 처리 (PPN)',
        ja: '月200件のPPN請求書処理',
        zh: '每月处理200份PPN发票',
      },
      f4: {
        id: 'Pembuatan + pelaporan SPT bulanan/tahunan otomatis',
        en: 'Automatic monthly/annual SPT generation + filing',
        ko: '월/연간 SPT 자동 생성 + 제출',
        ja: '月次・年次SPTの自動生成・提出',
        zh: '自动生成和提交月度/年度SPT',
      },
      f5: {
        id: 'Rekomendasi optimasi pajak',
        en: 'Tax optimization recommendations',
        ko: '세금 최적화 추천',
        ja: '税最適化のおすすめ',
        zh: '税务优化建议',
      },
      f6: {
        id: 'Manajemen lawan transaksi + pelacakan dokumen DTA',
        en: 'Counterparty management + DTA document tracking',
        ko: '거래 상대방 관리 + DTA 서류 추적',
        ja: '取引先管理＋DTA書類追跡',
        zh: '交易对手管理+ DTA文档跟踪',
      },
    },
  },
  PRO: {
    name: { id: 'Pro (Menengah/Besar)', en: 'Pro (Mid/Large Enterprise)', ko: 'Pro (중견/대기업)', ja: 'Pro（中堅・大企業）', zh: 'Pro（中型/大型企业）' },
    description: {
      id: 'Untuk perusahaan menengah/besar dengan kebutuhan manajemen lanjutan',
      en: 'For mid-to-large enterprises with advanced governance needs',
      ko: '중견/대기업 및 고도화 관리 요구 사항을 위한 플랜',
      ja: '中堅・大企業や高度な管理要件に対応するプラン',
      zh: '面向中大型企业和高级治理需求的方案',
    },
    features: {
      f1: { id: 'Semua fitur Basic', en: 'All Basic features', ko: 'Basic 전 기능 포함', ja: 'Basicの全機能', zh: '包含Basic全部功能' },
      f2: {
        id: 'PPh 21 payroll (hingga 1.000 karyawan)',
        en: 'PPh 21 payroll (up to 1,000 employees)',
        ko: 'PPh 21 급여 세무 (최대 1,000명)',
        ja: 'PPh 21給与（最大1,000名）',
        zh: 'PPh 21薪资（最多1,000人）',
      },
      f3: { id: 'PPh potongan 200/bulan', en: 'Withholding 200/month', ko: '원천세 월 200건', ja: '源泉徴収 月200件', zh: '代扣代缴每月200笔' },
      f4: { id: 'PPN 500 transaksi/bulan', en: 'PPN 500 transactions/month', ko: '부가세 월 500건', ja: 'PPN 月500件', zh: 'PPN每月500笔' },
      f5: {
        id: 'Manajemen pemegang saham + PPh dividen otomatis',
        en: 'Shareholder management + automated dividend PPh',
        ko: '주주 관리 + 배당 PPh 자동 판정',
        ja: '株主管理＋配当PPhの自動判定',
        zh: '股东管理+自动判定股息PPh',
      },
      f6: { id: 'Persiapan pemeriksaan pajak', en: 'Tax audit preparation', ko: '세무조사 대비 기능', ja: '税務調査対応機能', zh: '税务审计准备' },
      f7: { id: 'Dukungan Transfer Pricing dasar', en: 'Basic Transfer Pricing support', ko: 'Transfer Pricing 기본 지원', ja: 'Transfer Pricing基本サポート', zh: '转让定价基本支持' },
      f8: { id: 'Prioritas dukungan', en: 'Priority Support', ko: '우선 지원 (Priority Support)', ja: '優先サポート', zh: '优先支持' },
    },
  },
  SPT_1770SS: {
    name: { id: '1770SS (Sederhana)', en: '1770SS (Simple)', ko: '1770SS (단순)', ja: '1770SS（シンプル）', zh: '1770SS（简单）' },
    description: {
      id: 'Karyawan dengan satu sumber penghasilan',
      en: 'Employee with a single income source',
      ko: '직장인 · 단일 소득원',
      ja: '会社員・単一の所得源',
      zh: '单一收入来源的员工',
    },
    features: {
      f1: {
        id: 'Input otomatis bukti potong A1 (1721-A1) via OCR',
        en: 'Auto-input A1 (1721-A1) withholding slip via OCR',
        ko: 'A1 (1721-A1) 원천징수영수증 OCR 자동 입력',
        ja: 'A1（1721-A1）源泉徴収票のOCR自動入力',
        zh: '通过OCR自动录入A1 (1721-A1)代扣代缴凭证',
      },
      f2: { id: 'Pembuatan & validasi 1770SS otomatis', en: 'Auto-generate and validate 1770SS', ko: '1770SS 자동 생성 및 검증', ja: '1770SSの自動生成・検証', zh: '自动生成并验证1770SS' },
      f3: { id: 'Deteksi otomatis potensi restitusi pajak', en: 'Auto-detect tax refund eligibility', ko: '세금 환급 여부 자동 판정', ja: '税還付の自動判定', zh: '自动判断退税' },
      f4: { id: 'Review konsultan JTC → submit ke DJP', en: 'JTC review → submit to DJP', ko: 'JTC 세무사 검토 후 DJP 제출', ja: 'JTC税理士レビュー後、DJPへ提出', zh: 'JTC税务师审核后提交DJP' },
    },
  },
  SPT_1770S: {
    name: { id: '1770S (Standar)', en: '1770S (Standard)', ko: '1770S (표준)', ja: '1770S（スタンダード）', zh: '1770S（标准）' },
    description: {
      id: 'Multi sumber penghasilan · ada pendapatan sampingan',
      en: 'Multiple income sources · side income',
      ko: '다중 소득 · 부수입 있는 경우',
      ja: '複数の所得・副業所得あり',
      zh: '多收入来源·有兼职收入',
    },
    features: {
      f1: { id: 'Gabungkan beberapa bukti potong', en: 'Merge multiple withholding slips', ko: '여러 원천징수영수증 병합', ja: '複数の源泉徴収票を結合', zh: '合并多份代扣代缴凭证' },
      f2: {
        id: 'Otomatis: penghasilan lain · aset · kewajiban',
        en: 'Auto: other income, assets, liabilities',
        ko: '기타 소득 · 자산 · 부채 자동 정리',
        ja: 'その他の所得・資産・負債を自動整理',
        zh: '自动整理其他收入·资产·负债',
      },
      f3: { id: 'Integrasi profil PTKP', en: 'PTKP profile integration', ko: 'PTKP 프로필 연동', ja: 'PTKPプロファイル連携', zh: 'PTKP 资料整合' },
      f4: { id: 'Review konsultan JTC → submit ke DJP', en: 'JTC review → submit to DJP', ko: 'JTC 세무사 검토 후 DJP 제출', ja: 'JTC税理士レビュー後、DJPへ提出', zh: 'JTC税务师审核后提交DJP' },
    },
  },
  SPT_1770: {
    name: { id: '1770 (Lengkap)', en: '1770 (Full)', ko: '1770 (풀)', ja: '1770（フル）', zh: '1770（完整）' },
    description: {
      id: 'Pemilik usaha · freelancer · penghasilan kompleks',
      en: 'Business owners · freelancers · complex income',
      ko: '사업자 · 프리랜서 · 복잡 소득',
      ja: '事業主・フリーランス・複雑な所得',
      zh: '经营者·自由职业·复杂收入',
    },
    features: {
      f1: { id: 'Klasifikasi laba/rugi usaha otomatis', en: 'Auto business P&L classification', ko: '사업 손익 자동 분류', ja: '事業損益の自動分類', zh: '自动分类经营损益' },
      f2: { id: 'Rekomendasi optimasi pajak tahunan', en: 'Annual tax optimization advice', ko: '연간 세무 최적화 추천', ja: '年次税最適化のおすすめ', zh: '年度税务优化建议' },
      f3: { id: 'Manajemen bukti pendukung terpadu', en: 'Unified supporting document management', ko: '증빙 일괄 관리', ja: '証憑の一括管理', zh: '统一管理凭证' },
      f4: { id: 'Review konsultan JTC → submit ke DJP', en: 'JTC review → submit to DJP', ko: 'JTC 세무사 검토 후 DJP 제출', ja: 'JTC税理士レビュー後、DJPへ提出', zh: 'JTC税务师审核后提交DJP' },
    },
  },
  STARTER: {
    name: { id: 'Starter', en: 'Starter', ko: 'Starter', ja: 'Starter', zh: 'Starter' },
    description: {
      id: 'Kantor konsultan baru atau kecil (maks 10 klien)',
      en: 'New or small consulting firms (up to 10 clients)',
      ko: '신규 또는 소규모 사무소 (최대 10명 고객)',
      ja: '新規または小規模事務所（最大10名）',
      zh: '新开或小型事务所（最多10位客户）',
    },
    features: {
      f1: { id: 'Kelola hingga 10 klien', en: 'Manage up to 10 clients', ko: '최대 10명 고객 관리', ja: '最大10名の顧客管理', zh: '管理最多10位客户' },
      f2: { id: 'Akses semua alat otomasi pajak', en: 'Access all tax automation tools', ko: '모든 세무 자동화 도구 접근', ja: 'すべての税務自動化ツール', zh: '访问所有税务自动化工具' },
      f3: {
        id: 'Dashboard per klien + pelaporan bulanan/tahunan',
        en: 'Per-client dashboard + monthly/annual filing',
        ko: '고객별 대시보드 + 월/연 신고',
        ja: '顧客別ダッシュボード＋月次・年次申告',
        zh: '每位客户仪表板+月度/年度申报',
      },
      f4: { id: 'e-Filing + e-Bupot', en: 'e-Filing + e-Bupot', ko: 'e-Filing 대행 + e-Bupot', ja: 'e-Filing代行＋e-Bupot', zh: 'e-Filing代理+e-Bupot' },
      f5: { id: 'Dukungan standar', en: 'Standard support', ko: '기본 지원', ja: '標準サポート', zh: '标准支持' },
    },
  },
  GROWTH: {
    name: { id: 'Growth', en: 'Growth', ko: 'Growth', ja: 'Growth', zh: 'Growth' },
    description: {
      id: 'Kantor yang sedang berkembang (maks 50 klien)',
      en: 'Growing firms (up to 50 clients)',
      ko: '성장 중인 사무소 (최대 50명 고객)',
      ja: '成長中の事務所（最大50名）',
      zh: '快速成长的事务所（最多50位客户）',
    },
    features: {
      f1: { id: 'Semua fitur Starter', en: 'All Starter features', ko: 'Starter 전 기능 포함', ja: 'Starterの全機能', zh: '包含Starter全部功能' },
      f2: { id: 'Kelola hingga 50 klien', en: 'Manage up to 50 clients', ko: '최대 50명 고객 관리', ja: '最大50名の顧客管理', zh: '管理最多50位客户' },
      f3: {
        id: 'Undang anggota tim (termasuk peran supervisor)',
        en: 'Invite team members (including supervisor role)',
        ko: '팀원·직원 초대 (수퍼바이저 권한 포함)',
        ja: 'チームメンバー招待（スーパーバイザー権限含む）',
        zh: '邀请团队成员（含监督员权限）',
      },
      f4: {
        id: 'Pemrosesan batch banyak klien (bulk upload)',
        en: 'Bulk client processing (bulk upload)',
        ko: '다수 고객 일괄 처리 (대량 업로드)',
        ja: '複数顧客の一括処理（一括アップロード）',
        zh: '多客户批量处理（批量上传）',
      },
      f5: {
        id: 'Manajemen POA · akta · pemegang saham per klien',
        en: 'Per-client POA · articles · shareholder management',
        ko: '고객별 POA·정관·주주 관리',
        ja: '顧客別のPOA・定款・株主管理',
        zh: '每位客户的POA·章程·股东管理',
      },
      f6: { id: 'Dukungan prioritas', en: 'Priority support', ko: '우선 지원', ja: '優先サポート', zh: '优先支持' },
    },
  },
  ENTERPRISE: {
    name: { id: 'Enterprise', en: 'Enterprise', ko: 'Enterprise', ja: 'Enterprise', zh: 'Enterprise' },
    description: {
      id: 'Kantor besar (50+ klien, penawaran khusus tersedia)',
      en: 'Large firms (50+ clients, custom quotes available)',
      ko: '대형 사무소 (50명 이상, 맞춤 견적 가능)',
      ja: '大手事務所（50名以上、カスタム見積可）',
      zh: '大型事务所（50+客户，可定制报价）',
    },
    features: {
      f1: { id: 'Semua fitur Growth', en: 'All Growth features', ko: 'Growth 전 기능 포함', ja: 'Growthの全機能', zh: '包含Growth全部功能' },
      f2: { id: 'Jumlah klien tak terbatas', en: 'Unlimited clients', ko: '관리 고객 수 무제한', ja: '顧客数無制限', zh: '无限客户数' },
      f3: { id: 'Account manager khusus', en: 'Dedicated account manager', ko: '전담 계정 매니저', ja: '専任アカウントマネージャー', zh: '专属客户经理' },
      f4: { id: 'Integrasi khusus (API)', en: 'Custom integration (API)', ko: '맞춤 통합 (API 연동)', ja: 'カスタム統合（API連携）', zh: '定制集成（API）' },
      f5: {
        id: 'SLA khusus + respons insiden prioritas',
        en: 'Dedicated SLA + priority incident response',
        ko: '전용 SLA + 우선 장애 대응',
        ja: '専用SLA＋優先インシデント対応',
        zh: '专属SLA+优先故障响应',
      },
      f6: {
        id: 'Diskon untuk pemeriksaan pajak · transfer pricing',
        en: 'Discounts on tax audit · transfer pricing',
        ko: '세무조사·이전가격 컨설팅 할인',
        ja: '税務調査・移転価格コンサルの割引',
        zh: '税务审计·转让定价咨询折扣',
      },
    },
  },
};

for (const locale of LOCALES) {
  const fp = path.join(MESSAGES_DIR, `${locale}.json`);
  const c = JSON.parse(fs.readFileSync(fp, 'utf-8'));
  if (!c.pricingPlans) c.pricingPlans = {};
  for (const [planId, plan] of Object.entries(PLANS)) {
    if (!c.pricingPlans[planId]) c.pricingPlans[planId] = {};
    c.pricingPlans[planId].name = plan.name[locale] || plan.name['en'];
    c.pricingPlans[planId].description = plan.description[locale] || plan.description['en'];
    if (!c.pricingPlans[planId].features) c.pricingPlans[planId].features = {};
    for (const [fk, tr] of Object.entries(plan.features)) {
      c.pricingPlans[planId].features[fk] = tr[locale] || tr['en'];
    }
  }
  fs.writeFileSync(fp, JSON.stringify(c, null, 2) + '\n');
}
console.log('Done! Added pricingPlans namespace to all 5 locales');
