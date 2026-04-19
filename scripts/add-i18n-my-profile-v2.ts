import * as fs from 'fs';
import * as path from 'path';
const MESSAGES_DIR = path.resolve(process.cwd(), 'src/i18n/messages');
const LOCALES = ['id', 'en', 'ko', 'ja', 'zh'];
type Tr = Record<string, string>;

const K: Record<string, Tr> = {
  title: { id: 'Info Saya', en: 'My Profile', ko: '내정보', ja: '内情報', zh: '我的信息' },
  completenessLabel: { id: 'Kelengkapan Data', en: 'Profile Completeness', ko: '정보 완성도', ja: '情報完成度', zh: '信息完整度' },
  completenessValue: { id: '{pct}% selesai', en: '{pct}% complete', ko: '{pct}% 완료', ja: '{pct}% 完了', zh: '{pct}% 完成' },
  missingRequired: {
    id: '⚠ Informasi wajib belum lengkap. Isi kolom bertanda merah.',
    en: '⚠ Required info missing. Fill in the red fields.',
    ko: '⚠ 필수 정보가 부족합니다. 빨간 항목을 입력하세요.',
    ja: '⚠ 必須情報が不足しています。赤の項目を入力してください。',
    zh: '⚠ 必填信息不足。请填写红色字段。',
  },
  autoParsedHint: {
    id: 'Periksa informasi yang otomatis terdeteksi dan lengkapi yang kurang',
    en: 'Review auto-parsed basics and complete anything missing',
    ko: '자동 파싱된 기본정보를 확인하고 부족한 내용을 보완하세요',
    ja: '自動解析された基本情報を確認し、不足分を補完してください',
    zh: '核对自动识别的基本信息并补齐缺失项',
  },

  basicInfo: { id: 'Informasi Dasar', en: 'Basic Info', ko: '기본정보', ja: '基本情報', zh: '基本信息' },
  contactInfo: { id: 'Kontak / Akun', en: 'Contact / Account', ko: '연락 / 계정정보', ja: '連絡 / アカウント情報', zh: '联系 / 账户信息' },
  taxAccountInfo: { id: 'Info Akun Pajak', en: 'Tax Account Info', ko: '세무 계정 정보', ja: '税務アカウント情報', zh: '税务账户信息' },

  fieldName: { id: 'Nama', en: 'Name', ko: '이름', ja: '氏名', zh: '姓名' },
  fieldNpwp: { id: 'NPWP', en: 'NPWP', ko: 'NPWP', ja: 'NPWP', zh: 'NPWP' },
  fieldAddress: { id: 'Alamat', en: 'Address', ko: '주소', ja: '住所', zh: '地址' },
  fieldFamilyCount: { id: 'Jumlah Tanggungan', en: 'Dependents', ko: '가족 수', ja: '扶養家族数', zh: '家庭人数' },
  fieldEmail: { id: 'Email', en: 'Email', ko: '이메일', ja: 'メール', zh: '邮箱' },
  fieldPhone: { id: 'Nomor Telepon', en: 'Phone', ko: '전화번호', ja: '電話番号', zh: '电话号码' },
  fieldCompany: { id: 'Nama Perusahaan', en: 'Company / Employer', ko: '회사명', ja: '会社名', zh: '公司名称' },
  fieldCoretaxId: { id: 'Coretax ID', en: 'Coretax ID', ko: 'Coretax ID', ja: 'Coretax ID', zh: 'Coretax ID' },
  fieldCoretaxPassword: { id: 'Kata Sandi Coretax', en: 'Coretax Password', ko: 'Coretax Password', ja: 'Coretax パスワード', zh: 'Coretax 密码' },
  fieldDjpPassword: { id: 'Kata Sandi DJP', en: 'DJP Password', ko: 'DJP Password', ja: 'DJP パスワード', zh: 'DJP 密码' },
  fieldPassphrase: { id: 'Passphrase', en: 'Passphrase', ko: 'Passphrase', ja: 'Passphrase', zh: 'Passphrase' },
  fieldEfin: { id: 'EFIN', en: 'EFIN', ko: 'EFIN', ja: 'EFIN', zh: 'EFIN' },

  saveCta: { id: 'Simpan', en: 'Save', ko: '저장', ja: '保存', zh: '保存' },
  saving: { id: 'Menyimpan…', en: 'Saving…', ko: '저장 중…', ja: '保存中…', zh: '保存中…' },
  saveSuccess: { id: 'Berhasil disimpan', en: 'Saved', ko: '저장되었습니다', ja: '保存しました', zh: '已保存' },
  saveError: { id: 'Gagal menyimpan', en: 'Save failed', ko: '저장 실패', ja: '保存に失敗', zh: '保存失败' },
  serverError: { id: 'Kesalahan server', en: 'Server error', ko: '서버 오류', ja: 'サーバーエラー', zh: '服务器错误' },
  loadError: {
    id: 'Gagal memuat profil',
    en: 'Failed to load profile',
    ko: '프로필을 불러오지 못했습니다',
    ja: 'プロフィールの読み込みに失敗',
    zh: '加载资料失败',
  },
};

for (const locale of LOCALES) {
  const fp = path.join(MESSAGES_DIR, `${locale}.json`);
  const c = JSON.parse(fs.readFileSync(fp, 'utf-8'));
  if (!c.myProfileV2) c.myProfileV2 = {};
  for (const [k, tr] of Object.entries(K)) {
    c.myProfileV2[k] = tr[locale] || tr['en'] || '';
  }
  fs.writeFileSync(fp, JSON.stringify(c, null, 2) + '\n');
}
console.log('Done: myProfileV2 namespace added');
