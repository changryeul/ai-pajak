/**
 * Per-kind calculators for `consultant_session_calc`.
 *
 * P2 mvp: thin wrappers around existing src/lib/tax/* logic that take simple
 * numeric inputs (consultant or AI-parsed) and return the rationale needed
 * to fill the calc card. P3 will feed parsed row data into these directly.
 */

import {
  determineAnnualRegime,
  UMKM_REVENUE_THRESHOLD,
  type AnnualRegimeInput,
} from '@/lib/tax/annual-regime';

export type CalcKind =
  | 'PPH21_TER'
  | 'WITHHOLDING_SUMMARY'
  | 'CORP_TAX_MONTHLY'
  | 'PPN_NET'
  | 'BANK_RECON';

export interface CalcOutput {
  kind: CalcKind;
  amount: number;
  basis: Record<string, unknown>;
  sourceSummary: string;
  rationaleSummary: string;
  confidence: number;
}

// ─── PPh 21 TER ──────────────────────────────────────────────────────
// Indonesian payroll PPh 21 monthly rate (Tarif Efektif Rata-rata) — PMK 168/2023.
// Single-bracket approximation good enough for the P2 mvp card; the full bracket
// table lives in pph21-calculator.ts for actual SPT generation.
export function calcPph21Ter(input: {
  grossMonthlyPayroll: number;
}): CalcOutput {
  const g = Math.max(0, Number(input.grossMonthlyPayroll) || 0);
  let rate = 0;
  if (g <= 5_400_000) rate = 0;
  else if (g <= 5_650_000) rate = 0.0025;
  else if (g <= 5_950_000) rate = 0.005;
  else if (g <= 6_300_000) rate = 0.0075;
  else if (g <= 6_750_000) rate = 0.01;
  else if (g <= 7_500_000) rate = 0.0125;
  else if (g <= 8_550_000) rate = 0.015;
  else if (g <= 9_650_000) rate = 0.0175;
  else if (g <= 10_050_000) rate = 0.02;
  else if (g <= 10_350_000) rate = 0.0225;
  else if (g <= 10_700_000) rate = 0.025;
  else if (g <= 11_050_000) rate = 0.03;
  else if (g <= 11_600_000) rate = 0.035;
  else if (g <= 12_500_000) rate = 0.04;
  else if (g <= 13_750_000) rate = 0.05;
  else if (g <= 15_100_000) rate = 0.06;
  else if (g <= 16_950_000) rate = 0.07;
  else if (g <= 19_750_000) rate = 0.08;
  else if (g <= 24_150_000) rate = 0.09;
  else if (g <= 26_450_000) rate = 0.1;
  else if (g <= 28_000_000) rate = 0.11;
  else if (g <= 30_050_000) rate = 0.12;
  else if (g <= 32_400_000) rate = 0.13;
  else if (g <= 35_400_000) rate = 0.14;
  else if (g <= 39_100_000) rate = 0.15;
  else if (g <= 43_850_000) rate = 0.16;
  else if (g <= 47_800_000) rate = 0.17;
  else if (g <= 51_400_000) rate = 0.18;
  else if (g <= 56_300_000) rate = 0.19;
  else if (g <= 62_200_000) rate = 0.2;
  else if (g <= 68_600_000) rate = 0.21;
  else if (g <= 77_500_000) rate = 0.22;
  else if (g <= 89_000_000) rate = 0.23;
  else if (g <= 103_000_000) rate = 0.24;
  else if (g <= 125_000_000) rate = 0.25;
  else if (g <= 157_000_000) rate = 0.26;
  else if (g <= 206_000_000) rate = 0.27;
  else if (g <= 337_000_000) rate = 0.28;
  else if (g <= 454_000_000) rate = 0.29;
  else if (g <= 550_000_000) rate = 0.3;
  else if (g <= 695_000_000) rate = 0.31;
  else if (g <= 910_000_000) rate = 0.32;
  else if (g <= 1_400_000_000) rate = 0.33;
  else rate = 0.34;

  const amount = Math.round(g * rate);
  return {
    kind: 'PPH21_TER',
    amount,
    basis: { grossMonthlyPayroll: g, terRate: rate },
    sourceSummary: `Gross payroll Rp ${g.toLocaleString('id-ID')} 기준`,
    rationaleSummary: `PMK 168/2023 TER ${(rate * 100).toFixed(2)}%`,
    confidence: 85,
  };
}

// ─── Withholding summary ─────────────────────────────────────────────
export function calcWithholdingSummary(input: {
  totalGross: number;
  averageRate: number;
}): CalcOutput {
  const g = Math.max(0, Number(input.totalGross) || 0);
  const r = Math.max(0, Math.min(1, Number(input.averageRate) || 0));
  const amount = Math.round(g * r);
  return {
    kind: 'WITHHOLDING_SUMMARY',
    amount,
    basis: { totalGross: g, averageRate: r },
    sourceSummary: `수신 인보이스 합계 Rp ${g.toLocaleString('id-ID')}`,
    rationaleSummary: `가중평균 원천세율 ${(r * 100).toFixed(2)}%`,
    confidence: 70,
  };
}

