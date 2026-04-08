/**
 * Koreksi Fiskal (세무조정) Auto-Calculation Engine
 *
 * Converts commercial accounting profit → fiscal (taxable) profit.
 * Pulls data from:
 *   - Financial statements (income statement)
 *   - Inventory records (HPP/COGS)
 *   - Journal entries (expense analysis)
 *
 * Indonesian tax rules applied:
 *   - UU PPh Pasal 9(1): Non-deductible expenses
 *   - UU PPh Pasal 4(3): Non-taxable income
 *   - PP 9/2022: Construction PPh Final
 *   - PMK depreciation rules (kelompok 1-4, bangunan)
 */

export interface KoreksiFiskalItem {
  code: string;
  label: string;
  amount: number;
  source: 'AUTO' | 'MANUAL';
  reason: string;
}

export interface HPPCalculation {
  beginningStock: number;
  purchases: number;
  endingStock: number;
  hppCommercial: number;  // beginning + purchases - ending
  hppFiscal: number;      // may differ (e.g., write-down not allowed fiscally)
  difference: number;
}

export interface DepreciationCalc {
  commercial: number;
  fiscal: number;
  difference: number;
}

export interface KoreksiFiskalResult {
  commercialProfit: number;
  positiveCorrections: KoreksiFiskalItem[];
  negativeCorrections: KoreksiFiskalItem[];
  totalPositive: number;
  totalNegative: number;
  fiscalProfit: number;  // PKP
  hpp: HPPCalculation;
  depreciation: DepreciationCalc;
}

interface InputData {
  // From financial statements
  incomeStatementNetIncome: number;
  revenueTotal: number;
  cogsTotal: number;
  operatingExpenses: Array<{ code: string; name: string; amount: number }>;

  // From inventory
  inventoryRecords: Array<{
    beginning_stock: number;
    purchases: number;
    ending_stock: number;
  }>;

  // From journal entries (specific accounts to check)
  entertainmentExpense: number;   // 6800 or similar — check nominatif
  donationExpense: number;        // if any
  taxPenaltyExpense: number;      // denda pajak
  personalExpense: number;        // biaya pribadi pemegang saham
  pphBorneByCompany: number;      // PPh ditanggung perusahaan
  provisionExpense: number;       // cadangan

  // From PPh Final income (already taxed)
  pphFinalIncome: number;         // rental, construction, UMKM
  nonTaxableIncome: number;       // dividend from >25% subsidiary

  // Depreciation
  depreciationCommercial: number;
  depreciationFiscal: number;     // calculated per tax rules (kelompok 1-4)
}

/**
 * Calculate Koreksi Fiskal automatically
 */
