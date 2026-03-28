import * as fs from 'fs';
import * as path from 'path';
const MESSAGES_DIR = path.resolve(process.cwd(), 'src/i18n/messages');
const LOCALES = ['id', 'en', 'ko', 'ja', 'zh'];
const NEW_KEYS: Record<string, Record<string, Record<string, string>>> = {
  months: {
    jan: { id: 'Januari', en: 'January', ko: '1월', ja: '1月', zh: '一月' },
    feb: { id: 'Februari', en: 'February', ko: '2월', ja: '2月', zh: '二月' },
    mar: { id: 'Maret', en: 'March', ko: '3월', ja: '3月', zh: '三月' },
    apr: { id: 'April', en: 'April', ko: '4월', ja: '4月', zh: '四月' },
    may: { id: 'Mei', en: 'May', ko: '5월', ja: '5月', zh: '五月' },
    jun: { id: 'Juni', en: 'June', ko: '6월', ja: '6月', zh: '六月' },
    jul: { id: 'Juli', en: 'July', ko: '7월', ja: '7月', zh: '七月' },
    aug: { id: 'Agustus', en: 'August', ko: '8월', ja: '8月', zh: '八月' },
    sep: { id: 'September', en: 'September', ko: '9월', ja: '9月', zh: '九月' },
    oct: { id: 'Oktober', en: 'October', ko: '10월', ja: '10月', zh: '十月' },
    nov: { id: 'November', en: 'November', ko: '11월', ja: '11月', zh: '十一月' },
    dec: { id: 'Desember', en: 'December', ko: '12월', ja: '12月', zh: '十二月' },
    list: { id: 'Januari,Februari,Maret,April,Mei,Juni,Juli,Agustus,September,Oktober,November,Desember', en: 'January,February,March,April,May,June,July,August,September,October,November,December', ko: '1월,2월,3월,4월,5월,6월,7월,8월,9월,10월,11월,12월', ja: '1月,2月,3月,4月,5月,6月,7月,8月,9月,10月,11月,12月', zh: '一月,二月,三月,四月,五月,六月,七月,八月,九月,十月,十一月,十二月' },
  },
  spt: {
    taxpayer: { id: 'Wajib Pajak', en: 'Taxpayer', ko: '납세자', ja: '納税者', zh: '纳税人' },
    taxYear: { id: 'Tahun Pajak', en: 'Tax Year', ko: '과세연도', ja: '課税年度', zh: '纳税年度' },
    ptkpStatus: { id: 'Status PTKP', en: 'PTKP Status', ko: 'PTKP 상태', ja: 'PTKPステータス', zh: 'PTKP状态' },
    correctionNumber: { id: 'Pembetulan ke-', en: 'Correction No.', ko: '수정 번호', ja: '修正番号', zh: '更正编号' },
    normal: { id: 'Normal', en: 'Normal', ko: '정상', ja: '通常', zh: '正常' },
    incomeGross: { id: 'Penghasilan Bruto', en: 'Gross Income', ko: '총소득', ja: '総所得', zh: '总收入' },
    incomeNet: { id: 'Penghasilan Neto', en: 'Net Income', ko: '순소득', ja: '純所得', zh: '净收入' },
    deductions: { id: 'Pengurang', en: 'Deductions', ko: '공제', ja: '控除', zh: '扣除' },
    positionCost: { id: 'Biaya Jabatan', en: 'Position Cost', ko: '직위비', ja: '職位費用', zh: '职位费用' },
    pension: { id: 'Iuran Pensiun', en: 'Pension', ko: '연금', ja: '年金', zh: '养老金' },
    pkp: { id: 'Penghasilan Kena Pajak (PKP)', en: 'Taxable Income (PKP)', ko: '과세소득 (PKP)', ja: '課税所得 (PKP)', zh: '应税收入 (PKP)' },
    taxDue: { id: 'PPh Terutang', en: 'Tax Due', ko: '납부할 세금', ja: '納付税額', zh: '应缴税款' },
    taxWithheld: { id: 'PPh yang Sudah Dipotong', en: 'Tax Withheld', ko: '원천징수된 세금', ja: '源泉徴収税', zh: '已扣缴税款' },
    taxPayable: { id: 'PPh Kurang Bayar', en: 'Tax Payable', ko: '추가 납부', ja: '追加納付', zh: '应补税款' },
    taxRefund: { id: 'PPh Lebih Bayar (Restitusi)', en: 'Tax Refund', ko: '환급', ja: '還付', zh: '退税' },
    nihil: { id: 'NIHIL', en: 'NIL', ko: '없음', ja: 'なし', zh: '无' },
    kurangBayar: { id: 'Kurang Bayar', en: 'Underpaid', ko: '과소납부', ja: '過少納付', zh: '少缴' },
    lebihBayar: { id: 'Lebih Bayar', en: 'Overpaid', ko: '과대납부', ja: '過大納付', zh: '多缴' },
    employer: { id: 'Pemberi Kerja', en: 'Employer', ko: '고용주', ja: '雇用主', zh: '雇主' },
    period: { id: 'Periode', en: 'Period', ko: '기간', ja: '期間', zh: '期间' },
    buktiPotongList: { id: 'Daftar Bukti Potong', en: 'Withholding Slips', ko: '원천징수 목록', ja: '源泉徴収一覧', zh: '扣缴凭证列表' },
    noBuktiPotong: { id: 'Nomor Bukti Potong', en: 'Slip Number', ko: '영수증 번호', ja: '証明書番号', zh: '凭证编号' },
    attention: { id: 'Perhatian', en: 'Attention', ko: '주의', ja: '注意', zh: '注意' },
    incomeSource: { id: 'sumber penghasilan', en: 'income source(s)', ko: '소득원', ja: '所得源', zh: '收入来源' },
    documentsReady: { id: 'dokumen siap digunakan', en: 'document(s) ready', ko: '문서 준비 완료', ja: '書類準備完了', zh: '文件已准备好' },
    noDocNote: { id: 'Tidak ada dokumen yang di-upload. SPT akan digenerate berdasarkan data Bukti Potong yang telah tersimpan atau data perhitungan pajak sebelumnya.', en: 'No documents uploaded. SPT will be generated from stored tax slips or previous calculations.', ko: '업로드된 문서가 없습니다. 저장된 원천징수 영수증 또는 이전 계산 데이터로 SPT가 생성됩니다.', ja: 'アップロードされた書類がありません。保存された源泉徴収票または以前の計算データからSPTが生成されます。', zh: '未上传文件。SPT将根据已存储的扣缴凭证或之前的计算数据生成。' },
    changeDocData: { id: 'Ubah data dokumen', en: 'Change document data', ko: '문서 데이터 변경', ja: '書類データを変更', zh: '更改文件数据' },
    fromDocuments: { id: 'Data dari Dokumen', en: 'Data from Documents', ko: '문서의 데이터', ja: '書類からのデータ', zh: '来自文件的数据' },
    aiAutofill: { id: 'AI Auto-fill', en: 'AI Auto-fill', ko: 'AI 자동 입력', ja: 'AI自動入力', zh: 'AI自动填写' },
    uploadStep: { id: 'Upload Dokumen', en: 'Upload Documents', ko: '문서 업로드', ja: '書類アップロード', zh: '上传文件' },
    settingsStep: { id: 'Pengaturan SPT', en: 'SPT Settings', ko: 'SPT 설정', ja: 'SPT設定', zh: 'SPT设置' },
    previewStep: { id: 'Preview', en: 'Preview', ko: '미리보기', ja: 'プレビュー', zh: '预览' },
  },
  integrations: {
    accurateFeature1: { id: 'Auto-import data karyawan (NPWP, NIK, PTKP)', en: 'Auto-import employee data (NPWP, NIK, PTKP)', ko: '직원 데이터 자동 가져오기 (NPWP, NIK, PTKP)', ja: '従業員データの自動インポート (NPWP, NIK, PTKP)', zh: '自动导入员工数据 (NPWP, NIK, PTKP)' },
    accurateFeature2: { id: 'Sinkronisasi data gaji bulanan (PPh 21)', en: 'Monthly payroll sync (PPh 21)', ko: '월급 데이터 동기화 (PPh 21)', ja: '月次給与データの同期 (PPh 21)', zh: '月度工资数据同步 (PPh 21)' },
    accurateFeature3: { id: 'Import laporan keuangan (Laba Rugi, Neraca)', en: 'Import financial statements (P&L, Balance Sheet)', ko: '재무제표 가져오기 (손익, 대차대조표)', ja: '財務諸表のインポート (損益、貸借対照表)', zh: '导入财务报表（利润表、资产负债表）' },
    accurateFeature4: { id: 'Rekonsiliasi faktur pajak (PPN)', en: 'Tax invoice reconciliation (VAT)', ko: '세금 계산서 대사 (부가세)', ja: '税務請求書の照合 (VAT)', zh: '税务发票对账（增值税）' },
    bankFeature1: { id: 'Tracking revenue otomatis untuk UMKM', en: 'Automatic revenue tracking for SMEs', ko: 'UMKM 자동 매출 추적', ja: 'UMKM向け自動売上追跡', zh: '中小企业自动收入跟踪' },
    bankFeature2: { id: 'Hitung PPh Final 0.5% otomatis', en: 'Auto-calculate PPh Final 0.5%', ko: 'PPh Final 0.5% 자동 계산', ja: 'PPh Final 0.5%自動計算', zh: '自动计算PPh Final 0.5%' },
    bankFeature3: { id: 'Kategorisasi transaksi (pendapatan/pengeluaran)', en: 'Transaction categorization (income/expense)', ko: '거래 분류 (수입/지출)', ja: '取引分類 (収入/支出)', zh: '交易分类（收入/支出）' },
    bankFeature4: { id: 'Pembebasan Rp 500 juta pertama (PP 55/2022)', en: 'First Rp 500M exemption (PP 55/2022)', ko: '첫 5억 루피아 면제 (PP 55/2022)', ja: '最初の5億ルピア免除 (PP 55/2022)', zh: '前5亿卢比免税 (PP 55/2022)' },
    supportedBanks: { id: 'Bank yang didukung', en: 'Supported banks', ko: '지원 은행', ja: '対応銀行', zh: '支持的银行' },
    jurnalFeature1: { id: 'Import Chart of Accounts', en: 'Import Chart of Accounts', ko: '계정과목 가져오기', ja: '勘定科目のインポート', zh: '导入会计科目' },
    jurnalFeature2: { id: 'Sinkronisasi faktur penjualan (PPN)', en: 'Sync sales invoices (VAT)', ko: '매출 인보이스 동기화 (부가세)', ja: '売上請求書の同期 (VAT)', zh: '同步销售发票（增值税）' },
    jurnalFeature3: { id: 'Import Laporan Laba Rugi & Neraca', en: 'Import P&L and Balance Sheet', ko: '손익계산서 & 대차대조표 가져오기', ja: '損益計算書＆貸借対照表のインポート', zh: '导入损益表和资产负债表' },
    jurnalFeature4: { id: 'Data kontak (pelanggan/vendor) + NPWP', en: 'Contact data (customer/vendor) + NPWP', ko: '거래처 데이터 (고객/벤더) + NPWP', ja: '連絡先データ (顧客/ベンダー) + NPWP', zh: '联系人数据（客户/供应商）+ NPWP' },
  },
};
for (const locale of LOCALES) {
  const fp = path.join(MESSAGES_DIR, `${locale}.json`);
  const c = JSON.parse(fs.readFileSync(fp, 'utf-8'));
  for (const [s, keys] of Object.entries(NEW_KEYS)) {
    if (!c[s]) c[s] = {};
    for (const [k, tr] of Object.entries(keys)) { if (!c[s][k]) c[s][k] = tr[locale] || tr['en'] || ''; }
  }
  fs.writeFileSync(fp, JSON.stringify(c, null, 2) + '\n');
}
console.log('Done! Added: months, spt fields, integrations features');
