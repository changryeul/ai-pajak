import * as fs from 'fs';
import * as path from 'path';
const MESSAGES_DIR = path.resolve(process.cwd(), 'src/i18n/messages');
const LOCALES = ['id', 'en', 'ko', 'ja', 'zh'];
type Tr = Record<string, string>;

const K: Record<string, Tr> = {
  back: { id: 'Kembali', en: 'Back', ko: '돌아가기', ja: '戻る', zh: '返回' },
  prepTitle: { id: 'Persiapan Pemeriksaan', en: 'Audit Preparation', ko: '조사 준비', ja: '調査準備', zh: '检查准备' },
  risksTitle: {
    id: 'Sinyal risiko terdeteksi dari data Anda',
    en: 'Risk signals detected from your data',
    ko: '당신의 데이터에서 감지된 리스크 시그널',
    ja: 'データから検出されたリスクシグナル',
    zh: '从您的数据中检测到的风险信号',
  },
  docsTitle: {
    id: 'Dokumen yang perlu disiapkan',
    en: 'Documents to prepare',
    ko: '준비할 서류',
    ja: '準備すべき書類',
    zh: '需要准备的文件',
  },
  questionsTitle: {
    id: 'Pertanyaan yang kemungkinan ditanyakan',
    en: 'Questions likely to be asked',
    ko: '예상 질문',
    ja: '想定される質問',
    zh: '可能被问到的问题',
  },
  startChat: {
    id: 'Mulai Simulasi',
    en: 'Start Simulation',
    ko: '시뮬레이션 시작',
    ja: 'シミュレーション開始',
    zh: '开始模拟',
  },
  chatTitle: { id: 'Simulasi Wawancara', en: 'Audit Interview', ko: '세무조사 면담', ja: '調査面談', zh: '审计访谈' },
  doneHint: {
    id: 'Simulasi selesai — buka laporan untuk rekomendasi tindak lanjut',
    en: 'Simulation complete — open the report for follow-up actions',
    ko: '시뮬레이션 완료 — 리포트에서 후속 액션 확인',
    ja: 'シミュレーション終了 — レポートで改善アクションを確認',
    zh: '模拟结束 — 查看报告以获取后续建议',
  },
  viewReport: { id: 'Lihat Laporan', en: 'View Report', ko: '리포트 보기', ja: 'レポートを見る', zh: '查看报告' },
  overall: { id: 'Skor Keseluruhan', en: 'Overall Score', ko: '종합 점수', ja: '総合スコア', zh: '综合得分' },
  dimEvidence: {
    id: 'Bukti yang Diberikan',
    en: 'Evidence Provided',
    ko: '증거 제시',
    ja: '証拠の提示',
    zh: '提供的证据',
  },
  dimClarity: { id: 'Kejelasan Jawaban', en: 'Answer Clarity', ko: '답변 명료성', ja: '回答の明瞭さ', zh: '回答清晰度' },
  dimCompliance: {
    id: 'Pemahaman Regulasi',
    en: 'Regulation Knowledge',
    ko: '법규 이해',
    ja: '規制理解',
    zh: '法规理解',
  },
  dimEvidenceShort: { id: 'Bukti', en: 'Evi', ko: '증거', ja: '証拠', zh: '证据' },
  dimClarityShort: { id: 'Jelas', en: 'Clar', ko: '명료', ja: '明瞭', zh: '清晰' },
  dimComplianceShort: { id: 'Regulasi', en: 'Reg', ko: '법규', ja: '規制', zh: '法规' },
  actions: { id: 'Tindakan Perbaikan', en: 'Improvement Actions', ko: '개선 액션', ja: '改善アクション', zh: '改进行动' },
  actionEvidence: {
    id: 'Tambahkan angka spesifik dan rujuk dokumen (nomor faktur, tanggal, rekening bank) dalam setiap jawaban.',
    en: 'Include specific numbers and cite documents (invoice no., date, bank account) in every answer.',
    ko: '모든 답변에 구체적인 숫자와 서류(송장번호, 날짜, 계좌)를 언급하세요.',
    ja: 'すべての回答に具体的な数字と書類（請求書番号、日付、口座）を示してください。',
    zh: '每个回答中加入具体数字并引用文件（发票号、日期、银行账户）。',
  },
  actionClarity: {
    id: 'Jawab dalam kalimat lengkap yang terstruktur: konteks → fakta → kesimpulan.',
    en: 'Answer in full structured sentences: context → facts → conclusion.',
    ko: '완전한 문장 구조로 답하세요: 맥락 → 사실 → 결론.',
    ja: '構造化された完全な文で答える：文脈→事実→結論。',
    zh: '以完整的结构化句子回答：背景→事实→结论。',
  },
  actionCompliance: {
    id: 'Sitasi regulasi (Pasal / PMK / PP) yang Anda rujuk — tunjukkan pemahaman dasar hukum.',
    en: 'Cite the regulation (Pasal / PMK / PP) you rely on — demonstrate knowledge of the legal basis.',
    ko: '참조 법규(Pasal/PMK/PP)를 명시하세요 — 법적 근거에 대한 이해를 보여주세요.',
    ja: '参照する規制（Pasal / PMK / PP）を示し、法的根拠の理解を示しましょう。',
    zh: '引用您依据的法规（Pasal/PMK/PP），展示对法律依据的理解。',
  },
  actionBaseline: {
    id: 'Performa bagus. Pertahankan kebiasaan dokumentasi yang baik untuk audit sesungguhnya.',
    en: 'Solid performance. Keep the documentation discipline for a real audit.',
    ko: '좋은 답변이었습니다. 실제 조사를 위해 문서 관리 습관을 유지하세요.',
    ja: '良いパフォーマンスです。本番の調査に備えて書類管理習慣を維持しましょう。',
    zh: '表现良好。请保持文档习惯以应对真正的审计。',
  },
  restart: { id: 'Mulai Lagi', en: 'Restart', ko: '다시 시작', ja: '再開', zh: '重新开始' },

  'sev.high': { id: 'Tinggi', en: 'High', ko: '높음', ja: '高', zh: '高' },
  'sev.medium': { id: 'Sedang', en: 'Medium', ko: '중간', ja: '中', zh: '中' },
  'sev.low': { id: 'Rendah', en: 'Low', ko: '낮음', ja: '低', zh: '低' },
};

for (const locale of LOCALES) {
  const fp = path.join(MESSAGES_DIR, `${locale}.json`);
  const c = JSON.parse(fs.readFileSync(fp, 'utf-8'));
  if (!c.auditSimV2) c.auditSimV2 = {};
  if (!c.auditSimV2.sev) c.auditSimV2.sev = {};
  for (const [k, tr] of Object.entries(K)) {
    if (k.startsWith('sev.')) {
      c.auditSimV2.sev[k.slice(4)] = tr[locale] || tr['en'];
    } else {
      c.auditSimV2[k] = tr[locale] || tr['en'];
    }
  }
  fs.writeFileSync(fp, JSON.stringify(c, null, 2) + '\n');
}
console.log('Done: auditSimV2 namespace added');