export function calculateKoreksiFiskal(input: InputData): KoreksiFiskalResult {
  const positive: KoreksiFiskalItem[] = [];
  const negative: KoreksiFiskalItem[] = [];

  // ── POSITIVE CORRECTIONS (가산 — 비용 불인정) ──

  if (input.entertainmentExpense > 0) {
    // Entertainment without nominatif list → 50% disallowed
    // Conservative: disallow 50% (if nominatif exists, user can override)
    const disallowed = Math.round(input.entertainmentExpense * 0.5);
    if (disallowed > 0) {
      positive.push({
        code: 'ENT_50',
        label: 'Biaya entertainment (50% tanpa nominatif)',
        amount: disallowed,
        source: 'AUTO',
        reason: 'Pasal 9(1) UU PPh — 접대비 명목 리스트 미확인 시 50% 불인정',
      });
    }
  }

  if (input.donationExpense > 0) {
    positive.push({
      code: 'DONATION',
      label: 'Sumbangan/donasi',
      amount: input.donationExpense,
      source: 'AUTO',
      reason: 'Pasal 9(1)(g) UU PPh — 일반 기부금 비용 불인정',
    });
  }

  if (input.taxPenaltyExpense > 0) {
    positive.push({
      code: 'TAX_PENALTY',
      label: 'Denda & sanksi pajak',
      amount: input.taxPenaltyExpense,
      source: 'AUTO',
      reason: 'Pasal 9(1)(k) UU PPh — 세금 벌금/가산금 비용 불인정',
    });
  }

  if (input.personalExpense > 0) {
    positive.push({
      code: 'PERSONAL',
      label: 'Biaya pribadi pemegang saham',
      amount: input.personalExpense,
      source: 'AUTO',
      reason: 'Pasal 9(1)(b) UU PPh — 주주 개인 비용 불인정',
    });
  }

  if (input.pphBorneByCompany > 0) {
    positive.push({
      code: 'PPH_BORNE',
      label: 'PPh ditanggung perusahaan',
      amount: input.pphBorneByCompany,
      source: 'AUTO',
      reason: 'Pasal 9(1)(h) UU PPh — 회사 부담 PPh (Gross-up 제외)',
    });
  }

  if (input.provisionExpense > 0) {
    positive.push({
      code: 'PROVISION',
      label: 'Cadangan/penyisihan',
      amount: input.provisionExpense,
      source: 'AUTO',
      reason: 'Pasal 9(1)(c) UU PPh — 충당금 비용 불인정 (은행/보험 제외)',
    });
  }

  // Depreciation difference (commercial > fiscal)
  const depDiff = input.depreciationCommercial - input.depreciationFiscal;
  if (depDiff > 0) {
    positive.push({
      code: 'DEPR_DIFF_POS',
      label: 'Selisih penyusutan (komersial > fiskal)',
      amount: depDiff,
      source: 'AUTO',
      reason: '감가상각 차이 — 상업 감가상각이 세무보다 큰 부분',
    });
  }

  // HPP difference (inventory write-down not allowed fiscally)
  const hppBeginning = input.inventoryRecords.reduce((s, r) => s + Number(r.beginning_stock), 0);
  const hppPurchases = input.inventoryRecords.reduce((s, r) => s + Number(r.purchases), 0);
  const hppEnding = input.inventoryRecords.reduce((s, r) => s + Number(r.ending_stock), 0);
  const hppCommercial = input.cogsTotal;
  const hppFiscalCalc = hppBeginning + hppPurchases - hppEnding;
  const hppDiff = hppCommercial - hppFiscalCalc;

  if (hppDiff > 0) {
    positive.push({
      code: 'HPP_DIFF',
      label: 'Selisih HPP (재고 감액 불인정)',
      amount: hppDiff,
      source: 'AUTO',
      reason: 'HPP 상업 vs 재고관리대장 기반 HPP — 재고 평가손 세무 불인정분',
    });
  }

  // ── NEGATIVE CORRECTIONS (차감 — 비과세/기과세 소득) ──

  if (input.pphFinalIncome > 0) {
    negative.push({
      code: 'PPH_FINAL',
      label: 'Penghasilan PPh Final',
      amount: input.pphFinalIncome,
      source: 'AUTO',
      reason: 'Pasal 4(2) UU PPh — 이미 PPh Final로 과세된 소득 차감',
    });
  }

  if (input.nonTaxableIncome > 0) {
    negative.push({
      code: 'NON_TAXABLE',
      label: 'Penghasilan bukan objek pajak',
      amount: input.nonTaxableIncome,
      source: 'AUTO',
      reason: 'Pasal 4(3) UU PPh — 비과세 소득 (배당 25%+ 지분 등)',
    });
  }

  // Depreciation difference (fiscal > commercial)
  if (depDiff < 0) {
    negative.push({
      code: 'DEPR_DIFF_NEG',
      label: 'Selisih penyusutan (fiskal > komersial)',
      amount: Math.abs(depDiff),
      source: 'AUTO',
      reason: '감가상각 차이 — 세무 감가상각이 상업보다 큰 부분',
    });
  }

  if (hppDiff < 0) {
    negative.push({
      code: 'HPP_DIFF_NEG',
      label: 'Selisih HPP (재고 조정)',
      amount: Math.abs(hppDiff),
      source: 'AUTO',
      reason: 'HPP 세무 < 상업 — 차감 조정',
    });
  }

  const totalPositive = positive.reduce((s, p) => s + p.amount, 0);
  const totalNegative = negative.reduce((s, n) => s + n.amount, 0);
  const fiscalProfit = input.incomeStatementNetIncome + totalPositive - totalNegative;

  return {
    commercialProfit: input.incomeStatementNetIncome,
    positiveCorrections: positive,
    negativeCorrections: negative,
    totalPositive,
    totalNegative,
    fiscalProfit,
    hpp: {
      beginningStock: hppBeginning,
      purchases: hppPurchases,
      endingStock: hppEnding,
      hppCommercial,
      hppFiscal: hppFiscalCalc,
      difference: hppDiff,
    },
    depreciation: {
      commercial: input.depreciationCommercial,
      fiscal: input.depreciationFiscal,
      difference: depDiff,
    },
  };
}
