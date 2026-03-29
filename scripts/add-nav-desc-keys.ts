import * as fs from 'fs';
import * as path from 'path';
const DIR = path.resolve(process.cwd(), 'src/i18n/messages');

const keys: Record<string, Record<string, string>> = {
  dashboard: { id: 'Ringkasan pajak Anda', en: 'Your tax overview', ko: '세금 요약', ja: '税務概要', zh: '税务概览' },
  customers: { id: 'Kelola klien Anda', en: 'Manage your clients', ko: '고객 관리', ja: 'クライアント管理', zh: '管理客户' },
  filings: { id: 'Cek status pelaporan', en: 'Check filing status', ko: '신고 상태 확인', ja: '申告状況確認', zh: '查看申报状态' },
  documents: { id: 'Upload & kelola dokumen', en: 'Upload & manage documents', ko: '문서 업로드 & 관리', ja: '書類アップロード＆管理', zh: '上传和管理文件' },
  reports: { id: 'Laporan pajak tahunan', en: 'Annual tax reports', ko: '연간 세금 보고서', ja: '年次税務レポート', zh: '年度税务报告' },
  monthlyPayments: { id: 'Bayar PPh & PPN bulanan', en: 'Pay monthly PPh & VAT', ko: '월별 PPh & PPN 납부', ja: '月次PPh＆PPN納付', zh: '每月PPh和PPN缴纳' },
  taxCalendar: { id: 'Jangan sampai telat bayar', en: "Don't miss deadlines", ko: '마감일 놓치지 마세요', ja: '期限を逃さない', zh: '不要错过截止日期' },
  taxTools: { id: 'Kalkulator pajak & bea', en: 'Tax & duty calculators', ko: '세금 & 관세 계산기', ja: '税金＆関税計算', zh: '税费计算器' },
  annualReturn: { id: 'Buat SPT tahunan otomatis', en: 'Create annual tax return', ko: '연간 세금 신고서 작성', ja: '年次確定申告を作成', zh: '创建年度纳税申报表' },
  taxSavings: { id: 'AI cari penghematan pajak', en: 'AI finds tax savings', ko: 'AI가 절세 기회 찾기', ja: 'AIが節税を発見', zh: 'AI发现节税机会' },
  pph21: { id: 'Pajak gaji karyawan', en: 'Employee salary tax', ko: '근로소득세', ja: '給与所得税', zh: '工资所得税' },
  pph23: { id: 'Pajak jasa & sewa', en: 'Service & rental tax', ko: '서비스 & 임대 세금', ja: 'サービス＆賃貸税', zh: '服务和租赁税' },
  ppn: { id: 'Pajak pertambahan nilai', en: 'Value added tax', ko: '부가가치세', ja: '付加価値税', zh: '增值税' },
  newFiling: { id: 'Mulai pelaporan baru', en: 'Start new filing', ko: '새 신고 시작', ja: '新規申告を開始', zh: '开始新的申报' },
  pph21Bulk: { id: 'Hitung semua karyawan', en: 'Calculate all employees', ko: '전 직원 일괄 계산', ja: '全従業員を一括計算', zh: '批量计算所有员工' },
  anomalyDetection: { id: 'Cek risiko pemeriksaan', en: 'Check audit risks', ko: '세무 조사 리스크 확인', ja: '税務調査リスク確認', zh: '检查审计风险' },
  clientReport: { id: 'Buat laporan untuk klien', en: 'Generate client reports', ko: '고객 리포트 생성', ja: 'クライアントレポート作成', zh: '生成客户报告' },
};

for (const locale of ['id', 'en', 'ko', 'ja', 'zh']) {
  const fp = path.join(DIR, `${locale}.json`);
  const c = JSON.parse(fs.readFileSync(fp, 'utf-8'));
  if (!c.navDesc) c.navDesc = {};
  for (const [k, tr] of Object.entries(keys)) {
    c.navDesc[k] = tr[locale] || tr.en;
  }
  fs.writeFileSync(fp, JSON.stringify(c, null, 2) + '\n');
}
console.log('Done! Added navDesc keys');
