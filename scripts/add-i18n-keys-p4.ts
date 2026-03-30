/**
 * P4 i18n Keys - Remaining pages (settings integrations, SPT form pages, misc)
 * Run: npx tsx scripts/add-i18n-keys-p4.ts
 */
import fs from 'fs';
import path from 'path';

const LANGS = ['ko', 'en', 'id', 'ja', 'zh'] as const;
const MESSAGES_DIR = path.join(process.cwd(), 'src/i18n/messages');

// Shared SPT form page keys (1770, 1770S, 1770SS, 1771 share same pattern)
const sptPages: Record<string, Record<string, string>> = {
  ko: {
    back: '돌아가기',
    selectTaxpayer: '납세자 선택',
    loadingData: '데이터 로드 중...',
    noTaxpayerData: '개인 납세자 데이터가 없습니다.',
    addNewTaxpayer: '새 납세자 추가',
    selectTaxpayerPlaceholder: '납세자 선택...',
    selectClient: '고객 선택...',
    changeClient: '고객 변경',
    noAnomalies: '이상 징후가 감지되지 않았습니다!',
    notFound: '찾을 수 없음',
    spt1770Title: 'SPT 1770 - 완전 양식',
    spt1770Desc: '사업/자유직업 소득자용 납세자 신고서',
    spt1770STitle: 'SPT 1770 S - 간편 양식',
    spt1770SDesc: '근로소득 6천만 루피아 이상 또는 복수 직장 직장인용',
    spt1770SSTitle: 'SPT 1770 SS - 초간편 양식',
    spt1770SSDesc: '1개 직장, 연소득 6천만 루피아 미만 직장인용',
    spt1771Title: 'SPT 1771 - 법인세',
    spt1771Desc: 'PT, CV 등 법인 납세자용 연간 신고서',
    noCorpTaxpayer: '법인 납세자 데이터가 없습니다.',
    addNewCorp: '새 법인 추가',
  },
  en: {
    back: 'Back',
    selectTaxpayer: 'Select Taxpayer',
    loadingData: 'Loading data...',
    noTaxpayerData: 'No individual taxpayer data found.',
    addNewTaxpayer: 'Add New Taxpayer',
    selectTaxpayerPlaceholder: 'Select taxpayer...',
    selectClient: 'Select client...',
    changeClient: 'Change Client',
    noAnomalies: 'No anomalies detected!',
    notFound: 'Not found',
    spt1770Title: 'SPT 1770 - Full Form',
    spt1770Desc: 'For taxpayers with business or freelance income',
    spt1770STitle: 'SPT 1770 S - Simplified Form',
    spt1770SDesc: 'For employees with income ≥Rp 60M or multiple employers',
    spt1770SSTitle: 'SPT 1770 SS - Ultra Simplified',
    spt1770SSDesc: 'For single employer, annual income <Rp 60M',
    spt1771Title: 'SPT 1771 - Corporate Tax',
    spt1771Desc: 'Annual tax return for corporate taxpayers (PT, CV, etc.)',
    noCorpTaxpayer: 'No corporate taxpayer data found.',
    addNewCorp: 'Add New Corporation',
  },
  id: {
    back: 'Kembali',
    selectTaxpayer: 'Pilih Wajib Pajak',
    loadingData: 'Memuat data...',
    noTaxpayerData: 'Belum ada data wajib pajak orang pribadi.',
    addNewTaxpayer: 'Tambah Wajib Pajak Baru',
    selectTaxpayerPlaceholder: 'Pilih wajib pajak...',
    selectClient: 'Pilih klien...',
    changeClient: 'Ganti Wajib Pajak',
    noAnomalies: 'Tidak ada anomali terdeteksi!',
    notFound: 'Tidak ditemukan',
    spt1770Title: 'SPT 1770 - Formulir Lengkap',
    spt1770Desc: 'Untuk wajib pajak dengan penghasilan dari usaha atau pekerjaan bebas',
    spt1770STitle: 'SPT 1770 S - Formulir Sederhana',
    spt1770SDesc: 'Untuk karyawan dengan penghasilan ≥Rp 60 juta atau lebih dari satu pemberi kerja',
    spt1770SSTitle: 'SPT 1770 SS - Formulir Sangat Sederhana',
    spt1770SSDesc: 'Untuk karyawan satu pemberi kerja dengan penghasilan <Rp 60 juta',
    spt1771Title: 'SPT 1771 - PPh Badan',
    spt1771Desc: 'SPT Tahunan PPh Badan untuk Wajib Pajak Badan (PT, CV, dll)',
    noCorpTaxpayer: 'Belum ada data wajib pajak badan.',
    addNewCorp: 'Tambah Badan Usaha Baru',
  },
  ja: {
    back: '戻る',
    selectTaxpayer: '納税者を選択',
    loadingData: 'データ読み込み中...',
    noTaxpayerData: '個人納税者データがありません。',
    addNewTaxpayer: '新規納税者を追加',
    selectTaxpayerPlaceholder: '納税者を選択...',
    selectClient: 'クライアントを選択...',
    changeClient: 'クライアント変更',
    noAnomalies: '異常は検出されませんでした！',
    notFound: '見つかりません',
    spt1770Title: 'SPT 1770 - 完全フォーム',
    spt1770Desc: '事業・自由職業所得の納税者用',
    spt1770STitle: 'SPT 1770 S - 簡易フォーム',
    spt1770SDesc: '年収6千万ルピア以上または複数雇用者の会社員用',
    spt1770SSTitle: 'SPT 1770 SS - 超簡易フォーム',
    spt1770SSDesc: '1社雇用、年収6千万ルピア未満の会社員用',
    spt1771Title: 'SPT 1771 - 法人税',
    spt1771Desc: 'PT、CV等の法人納税者用年次申告書',
    noCorpTaxpayer: '法人納税者データがありません。',
    addNewCorp: '新規法人を追加',
  },
  zh: {
    back: '返回',
    selectTaxpayer: '选择纳税人',
    loadingData: '加载数据中...',
    noTaxpayerData: '暂无个人纳税人数据。',
    addNewTaxpayer: '添加新纳税人',
    selectTaxpayerPlaceholder: '选择纳税人...',
    selectClient: '选择客户...',
    changeClient: '更换客户',
    noAnomalies: '未检测到异常！',
    notFound: '未找到',
    spt1770Title: 'SPT 1770 - 完整表格',
    spt1770Desc: '适用于经营/自由职业所得纳税人',
    spt1770STitle: 'SPT 1770 S - 简化表格',
    spt1770SDesc: '适用于收入≥6千万盾或多雇主的雇员',
    spt1770SSTitle: 'SPT 1770 SS - 超简化表格',
    spt1770SSDesc: '适用于单一雇主、年收入<6千万盾的雇员',
    spt1771Title: 'SPT 1771 - 企业税',
    spt1771Desc: '适用于法人纳税人（PT、CV等）的年度申报表',
    noCorpTaxpayer: '暂无法人纳税人数据。',
    addNewCorp: '添加新法人',
  },
};