// ─── Corporate tax monthly — dual case ───────────────────────────────
export interface CorpTaxDualInput extends AnnualRegimeInput {
  monthlyRevenue?: number; // PPh Final case
  prevYearTax?: number; // PPh25 case
  manualAdjustment?: number;
  selectedCase?: 'PPH_FINAL' | 'PPH25';
}

export interface CorpTaxDualOutput extends CalcOutput {
  basis: {
    regime: 'PPH_FINAL' | 'PPH25' | 'NOT_DETERMINED';
    yearsOperating: number;
    pphFinalAmount: number;
    pph25Amount: number;
    selectedCase: 'PPH_FINAL' | 'PPH25' | null;
    warnings: string[];
    annualRevenueAnnualized: number;
    threshold: number;
  };
}

export function calcCorpTaxMonthly(input: CorpTaxDualInput): CorpTaxDualOutput {
  const monthly = Math.max(0, Number(input.monthlyRevenue) || 0);
  const annualized = monthly * 12;
  const prevTax = Math.max(0, Number(input.prevYearTax) || 0);
  const manual = Number(input.manualAdjustment) || 0;

  const pphFinalAmount = Math.round(monthly * 0.005); // 0.5% UMKM Final
  const pph25Amount = Math.round(prevTax / 12) + manual;

  const regimeRes = determineAnnualRegime({
    establishedYear: input.establishedYear,
    legalForm: input.legalForm,
    npwpPph25Elected: input.npwpPph25Elected,
    annualRevenue: annualized > 0 ? annualized : input.annualRevenue,
    priorYearRevenues: input.priorYearRevenues,
  });

  const selectedCase = input.selectedCase
    ?? (regimeRes.regime === 'PPH_FINAL' ? 'PPH_FINAL'
        : regimeRes.regime === 'PPH25' ? 'PPH25'
        : null);

  const amount = selectedCase === 'PPH_FINAL'
    ? pphFinalAmount
    : selectedCase === 'PPH25'
      ? pph25Amount
      : 0;

  return {
    kind: 'CORP_TAX_MONTHLY',
    amount,
    basis: {
      regime: regimeRes.regime,
      yearsOperating: regimeRes.yearsOperating,
      pphFinalAmount,
      pph25Amount,
      selectedCase,
      warnings: regimeRes.warnings ?? [],
      annualRevenueAnnualized: annualized,
      threshold: UMKM_REVENUE_THRESHOLD,
    },
    sourceSummary:
      selectedCase === 'PPH_FINAL'
        ? `월매출 Rp ${monthly.toLocaleString('id-ID')} × 0.5%`
        : selectedCase === 'PPH25'
          ? `전년도 산출세액 Rp ${prevTax.toLocaleString('id-ID')} / 12`
          : '회사정보 부족 — 컨설턴트 선택 필요',
    rationaleSummary:
      regimeRes.regime === 'NOT_DETERMINED'
        ? regimeRes.reason
        : `${regimeRes.title} · ${regimeRes.legalBasis}`,
    confidence: selectedCase ? 80 : 50,
  };
}

// ─── PPN net ─────────────────────────────────────────────────────────
export function calcPpnNet(input: {
  outputDpp: number;
  inputDpp: number;
  vatRate?: number;
}): CalcOutput {
  const out = Math.max(0, Number(input.outputDpp) || 0);
  const inp = Math.max(0, Number(input.inputDpp) || 0);
  const rate = Math.max(0, Math.min(1, Number(input.vatRate ?? 0.11)));
  const outputVat = Math.round(out * rate);
  const inputVat = Math.round(inp * rate);
  const amount = outputVat - inputVat;
  return {
    kind: 'PPN_NET',
    amount,
    basis: { outputDpp: out, inputDpp: inp, outputVat, inputVat, vatRate: rate },
    sourceSummary: `Output VAT Rp ${outputVat.toLocaleString('id-ID')} − Input VAT Rp ${inputVat.toLocaleString('id-ID')}`,
    rationaleSummary: amount > 0 ? 'Kurang Bayar (납부)' : amount < 0 ? 'Lebih Bayar (크레딧)' : '균형',
    confidence: 90,
  };
}

// ─── Bank reconciliation ─────────────────────────────────────────────
export function calcBankRecon(input: {
  submittedTotal: number;
  bankTotal: number;
}): CalcOutput {
  const s = Number(input.submittedTotal) || 0;
  const b = Number(input.bankTotal) || 0;
  const diff = b - s;
  return {
    kind: 'BANK_RECON',
    amount: diff,
    basis: { submittedTotal: s, bankTotal: b, diff },
    sourceSummary: `제출자료 합계 Rp ${s.toLocaleString('id-ID')} vs 통장 합계 Rp ${b.toLocaleString('id-ID')}`,
    rationaleSummary: Math.abs(diff) < 1000 ? '대사 일치' : `차이 Rp ${diff.toLocaleString('id-ID')}`,
    confidence: Math.abs(diff) < 1000 ? 95 : 60,
  };
}

export const calcEngineByKind = {
  PPH21_TER: calcPph21Ter,
  WITHHOLDING_SUMMARY: calcWithholdingSummary,
  CORP_TAX_MONTHLY: calcCorpTaxMonthly,
  PPN_NET: calcPpnNet,
  BANK_RECON: calcBankRecon,
} as const;
