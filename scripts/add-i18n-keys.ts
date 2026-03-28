/**
 * Add missing i18n keys to all language files
 * Run: npx tsx scripts/add-i18n-keys.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const MESSAGES_DIR = path.resolve(process.cwd(), 'src/i18n/messages');
const LOCALES = ['id', 'en', 'ko', 'ja', 'zh'];

// New keys to add - organized by section
const NEW_KEYS: Record<string, Record<string, Record<string, string>>> = {
  // Common keys
  common: {
    retry: { id: 'Coba Lagi', en: 'Retry', ko: '재시도', ja: '再試行', zh: '重试' },
    connect: { id: 'Hubungkan', en: 'Connect', ko: '연결', ja: '接続', zh: '连接' },
    disconnect: { id: 'Putuskan', en: 'Disconnect', ko: '연결 해제', ja: '切断', zh: '断开' },
    connected: { id: 'Terhubung', en: 'Connected', ko: '연결됨', ja: '接続済み', zh: '已连接' },
    manage: { id: 'Kelola', en: 'Manage', ko: '관리', ja: '管理', zh: '管理' },
    allTypes: { id: 'Semua Jenis', en: 'All Types', ko: '모든 유형', ja: 'すべてのタイプ', zh: '所有类型' },
    all: { id: 'Semua', en: 'All', ko: '전체', ja: 'すべて', zh: '全部' },
    notFound: { id: 'Tidak ditemukan', en: 'Not found', ko: '찾을 수 없음', ja: '見つかりません', zh: '未找到' },
    settings: { id: 'Pengaturan', en: 'Settings', ko: '설정', ja: '設定', zh: '设置' },
  },

  // Dashboard hero section
  dashboardHero: {
    customerSubtitle: { id: 'Kelola pajak Anda dengan mudah bersama AI Pajak', en: 'Manage your taxes easily with AI Pajak', ko: 'AI Pajak과 함께 쉽게 세금을 관리하세요', ja: 'AI Pajakで簡単に税金を管理', zh: '使用AI Pajak轻松管理您的税务' },
    uploadDocument: { id: 'Upload Dokumen', en: 'Upload Document', ko: '문서 업로드', ja: '書類アップロード', zh: '上传文件' },
    createSpt: { id: 'Buat SPT', en: 'Create SPT', ko: 'SPT 작성', ja: 'SPT作成', zh: '创建SPT' },
    sptAutofill: { id: 'SPT Auto-fill', en: 'SPT Auto-fill', ko: 'SPT 자동 입력', ja: 'SPT自動入力', zh: 'SPT自动填写' },
    sptAutofillDesc: { id: 'Upload & otomatis isi SPT', en: 'Upload & auto-fill SPT', ko: '업로드 & SPT 자동 입력', ja: 'アップロード＆SPT自動入力', zh: '上传并自动填写SPT' },
    taxSavings: { id: 'Hemat Pajak', en: 'Tax Savings', ko: '절세 추천', ja: '節税', zh: '节税' },
    taxSavingsDesc: { id: 'Temukan peluang penghematan', en: 'Find saving opportunities', ko: '절세 기회 찾기', ja: '節税の機会を見つける', zh: '发现节税机会' },
    aiClassification: { id: 'AI Klasifikasi', en: 'AI Classification', ko: 'AI 분류', ja: 'AI分類', zh: 'AI分类' },
    aiClassificationDesc: { id: 'Upload & otomatis deteksi', en: 'Upload & auto-detect', ko: '업로드 & 자동 감지', ja: 'アップロード＆自動検出', zh: '上传并自动检测' },
    consultantSubtitle: { id: 'Kelola klien dan laporan pajak Anda', en: 'Manage your clients and tax reports', ko: '고객과 세금 보고서를 관리하세요', ja: 'クライアントと税務レポートを管理', zh: '管理您的客户和税务报告' },
    analysisDesc: { id: 'Temukan peluang klien', en: 'Find client opportunities', ko: '고객 기회 찾기', ja: 'クライアントの機会を見つける', zh: '发现客户机会' },
    aiReport: { id: 'Laporan AI', en: 'AI Report', ko: 'AI 리포트', ja: 'AIレポート', zh: 'AI报告' },
    aiReportDesc: { id: 'Generate laporan klien', en: 'Generate client report', ko: '고객 리포트 생성', ja: 'クライアントレポート生成', zh: '生成客户报告' },
    adminMode: { id: 'Mode Administrasi Platform', en: 'Platform Administration Mode', ko: '플랫폼 관리 모드', ja: 'プラットフォーム管理モード', zh: '平台管理模式' },
    sessionRequired: { id: 'Sesi Diperlukan', en: 'Session Required', ko: '세션 필요', ja: 'セッションが必要です', zh: '需要会话' },
    pleaseLogin: { id: 'Silakan login untuk mengakses dashboard Anda.', en: 'Please log in to access your dashboard.', ko: '대시보드에 접속하려면 로그인하세요.', ja: 'ダッシュボードにアクセスするにはログインしてください。', zh: '请登录以访问您的仪表板。' },
    logIn: { id: 'Masuk', en: 'Log In', ko: '로그인', ja: 'ログイン', zh: '登录' },
    thisMonth: { id: 'bulan ini', en: 'this month', ko: '이번 달', ja: '今月', zh: '本月' },
    needAction: { id: 'perlu tindakan', en: 'need action', ko: '조치 필요', ja: '対応必要', zh: '需要处理' },
    waiting: { id: 'menunggu', en: 'waiting', ko: '대기 중', ja: '待機中', zh: '等待中' },
  },

  // Getting Started Guide
  guide: {
    title: { id: 'Mulai Menggunakan AI Pajak', en: 'Get Started with AI Pajak', ko: 'AI Pajak 시작하기', ja: 'AI Pajakを始める', zh: '开始使用AI Pajak' },
    completeProfile: { id: 'Lengkapi Profil', en: 'Complete Profile', ko: '프로필 완성', ja: 'プロフィール完成', zh: '完善资料' },
    completeProfileDesc: { id: 'Isi NPWP, NIK, dan data diri Anda', en: 'Fill in your NPWP, NIK, and personal data', ko: 'NPWP, NIK, 개인 정보를 입력하세요', ja: 'NPWP、NIK、個人情報を入力', zh: '填写您的NPWP、NIK和个人信息' },
    uploadBuktiPotong: { id: 'Upload Bukti Potong', en: 'Upload Tax Slip', ko: '원천징수 영수증 업로드', ja: '源泉徴収票アップロード', zh: '上传扣缴凭证' },
    uploadBuktiPotongDesc: { id: 'Upload Form 1721-A1 dari pemberi kerja', en: 'Upload Form 1721-A1 from employer', ko: '고용주로부터 1721-A1 양식 업로드', ja: '雇用主からのForm 1721-A1をアップロード', zh: '上传雇主的1721-A1表格' },
    createSptTahunan: { id: 'Buat SPT Tahunan', en: 'Create Annual Tax Return', ko: '연간 세금 신고서 작성', ja: '年次確定申告を作成', zh: '创建年度纳税申报表' },
    createSptDesc: { id: 'AI otomatis mengisi SPT dari dokumen Anda', en: 'AI auto-fills SPT from your documents', ko: 'AI가 문서에서 자동으로 SPT를 작성합니다', ja: 'AIがあなたの書類からSPTを自動入力', zh: 'AI从您的文件自动填写SPT' },
    checkSavings: { id: 'Cek Peluang Hemat Pajak', en: 'Check Tax Savings', ko: '절세 기회 확인', ja: '節税チャンスを確認', zh: '查看节税机会' },
    checkSavingsDesc: { id: 'AI analisis penghematan pajak Anda', en: 'AI analyzes your tax savings', ko: 'AI가 절세를 분석합니다', ja: 'AIが節税を分析', zh: 'AI分析您的节税' },
    validateSpt: { id: 'Validasi SPT', en: 'Validate SPT', ko: 'SPT 검증', ja: 'SPT検証', zh: '验证SPT' },
    validateSptDesc: { id: 'Periksa kesalahan sebelum submit', en: 'Check errors before submission', ko: '제출 전 오류 확인', ja: '提出前にエラーを確認', zh: '提交前检查错误' },
  },

  // Tax Calendar
  calendar: {
    title: { id: 'Kalender Pajak', en: 'Tax Calendar', ko: '세금 달력', ja: '税務カレンダー', zh: '税务日历' },
    subtitle: { id: 'Semua tenggat waktu pajak dalam satu tampilan', en: 'All tax deadlines in one view', ko: '모든 세금 마감일을 한눈에', ja: 'すべての税務期限を一覧で', zh: '所有税务截止日期一览' },
    upcomingAlert: { id: 'deadline dalam 14 hari ke depan', en: 'deadlines in the next 14 days', ko: '14일 내 마감일', ja: '14日以内の期限', zh: '未来14天内的截止日期' },
    noDeadline: { id: 'Tidak ada deadline', en: 'No deadlines', ko: '마감일 없음', ja: '期限なし', zh: '无截止日期' },
    noDeadlineThisMonth: { id: 'Tidak ada deadline bulan ini', en: 'No deadlines this month', ko: '이번 달 마감일 없음', ja: '今月の期限なし', zh: '本月无截止日期' },
    highPriority: { id: 'Prioritas Tinggi', en: 'High Priority', ko: '높은 우선순위', ja: '高優先度', zh: '高优先级' },
    medium: { id: 'Sedang', en: 'Medium', ko: '중간', ja: '中', zh: '中等' },
    info: { id: 'Informasi', en: 'Information', ko: '정보', ja: '情報', zh: '信息' },
    annual: { id: 'Tahunan', en: 'Annual', ko: '연간', ja: '年次', zh: '年度' },
    penalty: { id: 'Denda', en: 'Penalty', ko: '벌금', ja: '罰金', zh: '罚款' },
    dayNames: { id: 'Min,Sen,Sel,Rab,Kam,Jum,Sab', en: 'Sun,Mon,Tue,Wed,Thu,Fri,Sat', ko: '일,월,화,수,목,금,토', ja: '日,月,火,水,木,金,土', zh: '日,一,二,三,四,五,六' },
  },

  // Help page
  help: {
    title: { id: 'Pusat Bantuan', en: 'Help Center', ko: '도움말 센터', ja: 'ヘルプセンター', zh: '帮助中心' },
    subtitle: { id: 'Temukan jawaban untuk pertanyaan Anda', en: 'Find answers to your questions', ko: '질문에 대한 답변을 찾아보세요', ja: 'ご質問への回答を見つける', zh: '找到您问题的答案' },
    searchPlaceholder: { id: 'Cari pertanyaan...', en: 'Search questions...', ko: '질문 검색...', ja: '質問を検索...', zh: '搜索问题...' },
    noResults: { id: 'Tidak ditemukan. Coba kata kunci lain atau tanya AI Chatbot.', en: 'Not found. Try other keywords or ask AI Chatbot.', ko: '찾을 수 없습니다. 다른 키워드를 시도하거나 AI 챗봇에 물어보세요.', ja: '見つかりません。他のキーワードを試すか、AIチャットボットに聞いてください。', zh: '未找到。尝试其他关键词或询问AI聊天机器人。' },
    stillNeedHelp: { id: 'Masih butuh bantuan?', en: 'Still need help?', ko: '아직 도움이 필요하신가요?', ja: 'まだ助けが必要ですか？', zh: '还需要帮助吗？' },
    contactSupport: { id: 'Gunakan AI Chatbot di pojok kanan bawah atau email ke support@aipajak.com', en: 'Use AI Chatbot at bottom right or email support@aipajak.com', ko: '우하단 AI 챗봇을 사용하거나 support@aipajak.com으로 이메일하세요', ja: '右下のAIチャットボットを使うか、support@aipajak.comにメールしてください', zh: '使用右下角的AI聊天机器人或发送邮件至support@aipajak.com' },
  },

  // Integrations
  integrations: {
    title: { id: 'Integrasi', en: 'Integrations', ko: '연동', ja: '連携', zh: '集成' },
    accurateTitle: { id: 'Accurate Online', en: 'Accurate Online', ko: 'Accurate Online', ja: 'Accurate Online', zh: 'Accurate Online' },
    accurateDesc: { id: 'Sinkronisasi data karyawan & gaji', en: 'Sync employee & payroll data', ko: '직원 & 급여 데이터 동기화', ja: '従業員＆給与データを同期', zh: '同步员工和工资数据' },
    bankTitle: { id: 'Rekening Bank', en: 'Bank Account', ko: '은행 계좌', ja: '銀行口座', zh: '银行账户' },
    bankDesc: { id: 'Auto-import revenue dari bank', en: 'Auto-import revenue from bank', ko: '은행에서 수입 자동 가져오기', ja: '銀行から収入を自動インポート', zh: '从银行自动导入收入' },
    jurnalTitle: { id: 'Jurnal.id (Mekari)', en: 'Jurnal.id (Mekari)', ko: 'Jurnal.id (Mekari)', ja: 'Jurnal.id (Mekari)', zh: 'Jurnal.id (Mekari)' },
    jurnalDesc: { id: 'Sinkronisasi akuntansi & PPN', en: 'Sync accounting & VAT', ko: '회계 & 부가세 동기화', ja: '会計＆消費税を同期', zh: '同步会计和增值税' },
  },

  // Platform stats
  platformStats: {
    totalCustomers: { id: 'Total Pelanggan', en: 'Total Customers', ko: '총 고객 수', ja: '顧客合計', zh: '总客户数' },
    totalFilings: { id: 'Total Pelaporan', en: 'Total Filings', ko: '총 신고 건수', ja: '申告合計', zh: '总申报数' },
    revenueRange: { id: 'Kisaran Pendapatan', en: 'Revenue Range', ko: '매출 범위', ja: '売上範囲', zh: '收入范围' },
    activeConsultants: { id: 'Konsultan Aktif', en: 'Active Consultants', ko: '활성 컨설턴트', ja: 'アクティブコンサルタント', zh: '活跃顾问' },
    currentlyActive: { id: 'Saat ini aktif', en: 'Currently active', ko: '현재 활성', ja: '現在アクティブ', zh: '当前活跃' },
    dashboardTitle: { id: 'Dashboard Analitik Platform', en: 'Platform Analytics Dashboard', ko: '플랫폼 분석 대시보드', ja: 'プラットフォーム分析ダッシュボード', zh: '平台分析仪表板' },
    dashboardDisclaimer: { id: 'Menampilkan metrik platform agregat. Data pajak dan PII pelanggan tidak dapat diakses dari tampilan ini.', en: 'Showing aggregated platform metrics. Customer tax data and PII are not accessible from this view.', ko: '집계된 플랫폼 지표를 표시합니다. 이 보기에서는 고객 세금 데이터와 개인정보에 접근할 수 없습니다.', ja: '集計されたプラットフォーム指標を表示しています。顧客の税務データやPIIにはアクセスできません。', zh: '显示汇总的平台指标。无法从此视图访问客户税务数据和个人信息。' },
    individual: { id: 'Perorangan', en: 'Individual', ko: '개인', ja: '個人', zh: '个人' },
    company: { id: 'Perusahaan', en: 'Company', ko: '법인', ja: '法人', zh: '企业' },
    customerDistribution: { id: 'Distribusi Pelanggan', en: 'Customer Distribution', ko: '고객 분포', ja: '顧客分布', zh: '客户分布' },
  },
};

// Apply to all locale files
for (const locale of LOCALES) {
  const filePath = path.join(MESSAGES_DIR, `${locale}.json`);
  const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  for (const [section, keys] of Object.entries(NEW_KEYS)) {
    if (!content[section]) {
      content[section] = {};
    }
    for (const [key, translations] of Object.entries(keys)) {
      if (!content[section][key]) {
        content[section][key] = translations[locale] || translations['en'] || '';
      }
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n');
  console.log(`Updated: ${locale}.json`);
}

console.log('\nDone! Added keys for sections:', Object.keys(NEW_KEYS).join(', '));