// Settings integrations section
const settingsIntegrations: Record<string, Record<string, string>> = {
  ko: {
    integrations: '연동',
    connect: '연결',
    disconnect: '연결 해제',
    connected: '연결됨',
    manageBtn: '관리',
    accurateOnline: 'Accurate Online',
    accurateDesc: '직원 및 급여 데이터 동기화',
    bankAccount: '은행 계좌',
    bankDesc: '은행에서 매출 자동 가져오기',
    jurnalId: 'Jurnal.id (Mekari)',
    jurnalDesc: '회계 및 PPN 동기화',
    xero: 'Xero',
    comingSoon: '준비 중',
    featuresAfterConnect: '연결 후 사용 가능한 기능:',
    doubleRateWarning: 'NPWP 미보유 거래처는 2배 세율이 적용됩니다 (Pasal 23(1a) UU PPh). 거래 전 NPWP를 확인하세요.',
    selectOrManual: '선택 또는 직접 입력',
  },
  en: {
    integrations: 'Integrations',
    connect: 'Connect',
    disconnect: 'Disconnect',
    connected: 'Connected',
    manageBtn: 'Manage',
    accurateOnline: 'Accurate Online',
    accurateDesc: 'Sync employee & salary data',
    bankAccount: 'Bank Account',
    bankDesc: 'Auto-import revenue from bank',
    jurnalId: 'Jurnal.id (Mekari)',
    jurnalDesc: 'Sync accounting & PPN',
    xero: 'Xero',
    comingSoon: 'Coming Soon',
    featuresAfterConnect: 'Features available after connecting:',
    doubleRateWarning: 'Double rate applies for counterparties without NPWP (Pasal 23(1a) UU PPh). Verify NPWP before transactions.',
    selectOrManual: 'Select or enter manually',
  },
  id: {
    integrations: 'Integrasi',
    connect: 'Hubungkan',
    disconnect: 'Putuskan',
    connected: 'Terhubung',
    manageBtn: 'Kelola',
    accurateOnline: 'Accurate Online',
    accurateDesc: 'Sinkronisasi data karyawan & gaji',
    bankAccount: 'Rekening Bank',
    bankDesc: 'Auto-import revenue dari bank',
    jurnalId: 'Jurnal.id (Mekari)',
    jurnalDesc: 'Sinkronisasi akuntansi & PPN',
    xero: 'Xero',
    comingSoon: 'Coming Soon',
    featuresAfterConnect: 'Fitur yang tersedia setelah terhubung:',
    doubleRateWarning: 'Tarif 2x lipat berlaku karena lawan transaksi tidak memiliki NPWP (Pasal 23(1a) UU PPh). Pastikan NPWP sebelum transaksi.',
    selectOrManual: 'Pilih atau isi manual',
  },
  ja: {
    integrations: '連携',
    connect: '接続',
    disconnect: '切断',
    connected: '接続済み',
    manageBtn: '管理',
    accurateOnline: 'Accurate Online',
    accurateDesc: '従業員・給与データの同期',
    bankAccount: '銀行口座',
    bankDesc: '銀行から売上を自動取込',
    jurnalId: 'Jurnal.id (Mekari)',
    jurnalDesc: '会計・PPN同期',
    xero: 'Xero',
    comingSoon: '準備中',
    featuresAfterConnect: '接続後に利用可能な機能：',
    doubleRateWarning: 'NPWP未保有の取引先は2倍の税率が適用されます（Pasal 23(1a) UU PPh）。取引前にNPWPを確認してください。',
    selectOrManual: '選択または手入力',
  },
  zh: {
    integrations: '集成',
    connect: '连接',
    disconnect: '断开',
    connected: '已连接',
    manageBtn: '管理',
    accurateOnline: 'Accurate Online',
    accurateDesc: '同步员工和薪资数据',
    bankAccount: '银行账户',
    bankDesc: '从银行自动导入收入',
    jurnalId: 'Jurnal.id (Mekari)',
    jurnalDesc: '同步会计和PPN',
    xero: 'Xero',
    comingSoon: '即将推出',
    featuresAfterConnect: '连接后可用功能：',
    doubleRateWarning: 'NPWP缺失的交易对手适用双倍税率（Pasal 23(1a) UU PPh）。交易前请确认NPWP。',
    selectOrManual: '选择或手动输入',
  },
};

// Marketplace & referral
const marketplace: Record<string, Record<string, string>> = {
  ko: {
    searchFirm: '법인명으로 검색...',
    noConsultants: '컨설턴트가 없습니다',
    clients: '고객',
  },
  en: {
    searchFirm: 'Search by firm name...',
    noConsultants: 'No consultants found',
    clients: 'clients',
  },
  id: {
    searchFirm: 'Cari berdasarkan nama firma...',
    noConsultants: 'Tidak ada konsultan ditemukan',
    clients: 'klien',
  },
  ja: {
    searchFirm: '法人名で検索...',
    noConsultants: 'コンサルタントが見つかりません',
    clients: 'クライアント',
  },
  zh: {
    searchFirm: '按公司名搜索...',
    noConsultants: '未找到顾问',
    clients: '客户',
  },
};

function main() {
  for (const lang of LANGS) {
    const filePath = path.join(MESSAGES_DIR, `${lang}.json`);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    content.sptPages = sptPages[lang];
    content.settingsIntegrations = settingsIntegrations[lang];
    content.marketplace = marketplace[lang];

    fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n', 'utf8');
    console.log(`✅ ${lang}.json updated with P4 keys`);
  }
  console.log('\n🎉 P4 i18n keys added!');
}

main();
