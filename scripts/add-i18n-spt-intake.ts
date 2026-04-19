import * as fs from 'fs';
import * as path from 'path';
const MESSAGES_DIR = path.resolve(process.cwd(), 'src/i18n/messages');
const LOCALES = ['id', 'en', 'ko', 'ja', 'zh'];
type Tr = Record<string, string>;

const K: Record<string, Tr> = {
  headerTitle: {
    id: 'Input Data Pelaporan 1770SS',
    en: '1770SS Filing Intake',
    ko: '1770SS 신고 자료 입력',
    ja: '1770SS申告データ入力',
    zh: '1770SS申报数据录入',
  },
  back: { id: 'Kembali', en: 'Back', ko: '돌아가기', ja: '戻る', zh: '返回' },
  basicInfoTitle: { id: '기본 정보 (KK)', en: 'Basic Info (KK)', ko: '기본 정보 (KK)', ja: '基本情報 (KK)', zh: '基本信息 (KK)' },
  employmentIncomeTitle: { id: '근로소득 (A1)', en: 'Employment Income (A1)', ko: '근로소득 (A1)', ja: '給与所得 (A1)', zh: '工资收入 (A1)' },
  uploadBtn: { id: '업로드', en: 'Upload', ko: '업로드', ja: 'アップロード', zh: '上传' },
  captureBtn: { id: '촬영', en: 'Take Photo', ko: '촬영', ja: '撮影', zh: '拍照' },
  uploaded: { id: 'Terunggah', en: 'Uploaded', ko: '업로드 완료', ja: 'アップロード済み', zh: '已上传' },
  taxCreditSection: {
    id: '세액공제 / 기납부세액',
    en: 'Tax Credit / Prepaid Tax',
    ko: '세액공제 / 기납부세액',
    ja: '税額控除 / 既納付税額',
    zh: '税额抵免 / 已缴税款',
  },
  foreignTaxPlaceholder: {
    id: 'Pajak Dibayar di Luar Negeri (IDR)',
    en: 'Foreign tax paid (IDR)',
    ko: '외국납부세액',
    ja: '外国納付税額',
    zh: '国外已纳税款',
  },
  foreignTaxDocUpload: {
    id: '외국납부세액 증빙 업로드',
    en: 'Upload foreign tax receipt',
    ko: '외국납부세액 증빙 업로드',
    ja: '外国納付税額の証憑アップロード',
    zh: '上传国外纳税凭证',
  },
  assetsLiabilitiesTitle: {
    id: '자산 / 부채 상세 입력 (Coretax 기준)',
    en: 'Assets / Liabilities detail (Coretax-aligned)',
    ko: '자산 / 부채 상세 입력 (Coretax 기준)',
    ja: '資産 / 負債 詳細入力 (Coretax基準)',
    zh: '资产 / 负债 详细录入 (Coretax标准)',
  },
  importFromProfile: {
    id: '내정보에서 추가정보 입력',
    en: 'Import from profile',
    ko: '내정보에서 추가정보 입력',
    ja: 'プロフィールから取り込む',
    zh: '从我的资料导入',
  },
  assetsTitle: { id: '자산 (Harta)', en: 'Assets (Harta)', ko: '자산 (Harta)', ja: '資産 (Harta)', zh: '资产 (Harta)' },
  liabilitiesTitle: {
    id: '부채 (Utang)',
    en: 'Liabilities (Utang)',
    ko: '부채 (Utang)',
    ja: '負債 (Utang)',
    zh: '负债 (Utang)',
  },
  bankAccountsLabel: {
    id: '은행 계좌 (복수 입력 가능)',
    en: 'Bank accounts (multiple)',
    ko: '은행 계좌 (복수 입력 가능)',
    ja: '銀行口座（複数入力可）',
    zh: '银行账户 (可多条)',
  },
  bankName: { id: '은행명', en: 'Bank name', ko: '은행명', ja: '銀行名', zh: '银行名称' },
  accountNumber: { id: '계좌번호', en: 'Account number', ko: '계좌번호', ja: '口座番号', zh: '账号' },
  balanceAt1231: { id: '잔액 (12/31)', en: 'Balance (12/31)', ko: '잔액 (12/31)', ja: '残高 (12/31)', zh: '余额 (12/31)' },
  removeRow: { id: '삭제', en: 'Remove', ko: '삭제', ja: '削除', zh: '删除' },
  addAccount: { id: '+ 계좌 추가', en: '+ Add account', ko: '+ 계좌 추가', ja: '+ 口座を追加', zh: '+ 添加账户' },
  stockInvest: { id: '주식 / 투자자산', en: 'Stocks / Investments', ko: '주식 / 투자자산', ja: '株式・投資資産', zh: '股票/投资资产' },
  realEstate: { id: '부동산 (토지/건물)', en: 'Real estate (land/building)', ko: '부동산 (토지/건물)', ja: '不動産（土地・建物）', zh: '房地产 (土地/建筑)' },
  vehicle: { id: '차량', en: 'Vehicle', ko: '차량', ja: '車両', zh: '车辆' },
  businessAssets: { id: '사업자산 (기계 등)', en: 'Business assets (machinery etc.)', ko: '사업자산 (기계 등)', ja: '事業資産（機械等）', zh: '经营资产 (机器等)' },
  otherAssets: { id: '기타 자산', en: 'Other assets', ko: '기타 자산', ja: 'その他の資産', zh: '其他资产' },
  bankLoan: { id: '은행 대출', en: 'Bank loan', ko: '은행 대출', ja: '銀行ローン', zh: '银行贷款' },
  creditCard: { id: '신용카드 미지급', en: 'Credit card outstanding', ko: '신용카드 미지급', ja: 'クレジットカード未払い', zh: '信用卡未付款' },
  personalLoan: { id: '개인간 차입', en: 'Personal borrowing', ko: '개인간 차입', ja: '個人間借入', zh: '个人借款' },
  businessDebt: { id: '사업 관련 부채', en: 'Business-related debt', ko: '사업 관련 부채', ja: '事業関連負債', zh: '经营相关负债' },
  submitCta: {
    id: 'Kirim Pelaporan (Minta Proses JTC)',
    en: 'Submit Filing (Request JTC processing)',
    ko: '신고 제출 (JTC 처리 요청)',
    ja: '申告を提出（JTC処理依頼）',
    zh: '提交申报 (请求JTC处理)',
  },
  submitting: { id: 'Mengirim…', en: 'Submitting…', ko: '제출 중…', ja: '送信中…', zh: '提交中…' },
  submitSuccess: {
    id: 'Pelaporan berhasil dikirim ke JTC',
    en: 'Filing submitted to JTC',
    ko: 'JTC 담당자에게 제출되었습니다',
    ja: 'JTC担当者へ提出しました',
    zh: '已提交给JTC',
  },
  submitError: {
    id: 'Gagal mengirim pelaporan',
    en: 'Failed to submit filing',
    ko: '제출 실패',
    ja: '提出に失敗しました',
    zh: '提交失败',
  },
  uploadFailed: {
    id: 'Unggah gagal',
    en: 'Upload failed',
    ko: '업로드 실패',
    ja: 'アップロード失敗',
    zh: '上传失败',
  },
  needKKOrA1: {
    id: 'Unggah KK atau A1 minimal satu',
    en: 'Upload KK or A1 (at least one)',
    ko: 'KK 또는 A1 중 하나는 업로드해야 합니다',
    ja: 'KKまたはA1のいずれかをアップロードしてください',
    zh: '请至少上传 KK 或 A1 之一',
  },
  importDone: {
    id: '{count} rekening diimport',
    en: '{count} accounts imported',
    ko: '계좌 {count}개 불러옴',
    ja: '口座{count}件を取り込み',
    zh: '已导入{count}个账户',
  },
  importNone: {
    id: 'Tidak ada rekening di profil',
    en: 'No accounts saved in profile',
    ko: '프로필에 저장된 계좌 없음',
    ja: 'プロフィールに口座が保存されていません',
    zh: '资料中未保存账户',
  },
  importSkippedExisting: {
    id: 'Sudah ada data — dibiarkan',
    en: 'Manual entries kept',
    ko: '이미 입력된 계좌가 있어 건너뜀',
    ja: '既存の入力を保持',
    zh: '保留已填写的内容',
  },
  importFailed: {
    id: 'Import gagal',
    en: 'Import failed',
    ko: '불러오기 실패',
    ja: '取り込みに失敗',
    zh: '导入失败',
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
console.log('Done: sptIntake namespace added');
