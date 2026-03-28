import * as fs from 'fs';
import * as path from 'path';
const MESSAGES_DIR = path.resolve(process.cwd(), 'src/i18n/messages');
const LOCALES = ['id', 'en', 'ko', 'ja', 'zh'];
const NEW_KEYS: Record<string, Record<string, Record<string, string>>> = {
  sptSelect: {
    title: { id: 'SPT Tahunan', en: 'Annual Tax Return', ko: '연간 세금 신고', ja: '年次確定申告', zh: '年度纳税申报' },
    subtitle: { id: 'Pilih jenis formulir SPT Tahunan yang sesuai dengan kondisi Anda', en: 'Select the annual tax form that suits your situation', ko: '상황에 맞는 연간 세금 신고서를 선택하세요', ja: 'ご状況に合った年次確定申告書を選択', zh: '选择适合您情况的年度纳税申报表' },
    ss_title: { id: 'SPT 1770 SS', en: 'SPT 1770 SS', ko: 'SPT 1770 SS', ja: 'SPT 1770 SS', zh: 'SPT 1770 SS' },
    ss_desc: { id: 'Formulir Sangat Sederhana', en: 'Very Simple Form', ko: '매우 간단한 양식', ja: '非常に簡単なフォーム', zh: '非常简单的表格' },
    ss_audience: { id: 'Karyawan dengan penghasilan bruto < Rp 60 juta/tahun dari satu pemberi kerja', en: 'Employees with gross income < Rp 60M/year from one employer', ko: '한 고용주에서 총소득 < Rp 6천만/년인 직원', ja: '1つの雇用主からの総所得が6,000万ルピア未満の従業員', zh: '来自一个雇主的年总收入低于6000万卢比的员工' },
    ss_f1: { id: 'Penghasilan dari satu pemberi kerja', en: 'Income from one employer', ko: '한 고용주의 소득', ja: '1つの雇用主からの所得', zh: '来自一个雇主的收入' },
    ss_f2: { id: 'Penghasilan bruto < Rp 60 juta', en: 'Gross income < Rp 60M', ko: '총소득 < Rp 6천만', ja: '総所得6,000万ルピア未満', zh: '总收入低于6000万卢比' },
    ss_f3: { id: 'Tidak ada penghasilan lain', en: 'No other income', ko: '다른 소득 없음', ja: '他の所得なし', zh: '没有其他收入' },
    s_title: { id: 'SPT 1770 S', en: 'SPT 1770 S', ko: 'SPT 1770 S', ja: 'SPT 1770 S', zh: 'SPT 1770 S' },
    s_desc: { id: 'Formulir Sederhana', en: 'Simple Form', ko: '간단한 양식', ja: '簡単なフォーム', zh: '简单表格' },
    s_audience: { id: 'Karyawan dengan penghasilan bruto >= Rp 60 juta atau dari lebih dari satu pemberi kerja', en: 'Employees with gross income >= Rp 60M or from multiple employers', ko: '총소득 >= Rp 6천만 또는 복수 고용주인 직원', ja: '総所得6,000万ルピア以上または複数の雇用主', zh: '总收入超过6000万卢比或来自多个雇主的员工' },
    s_f1: { id: 'Satu atau lebih pemberi kerja', en: 'One or more employers', ko: '하나 이상의 고용주', ja: '1つ以上の雇用主', zh: '一个或多个雇主' },
    s_f2: { id: 'Penghasilan bruto >= Rp 60 juta', en: 'Gross income >= Rp 60M', ko: '총소득 >= Rp 6천만', ja: '総所得6,000万ルピア以上', zh: '总收入超过6000万卢比' },
    s_f3: { id: 'Penghasilan lain (bunga, dividen, dll)', en: 'Other income (interest, dividends, etc.)', ko: '기타 소득 (이자, 배당 등)', ja: 'その他の所得（利子、配当等）', zh: '其他收入（利息、股息等）' },
    full_desc: { id: 'Formulir Lengkap', en: 'Complete Form', ko: '완전한 양식', ja: '完全なフォーム', zh: '完整表格' },
    full_audience: { id: 'Wajib pajak dengan penghasilan dari usaha atau pekerjaan bebas', en: 'Taxpayers with business or freelance income', ko: '사업 또는 프리랜서 소득이 있는 납세자', ja: '事業所得またはフリーランス所得のある納税者', zh: '有营业或自由职业收入的纳税人' },
    full_f1: { id: 'Penghasilan dari usaha', en: 'Business income', ko: '사업 소득', ja: '事業所得', zh: '营业收入' },
    full_f2: { id: 'Pekerjaan bebas (dokter, pengacara, dll)', en: 'Freelance (doctor, lawyer, etc.)', ko: '프리랜서 (의사, 변호사 등)', ja: 'フリーランス（医師、弁護士等）', zh: '自由职业（医生、律师等）' },
    full_f3: { id: 'Pembukuan atau Norma', en: 'Bookkeeping or Standard', ko: '부기 또는 표준', ja: '帳簿または標準', zh: '记账或标准' },
    full_f4: { id: 'Kompensasi kerugian', en: 'Loss compensation', ko: '손실 보상', ja: '損失補填', zh: '亏损弥补' },
    badan_desc: { id: 'Formulir Badan', en: 'Corporate Form', ko: '법인 양식', ja: '法人フォーム', zh: '企业表格' },
    badan_audience: { id: 'Wajib pajak badan (PT, CV, Firma, Koperasi, Yayasan)', en: 'Corporate taxpayers (PT, CV, Firm, Cooperative, Foundation)', ko: '법인 납세자 (PT, CV, 사무소, 협동조합, 재단)', ja: '法人納税者（PT、CV、事務所、協同組合、財団）', zh: '企业纳税人（PT、CV、事务所、合作社、基金会）' },
    badan_f1: { id: 'Tarif PPh Badan 22%', en: 'Corporate tax rate 22%', ko: '법인세율 22%', ja: '法人税率22%', zh: '企业税率22%' },
    badan_f2: { id: 'Tarif UMKM 11% (omzet < Rp 50 miliar)', en: 'SME rate 11% (revenue < Rp 50B)', ko: 'UMKM 세율 11% (매출 < Rp 500억)', ja: 'UMKM税率11%（売上500億ルピア未満）', zh: '中小企业税率11%（营收低于500亿卢比）' },
    badan_f3: { id: 'Koreksi fiskal', en: 'Fiscal correction', ko: '세무 조정', ja: '税務調整', zh: '税务调整' },
    badan_f4: { id: 'Kompensasi kerugian 10 tahun', en: '10-year loss compensation', ko: '10년 손실 보상', ja: '10年間の損失補填', zh: '10年亏损弥补' },
    select: { id: 'Pilih', en: 'Select', ko: '선택', ja: '選択', zh: '选择' },
  },
  taxSavingsPage: {
    title: { id: 'Tax Savings Advisor', en: 'Tax Savings Advisor', ko: '절세 추천', ja: '節税アドバイザー', zh: '节税顾问' },
    subtitle: { id: 'Analisis cerdas untuk menemukan peluang penghematan pajak berdasarkan data Anda.', en: 'Smart analysis to find tax saving opportunities based on your data.', ko: '데이터 기반 AI 분석으로 절세 기회를 찾아드립니다.', ja: 'あなたのデータに基づいたAI分析で節税の機会を見つけます。', zh: '基于您的数据进行AI分析，发现节税机会。' },
    analyze: { id: 'Analisis Penghematan Pajak', en: 'Analyze Tax Savings', ko: '절세 분석', ja: '節税分析', zh: '分析节税' },
    analyzing: { id: 'Menganalisis...', en: 'Analyzing...', ko: '분석 중...', ja: '分析中...', zh: '分析中...' },
    currentTax: { id: 'PPh Saat Ini', en: 'Current Tax', ko: '현재 세금', ja: '現在の税金', zh: '当前税款' },
    potentialSavings: { id: 'Potensi Hemat', en: 'Potential Savings', ko: '잠재적 절감', ja: '節約可能額', zh: '潜在节省' },
    optimizedTax: { id: 'PPh Optimal', en: 'Optimized Tax', ko: '최적화 세금', ja: '最適税額', zh: '优化税款' },
    effectiveRate: { id: 'Tarif efektif', en: 'Effective rate', ko: '실효세율', ja: '実効税率', zh: '有效税率' },
    savingsPercent: { id: 'Potensi Penghematan', en: 'Potential Savings', ko: '잠재적 절감', ja: '節約可能', zh: '潜在节省' },
    fromCurrentTax: { id: 'dari pajak saat ini', en: 'of current tax', ko: '현재 세금 대비', ja: '現在の税金の', zh: '占当前税款' },
    aiAnalysis: { id: 'Analisis AI', en: 'AI Analysis', ko: 'AI 분석', ja: 'AI分析', zh: 'AI分析' },
    recommendations: { id: 'Rekomendasi', en: 'Recommendations', ko: '추천', ja: '推奨', zh: '建议' },
    save: { id: 'Hemat', en: 'Save', ko: '절감', ja: '節約', zh: '节省' },
    stepsToTake: { id: 'Langkah yang harus dilakukan', en: 'Steps to take', ko: '수행할 단계', ja: '実施すべきステップ', zh: '需要执行的步骤' },
    legalBasis: { id: 'Dasar hukum', en: 'Legal basis', ko: '법적 근거', ja: '法的根拠', zh: '法律依据' },
    noSavings: { id: 'Pajak Anda sudah optimal!', en: 'Your tax is already optimal!', ko: '세금이 이미 최적화되어 있습니다!', ja: '税金はすでに最適化されています！', zh: '您的税款已经是最优的！' },
    noSavingsDesc: { id: 'Tidak ditemukan peluang penghematan tambahan.', en: 'No additional saving opportunities found.', ko: '추가 절감 기회가 없습니다.', ja: '追加の節約機会は見つかりませんでした。', zh: '未发现额外的节省机会。' },
    easy: { id: 'Mudah', en: 'Easy', ko: '쉬움', ja: '簡単', zh: '容易' },
    medium: { id: 'Sedang', en: 'Medium', ko: '보통', ja: '中程度', zh: '中等' },
    hard: { id: 'Sulit', en: 'Hard', ko: '어려움', ja: '難しい', zh: '困难' },
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
console.log('Done! Added: sptSelect (SPT form descriptions), taxSavingsPage');
