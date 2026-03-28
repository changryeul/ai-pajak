import * as fs from 'fs';
import * as path from 'path';

const MESSAGES_DIR = path.resolve(process.cwd(), 'src/i18n/messages');
const LOCALES = ['id', 'en', 'ko', 'ja', 'zh'];

const NEW_KEYS: Record<string, Record<string, Record<string, string>>> = {
  pages: {
    sptAutofillAvailable: { id: 'AI Auto-fill Tersedia', en: 'AI Auto-fill Available', ko: 'AI 자동 입력 가능', ja: 'AI自動入力対応', zh: 'AI自动填写可用' },
    selectSptForm: { id: 'Pilih jenis formulir SPT Tahunan yang sesuai dengan kondisi Anda', en: 'Select the annual tax form that suits your situation', ko: '상황에 맞는 연간 세금 신고서를 선택하세요', ja: 'ご状況に合った年次確定申告書を選択してください', zh: '选择适合您情况的年度纳税申报表' },
    notSureForm: { id: 'Tidak yakin formulir mana?', en: 'Not sure which form?', ko: '어떤 양식인지 모르겠나요?', ja: 'どのフォームか分からない？', zh: '不确定哪个表格？' },
    uploadAndRecommend: { id: 'Upload Bukti Potong (1721-A1) dan AI kami akan merekomendasikan formulir yang tepat.', en: 'Upload your tax slip (1721-A1) and our AI will recommend the right form.', ko: '원천징수 영수증(1721-A1)을 업로드하면 AI가 적합한 양식을 추천합니다.', ja: '源泉徴収票(1721-A1)をアップロードすると、AIが適切なフォームを推薦します。', zh: '上传扣缴凭证(1721-A1)，AI将推荐合适的表格。' },
    uploadDoc: { id: 'Upload Dokumen', en: 'Upload Document', ko: '문서 업로드', ja: '書類アップロード', zh: '上传文件' },
    taxSavingsTitle: { id: 'Tax Savings Advisor', en: 'Tax Savings Advisor', ko: '절세 추천', ja: '節税アドバイザー', zh: '节税顾问' },
    findSavings: { id: 'Temukan peluang penghematan pajak dengan analisis AI', en: 'Find tax saving opportunities with AI analysis', ko: 'AI 분석으로 절세 기회를 찾아보세요', ja: 'AI分析で節税の機会を見つける', zh: '通过AI分析发现节税机会' },
    anomalyTitle: { id: 'Smart Anomaly Detection', en: 'Smart Anomaly Detection', ko: '스마트 이상 감지', ja: 'スマート異常検知', zh: '智能异常检测' },
    anomalyDesc: { id: 'Deteksi risiko pemeriksaan pajak secara otomatis', en: 'Automatically detect tax audit risks', ko: '세무 조사 리스크를 자동으로 감지합니다', ja: '税務調査リスクを自動検出', zh: '自动检测税务审计风险' },
    runAnomaly: { id: 'Jalankan Deteksi Anomali', en: 'Run Anomaly Detection', ko: '이상 감지 실행', ja: '異常検知を実行', zh: '运行异常检测' },
    taxToolsTitle: { id: 'Tax Tools', en: 'Tax Tools', ko: '세금 도구', ja: '税務ツール', zh: '税务工具' },
    taxToolsDesc: { id: 'Kalkulator dan tools pajak Indonesia', en: 'Indonesian tax calculators and tools', ko: '인도네시아 세금 계산기 및 도구', ja: 'インドネシア税務計算ツール', zh: '印尼税务计算器和工具' },
    predict: { id: 'Prediksi', en: 'Predict', ko: '예측', ja: '予測', zh: '预测' },
    forecast: { id: 'Forecast', en: 'Forecast', ko: '예측', ja: '予測', zh: '预测' },
    calculate: { id: 'Hitung', en: 'Calculate', ko: '계산', ja: '計算', zh: '计算' },
    compare: { id: 'Bandingkan', en: 'Compare', ko: '비교', ja: '比較', zh: '比较' },
    result: { id: 'Hasil', en: 'Result', ko: '결과', ja: '結果', zh: '结果' },
    clientReportTitle: { id: 'Laporan Klien (AI)', en: 'Client Report (AI)', ko: '고객 리포트 (AI)', ja: 'クライアントレポート (AI)', zh: '客户报告 (AI)' },
    clientReportDesc: { id: 'Buat laporan analisis pajak komprehensif untuk klien Anda', en: 'Create comprehensive tax analysis reports for your clients', ko: '고객을 위한 종합 세금 분석 보고서를 작성하세요', ja: 'クライアント向けの包括的な税務分析レポートを作成', zh: '为客户创建全面的税务分析报告' },
    pph21BulkTitle: { id: 'PPh 21 Bulk Calculator', en: 'PPh 21 Bulk Calculator', ko: 'PPh 21 일괄 계산기', ja: 'PPh 21一括計算', zh: 'PPh 21批量计算器' },
    pph21BulkDesc: { id: 'Hitung PPh 21 untuk seluruh karyawan sekaligus', en: 'Calculate PPh 21 for all employees at once', ko: '모든 직원의 PPh 21을 한번에 계산', ja: '全従業員のPPh 21を一括計算', zh: '一次性计算所有员工的PPh 21' },
    ebupotTitle: { id: 'Bulk e-Bupot 1721-A1', en: 'Bulk e-Bupot 1721-A1', ko: 'e-Bupot 1721-A1 일괄 생성', ja: 'e-Bupot 1721-A1一括生成', zh: '批量e-Bupot 1721-A1' },
    ecommerceTitle: { id: 'Import E-commerce', en: 'E-commerce Import', ko: 'E-커머스 가져오기', ja: 'Eコマースインポート', zh: '电商导入' },
    tpTitle: { id: 'Transfer Pricing Analysis', en: 'Transfer Pricing Analysis', ko: '이전가격 분석', ja: '移転価格分析', zh: '转让定价分析' },
    tpAnalyze: { id: 'Analisis TP', en: 'TP Analysis', ko: 'TP 분석', ja: 'TP分析', zh: 'TP分析' },
    marketplaceTitle: { id: 'Cari Konsultan Pajak', en: 'Find Tax Consultant', ko: '세무 컨설턴트 찾기', ja: '税理士を探す', zh: '查找税务顾问' },
    marketplaceDesc: { id: 'Temukan konsultan pajak terpercaya untuk kebutuhan Anda', en: 'Find trusted tax consultants for your needs', ko: '필요에 맞는 신뢰할 수 있는 세무 컨설턴트를 찾으세요', ja: 'ニーズに合った信頼できる税理士を見つける', zh: '找到值得信赖的税务顾问' },
    referralTitle: { id: 'Program Referral', en: 'Referral Program', ko: '추천 프로그램', ja: '紹介プログラム', zh: '推荐计划' },
    inviteFriends: { id: 'Ajak Teman, Dapat Hadiah!', en: 'Invite Friends, Get Rewards!', ko: '친구 초대하고 보상 받기!', ja: '友達を招待して報酬をもらおう！', zh: '邀请朋友，获得奖励！' },
    referralLink: { id: 'Link Referral Anda', en: 'Your Referral Link', ko: '나의 추천 링크', ja: 'あなたの紹介リンク', zh: '您的推荐链接' },
    totalReferrals: { id: 'Total Referral', en: 'Total Referrals', ko: '총 추천 수', ja: '紹介合計', zh: '总推荐数' },
    totalRewards: { id: 'Total Hadiah', en: 'Total Rewards', ko: '총 보상', ja: '報酬合計', zh: '总奖励' },
    messagesTitle: { id: 'Pesan', en: 'Messages', ko: '메시지', ja: 'メッセージ', zh: '消息' },
    noMessages: { id: 'Belum ada pesan', en: 'No messages yet', ko: '메시지가 없습니다', ja: 'メッセージはありません', zh: '暂无消息' },
    typeMessage: { id: 'Ketik pesan...', en: 'Type a message...', ko: '메시지를 입력하세요...', ja: 'メッセージを入力...', zh: '输入消息...' },
    back: { id: 'Kembali', en: 'Back', ko: '뒤로', ja: '戻る', zh: '返回' },
    selectClient: { id: 'Pilih Klien', en: 'Select Client', ko: '고객 선택', ja: 'クライアントを選択', zh: '选择客户' },
    changeClient: { id: 'Ganti Klien', en: 'Change Client', ko: '고객 변경', ja: 'クライアントを変更', zh: '更换客户' },
    generateReport: { id: 'Generate Laporan', en: 'Generate Report', ko: '리포트 생성', ja: 'レポート生成', zh: '生成报告' },
    addEmployee: { id: 'Tambah Karyawan', en: 'Add Employee', ko: '직원 추가', ja: '従業員追加', zh: '添加员工' },
    generate: { id: 'Generate', en: 'Generate', ko: '생성', ja: '生成', zh: '生成' },
    downloadCsv: { id: 'Download CSV', en: 'Download CSV', ko: 'CSV 다운로드', ja: 'CSVダウンロード', zh: '下载CSV' },
    contact: { id: 'Hubungi', en: 'Contact', ko: '연락', ja: '連絡', zh: '联系' },
    aiProcessing: { id: 'AI sedang meringkas...', en: 'AI is summarizing...', ko: 'AI가 요약 중...', ja: 'AI要約中...', zh: 'AI正在总结...' },
    monthlySalary: { id: 'Gaji Bulanan', en: 'Monthly Salary', ko: '월급', ja: '月給', zh: '月薪' },
    monthlyRevenue: { id: 'Revenue Bulanan', en: 'Monthly Revenue', ko: '월 매출', ja: '月間売上', zh: '月收入' },
    monthlyExpense: { id: 'Pengeluaran Bulanan', en: 'Monthly Expenses', ko: '월 지출', ja: '月間支出', zh: '月支出' },
  },

  spt: {
    uploadBuktiPotong: { id: 'Upload Bukti Potong (1721-A1)', en: 'Upload Tax Slip (1721-A1)', ko: '원천징수 영수증 업로드 (1721-A1)', ja: '源泉徴収票アップロード (1721-A1)', zh: '上传扣缴凭证 (1721-A1)' },
    uploadDesc: { id: 'Upload dokumen Bukti Potong PPh 21 untuk mengisi SPT secara otomatis. AI akan membaca dan mengekstrak data dari dokumen Anda.', en: 'Upload PPh 21 tax slip to auto-fill SPT. AI will read and extract data from your document.', ko: 'PPh 21 원천징수 영수증을 업로드하면 SPT가 자동으로 채워집니다. AI가 문서에서 데이터를 읽고 추출합니다.', ja: 'PPh 21源泉徴収票をアップロードしてSPTを自動入力。AIが書類からデータを読み取り抽出します。', zh: '上传PPh 21扣缴凭证以自动填写SPT。AI将从您的文件中读取和提取数据。' },
    skipUpload: { id: 'Lewati Upload', en: 'Skip Upload', ko: '업로드 건너뛰기', ja: 'アップロードをスキップ', zh: '跳过上传' },
    continueWith: { id: 'Lanjutkan', en: 'Continue', ko: '계속', ja: '続行', zh: '继续' },
    sptSettings: { id: 'Pengaturan SPT', en: 'SPT Settings', ko: 'SPT 설정', ja: 'SPT設定', zh: 'SPT设置' },
    generateSpt: { id: 'Generate SPT', en: 'Generate SPT', ko: 'SPT 생성', ja: 'SPT生成', zh: '生成SPT' },
    generating: { id: 'Generating...', en: 'Generating...', ko: '생성 중...', ja: '生成中...', zh: '生成中...' },
    validateSpt: { id: 'Validasi SPT', en: 'Validate SPT', ko: 'SPT 검증', ja: 'SPT検証', zh: '验证SPT' },
    validating: { id: 'Memvalidasi...', en: 'Validating...', ko: '검증 중...', ja: '検証中...', zh: '验证中...' },
    downloadPdf: { id: 'Download PDF', en: 'Download PDF', ko: 'PDF 다운로드', ja: 'PDFダウンロード', zh: '下载PDF' },
    editData: { id: 'Edit Data', en: 'Edit Data', ko: '데이터 수정', ja: 'データ編集', zh: '编辑数据' },
    taxpayerInfo: { id: 'Identitas Wajib Pajak', en: 'Taxpayer Identity', ko: '납세자 정보', ja: '納税者情報', zh: '纳税人信息' },
    incomeList: { id: 'Daftar Penghasilan', en: 'Income List', ko: '소득 목록', ja: '所得一覧', zh: '收入列表' },
    calcSummary: { id: 'Ringkasan Perhitungan', en: 'Calculation Summary', ko: '계산 요약', ja: '計算概要', zh: '计算摘要' },
    validationResult: { id: 'Hasil Validasi', en: 'Validation Result', ko: '검증 결과', ja: '検証結果', zh: '验证结果' },
    disclaimer: { id: 'SPT ini dibuat berdasarkan data yang tersedia. Pastikan semua informasi sudah benar sebelum melakukan pelaporan ke DJP.', en: 'This SPT is generated based on available data. Please verify all information before filing with DJP.', ko: '이 SPT는 사용 가능한 데이터를 기반으로 생성되었습니다. DJP에 제출하기 전에 모든 정보를 확인하세요.', ja: 'このSPTは利用可能なデータに基づいて作成されています。DJPに提出する前にすべての情報を確認してください。', zh: '此SPT基于可用数据生成。请在向DJP提交之前验证所有信息。' },
  },
};

for (const locale of LOCALES) {
  const filePath = path.join(MESSAGES_DIR, `${locale}.json`);
  const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  for (const [section, keys] of Object.entries(NEW_KEYS)) {
    if (!content[section]) content[section] = {};
    for (const [key, translations] of Object.entries(keys)) {
      if (!content[section][key]) content[section][key] = translations[locale] || translations['en'] || '';
    }
  }
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n');
  console.log(`Updated: ${locale}.json`);
}
console.log('Done! Added keys for:', Object.keys(NEW_KEYS).join(', '));
