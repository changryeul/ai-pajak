import * as fs from 'fs';
import * as path from 'path';
const MESSAGES_DIR = path.resolve(process.cwd(), 'src/i18n/messages');
const LOCALES = ['id', 'en', 'ko', 'ja', 'zh'];
type Tr = Record<string, string>;

const K: Record<string, Tr> = {
  headerTitle: { id: 'Dasbor', en: 'Dashboard', ko: '대시보드', ja: 'ダッシュボード', zh: '仪表板' },
  headerSubtitle: {
    id: 'Riwayat pelaporan dan perubahan aset/utang Anda',
    en: 'Recent filings and asset/liability changes',
    ko: '최근 신고 이력 및 자산/부채 변동을 확인하세요',
    ja: '最近の申告履歴と資産・負債の変動',
    zh: '查看近期申报记录与资产/负债变动',
  },
  filterNationality: { id: 'Kewarganegaraan', en: 'Nationality', ko: '국적', ja: '国籍', zh: '国籍' },
  filterTaxRule: { id: 'Standar Pajak', en: 'Tax Rule', ko: '세법 기준', ja: '税法基準', zh: '税法标准' },
  nationalityKR: { id: 'Korea', en: 'Korea', ko: '한국', ja: '韓国', zh: '韩国' },
  nationalityID: { id: 'Indonesia', en: 'Indonesia', ko: '인도네시아', ja: 'インドネシア', zh: '印尼' },
  nationalityUS: { id: 'Amerika Serikat', en: 'USA', ko: '미국', ja: '米国', zh: '美国' },
  nationalityJP: { id: 'Jepang', en: 'Japan', ko: '일본', ja: '日本', zh: '日本' },
  recentFilings: { id: 'Riwayat Pelaporan 3 Tahun', en: 'Last 3 Years of Filings', ko: '최근 3년 신고 이력', ja: '直近3年の申告履歴', zh: '近3年申报记录' },
  yearFiling: { id: 'Pelaporan {year}', en: '{year} filing', ko: '{year}년 신고', ja: '{year}年申告', zh: '{year}年申报' },
  statusCompleted: { id: 'Selesai', en: 'Completed', ko: '완료', ja: '完了', zh: '完成' },
  statusPending: { id: 'Belum', en: 'Pending', ko: '미신고', ja: '未申告', zh: '未申报' },
  statusInProgress: { id: 'Sedang Diproses', en: 'In Progress', ko: '진행 중', ja: '進行中', zh: '进行中' },
  spouseFilingMode: { id: 'Metode Pelaporan Pasangan', en: 'Spouse Filing Mode', ko: '배우자 신고 방식', ja: '配偶者申告方法', zh: '配偶申报方式' },
  spouseJointNpwp: {
    id: 'NPWP Gabung (Suami/Istri digabung)',
    en: 'Joint NPWP (combined)',
    ko: 'NPWP 통합 신고 (남편/아내 합산)',
    ja: 'NPWP統合申告（夫婦合算）',
    zh: 'NPWP合并申报（夫妇合算）',
  },
  spouseSeparateNpwp: {
    id: 'NPWP Terpisah (masing-masing)',
    en: 'Separate NPWP',
    ko: '개별 신고 (각자 NPWP)',
    ja: 'NPWP個別申告',
    zh: '各自NPWP分别申报',
  },
  dependents: { id: 'Jumlah Tanggungan', en: 'Dependents', ko: '부양가족 수', ja: '扶養家族数', zh: '抚养人数' },
  assetsTitle: { id: 'Aset (Assets)', en: 'Assets', ko: '자산 (Assets)', ja: '資産 (Assets)', zh: '资产 (Assets)' },
  liabilitiesTitle: { id: 'Liabilitas (Liabilities)', en: 'Liabilities', ko: '부채 (Liabilities)', ja: '負債 (Liabilities)', zh: '负债 (Liabilities)' },
  cashBank: { id: 'Kas / Bank', en: 'Cash / Bank', ko: '현금 / 은행', ja: '現金・銀行', zh: '现金/银行' },
  realEstate: { id: 'Properti', en: 'Real Estate', ko: '부동산', ja: '不動産', zh: '房地产' },
  foreignAssets: { id: 'Aset Luar Negeri', en: 'Foreign Assets', ko: '해외 자산', ja: '海外資産', zh: '海外资产' },
  bankLoan: { id: 'Pinjaman Bank', en: 'Bank Loan', ko: '은행 대출', ja: '銀行ローン', zh: '银行贷款' },
  foreignLiabilities: { id: 'Utang Luar Negeri', en: 'Foreign Liabilities', ko: '해외 부채', ja: '海外負債', zh: '海外负债' },
  domesticAssetTrend: { id: 'Perubahan Aset (Domestik)', en: 'Asset Trend (Domestic)', ko: '자산 변동 (국내)', ja: '資産推移（国内）', zh: '资产变动 (国内)' },
  domesticLiabilityTrend: { id: 'Perubahan Utang (Domestik)', en: 'Liability Trend (Domestic)', ko: '부채 변동 (국내)', ja: '負債推移（国内）', zh: '负债变动 (国内)' },
  foreignAssetTrend: { id: 'Perubahan Aset Luar Negeri', en: 'Foreign Asset Trend', ko: '해외 자산 변동', ja: '海外資産の推移', zh: '海外资产变动' },
  foreignLiabilityTrend: { id: 'Perubahan Utang Luar Negeri', en: 'Foreign Liability Trend', ko: '해외 부채 변동', ja: '海外負債の推移', zh: '海外负债变动' },

  // Chart series labels
  serBuilding: { id: 'Bangunan', en: 'Building', ko: '건물', ja: '建物', zh: '建筑' },
  serVehicle: { id: 'Kendaraan', en: 'Vehicle', ko: '자동차', ja: '車両', zh: '车辆' },
  serStocks: { id: 'Saham', en: 'Stocks', ko: '주식', ja: '株式', zh: '股票' },
  serLand: { id: 'Tanah', en: 'Land', ko: '토지', ja: '土地', zh: '土地' },
  serCash: { id: 'Kas', en: 'Cash', ko: '현금', ja: '現金', zh: '现金' },
  serLoan: { id: 'Pinjaman', en: 'Loan', ko: '대출', ja: 'ローン', zh: '贷款' },
  serCredit: { id: 'Kredit', en: 'Credit', ko: '신용', ja: '信用', zh: '信用' },
  serForeignRealEstate: { id: 'Properti LN', en: 'Foreign Real Estate', ko: '해외 부동산', ja: '海外不動産', zh: '海外房产' },
  serForeignStocks: { id: 'Saham LN', en: 'Foreign Stocks', ko: '해외 주식', ja: '海外株式', zh: '海外股票' },
  serForeignCash: { id: 'Kas LN', en: 'Foreign Cash', ko: '해외 현금', ja: '海外現金', zh: '海外现金' },
  serForeignLoan: { id: 'Pinjaman LN', en: 'Foreign Loan', ko: '해외 대출', ja: '海外ローン', zh: '海外贷款' },

  anomalyTitle: {
    id: '⚠ Deteksi Anomali Peningkatan Aset',
    en: '⚠ Asset-growth anomaly detected',
    ko: '⚠ 자산 증가 이상 감지',
    ja: '⚠ 資産増加の異常検知',
    zh: '⚠ 资产增长异常检测',
  },
  anomalyBody: {
    id: 'Pertumbuhan aset baru-baru ini jauh melebihi pertumbuhan penghasilan. (Aset +{assetPct}% vs Penghasilan +{incomePct}%)',
    en: 'Your recent asset growth far exceeds income growth. (Assets +{assetPct}% vs income +{incomePct}%)',
    ko: '최근 자산 증가율이 소득 증가율 대비 과도합니다. (자산 +{assetPct}% vs 소득 +{incomePct}%)',
    ja: '最近の資産増加率が所得増加率を大幅に上回っています。（資産+{assetPct}% vs 所得+{incomePct}%）',
    zh: '最近资产增长率大幅超过收入增长率。(资产 +{assetPct}% vs 收入 +{incomePct}%)',
  },
  fundSourceTitle: {
    id: '💬 Konfirmasi Sumber Dana',
    en: '💬 Confirm source of funds',
    ko: '💬 자산 증가 자금 출처 확인',
    ja: '💬 資産増加の資金出所確認',
    zh: '💬 确认资金来源',
  },
  fundSourceHint: {
    id: 'Pertumbuhan aset cukup besar. Silakan konfirmasi sumber dananya.',
    en: 'The recent growth is significant. Please confirm the source of funds.',
    ko: '최근 자산 증가폭이 커서 자금 출처를 확인하는 것이 좋습니다.',
    ja: '最近の資産増加が大きいため、資金出所の確認をおすすめします。',
    zh: '近期资产增长幅度较大,建议确认资金来源。',
  },
  fsSalary: { id: 'Penghasilan Gaji', en: 'Salary income', ko: '급여소득', ja: '給与所得', zh: '工资收入' },
  fsBusiness: { id: 'Penghasilan Usaha', en: 'Business income', ko: '사업소득', ja: '事業所得', zh: '经营收入' },
  fsInvestment: { id: 'Hasil Investasi', en: 'Investment return', ko: '투자수익', ja: '投資収益', zh: '投资收益' },
  fsLoan: { id: 'Pinjaman', en: 'Borrowing', ko: '차입금', ja: '借入金', zh: '借款' },
  fsGift: { id: 'Hibah / Warisan', en: 'Gift / Inheritance', ko: '증여/상속', ja: '贈与・相続', zh: '赠与/继承' },
  fsOther: { id: 'Lainnya', en: 'Other', ko: '기타', ja: 'その他', zh: '其他' },

  aiCommentTitle: { id: 'Komentar Analisis AI', en: 'AI Analysis', ko: 'AI 분석 코멘트', ja: 'AI分析コメント', zh: 'AI分析评论' },
  aiAssetGrowth: {
    id: 'Pertumbuhan aset terakhir: {pct}%',
    en: 'Recent asset growth: {pct}%',
    ko: '최근 자산 증가율: {pct}%',
    ja: '最近の資産増加率: {pct}%',
    zh: '近期资产增长率: {pct}%',
  },
  aiIncomeGrowth: {
    id: 'Pertumbuhan penghasilan terakhir: {pct}%',
    en: 'Recent income growth: {pct}%',
    ko: '최근 소득 증가율: {pct}%',
    ja: '最近の所得増加率: {pct}%',
    zh: '近期收入增长率: {pct}%',
  },
  aiReviewNeeded: {
    id: 'Pertumbuhan aset melebihi penghasilan — review pajak diperlukan.',
    en: 'Asset growth outpaces income — tax review recommended.',
    ko: '자산 증가가 소득 대비 과도하여 세무 검토가 필요합니다.',
    ja: '資産増加が所得を上回るため、税務レビューが必要です。',
    zh: '资产增长超过收入，建议进行税务检查。',
  },
  aiForeignNote: {
    id: 'Periksa kewajiban pelaporan untuk aset luar negeri yang bertambah.',
    en: 'Verify reporting obligations for any new foreign assets.',
    ko: '해외 자산 증가 시 신고 여부를 반드시 확인하세요.',
    ja: '海外資産が増えた場合は申告義務の確認を。',
    zh: '海外资产增加时请务必确认申报义务。',
  },

  startFilingCta: { id: 'Mulai Pelaporan', en: 'Start Filing', ko: '신고 시작하기', ja: '申告を開始', zh: '开始申报' },
  viewProgressCta: { id: 'Lihat Kemajuan', en: 'View Progress', ko: '진행현황 보기', ja: '進捗を見る', zh: '查看进度' },
};

for (const locale of LOCALES) {
  const fp = path.join(MESSAGES_DIR, `${locale}.json`);
  const c = JSON.parse(fs.readFileSync(fp, 'utf-8'));
  if (!c.personalDashV3) c.personalDashV3 = {};
  for (const [k, tr] of Object.entries(K)) {
    c.personalDashV3[k] = tr[locale] || tr['en'] || '';
  }
  fs.writeFileSync(fp, JSON.stringify(c, null, 2) + '\n');
}
console.log('Done: personalDashV3 namespace added');
