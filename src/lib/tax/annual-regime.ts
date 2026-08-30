/**
 * Annual Tax Regime Determination
 *
 * Determines whether a corporate customer should file annual tax under
 * PPh Final (UMKM 0.5%) or PPh 25 (general 22%/progressive) based on
 * company profile and historical revenue.
 *
 * Rules:
 * 1. If customer elected PPh 25 at NPWP creation → PPh 25 from day 1
 * 2. If within 3 years of incorporation AND cumulative revenue never exceeded 4.8B IDR
 *    → PPh Final UMKM 0.5% (first 3 settlements)
 * 3. If within 3 years but revenue exceeded 4.8B in any prior year
 *    → PPh 25 starting the next fiscal year
 * 4. If beyond 3 years of incorporation (from 4th settlement onward)
 *    → PPh 25
 * 5. If legal form is not a UMKM-eligible type (e.g., subsidiary, special entity)
 *    → PPh 25
 *
 * Legal basis:
 * - UU 7/2021 (UU HPP) Pasal 31E
 * - PP 55/2022 — UMKM PPh Final 0.5%
 * - PMK 215/PMK.03/2018 — New company exemption
 */

export type AnnualRegime = 'PPH_FINAL' | 'PPH25' | 'NOT_DETERMINED';

export const UMKM_REVENUE_THRESHOLD = 4_800_000_000; // 4.8 billion IDR
export const NEW_COMPANY_EXEMPTION_YEARS = 3;

export interface AnnualRegimeInput {
  establishedYear?: number | null;
  currentYear?: number;
  annualRevenue?: number | null;
  /** Revenue for prior years (optional, for exceeds-threshold-in-past check) */
  priorYearRevenues?: number[];
  /** Did customer elect PPh 25 at NPWP creation? */
  npwpPph25Elected?: boolean | null;
  /** Legal form: PT / CV / UD / FIRMA / KOPERASI / YAYASAN */
  legalForm?: string | null;
  /** Is UMKM registered? */
  isUmkm?: boolean | null;
  /** First year of UMKM PP 55 registration */
  umkmStartYear?: number | null;
}

export interface AnnualRegimeResult {
  regime: AnnualRegime;
  title: string;
  reason: string;
  legalBasis: string;
  yearsOperating: number;
  /** Additional guidance / warnings */
  warnings?: string[];
  /** If PPh Final, how many years remaining until forced transition */
  umkmYearsRemaining?: number;
  /** Route to the appropriate filing page */
  route: '/tax/annual/pph-final' | '/tax/annual/pph25' | null;
}

// ── PP 20/2026 (2026-04-22, mengubah PP 55/2022) ─────────────────────────────
// UMKM PPh Final 0.5% 적격 유형이 축소됨:
//   - 신규 적격: 개인(INDIVIDUAL/UD) · 1인 개인회사(PERSEROAN_PERORANGAN) · 협동조합(KOPERASI)
//   - 배제: PT · CV · FIRMA · BUMDes → 일반 법인세(PPh 25) 의무
//   - 개인/1인개인회사: 0.5% 영구(7년 시한 폐지). 협동조합: 4년 유지.
//   - 경과규정: PP 20/2026 시행(2026) 이전 이미 0.5% 를 쓰던 PT/CV/FIRMA 는
//     기존 시한(PT 3년/CV·FIRMA 4년) 종료까지 유지, 그 후 PPh 25.
export const PP20_2026_CUTOFF_YEAR = 2026; // 시행 2026-04-22
const UMKM_ELIGIBLE_ALWAYS = new Set(['INDIVIDUAL', 'UD', 'PERSEROAN_PERORANGAN', 'KOPERASI']);
const UMKM_GRANDFATHER_ONLY = new Set(['PT', 'CV', 'FIRMA']);
const PERMANENT = Number.POSITIVE_INFINITY;

/**
 * PP 20/2026 적격 여부. PT/CV/FIRMA 는 2026 이전 시작한 기존 수혜자만(경과규정).
 */
export function isUmkmFinalEligible(legalForm?: string | null, umkmStartYear?: number | null): boolean {
  if (!legalForm) return false;
  const lf = legalForm.toUpperCase();
  if (UMKM_ELIGIBLE_ALWAYS.has(lf)) return true;
  if (UMKM_GRANDFATHER_ONLY.has(lf)) {
    return !!umkmStartYear && umkmStartYear < PP20_2026_CUTOFF_YEAR; // 경과 인정
  }
  return false;
}

/**
 * PP 20/2026 기준 UMKM PPh Final 최대 연수.
 * 개인(UD/INDIVIDUAL)·1인개인회사: 영구(∞). 협동조합: 4년.
 * PT: 3년 / CV·FIRMA: 4년 (경과 수혜자에 한해 계산에 사용).
 */
export function getMaxUmkmYears(legalForm?: string | null): number {
  if (!legalForm) return NEW_COMPANY_EXEMPTION_YEARS;
  switch (legalForm.toUpperCase()) {
    case 'INDIVIDUAL':
    case 'UD':
    case 'PERSEROAN_PERORANGAN': return PERMANENT;
    case 'KOPERASI': return 4;
    case 'PT': return 3;         // 경과 수혜자 전용
    case 'CV':
    case 'FIRMA': return 4;      // 경과 수혜자 전용
    default: return NEW_COMPANY_EXEMPTION_YEARS;
  }
}

export function determineAnnualRegime(input: AnnualRegimeInput): AnnualRegimeResult {
  const currentYear = input.currentYear ?? new Date().getFullYear();
  const establishedYear = input.establishedYear || 0;
  const yearsOperating = establishedYear > 0 ? currentYear - establishedYear : 0;
  const annualRevenue = Number(input.annualRevenue || 0);
  const priorRevenues = input.priorYearRevenues || [];
  const everExceededThreshold = priorRevenues.some(r => r >= UMKM_REVENUE_THRESHOLD)
    || annualRevenue >= UMKM_REVENUE_THRESHOLD;
  const maxYears = getMaxUmkmYears(input.legalForm);

  // Reason/warning copy is in English; TaxAdvisoryPanel renders it as-is.
  // The threshold readable in billions of IDR (Rp 4.8B).
  const thresholdBillions = (UMKM_REVENUE_THRESHOLD / 1_000_000_000).toFixed(1);

  // Missing data → cannot determine
  if (!establishedYear || !input.legalForm) {
    return {
      regime: 'NOT_DETERMINED',
      title: 'Company information incomplete',
      reason: 'Established year and legal form are required to determine the annual closing regime.',
      legalBasis: '',
      yearsOperating: 0,
      warnings: ['Please fill in establishment year and legal form under Company Profile first.'],
      route: null,
    };
  }

  // Rule 1: PPh 25 elected at NPWP creation → PPh 25 from day 1
  if (input.npwpPph25Elected) {
    return {
      regime: 'PPH25',
      title: 'PPh 25 — standard corporate income tax',
      reason: 'You elected PPh 25 when the NPWP was issued. PPh 25 applies regardless of being within the UMKM 3-year window.',
      legalBasis: 'PP 55/2022 Pasal 59 — PPh 25 election at NPWP registration',
      yearsOperating,
      route: '/tax/annual/pph25',
    };
  }

  // Rule 5: PP 20/2026 — 적격 유형이 아니면 PPh 25.
  // PT/CV/FIRMA 는 원칙 배제, 2026 이전 시작한 기존 수혜자만 경과 인정.
  if (!isUmkmFinalEligible(input.legalForm, input.umkmStartYear)) {
    const lf = input.legalForm.toUpperCase();
    const excludedByPp20 = UMKM_GRANDFATHER_ONLY.has(lf);
    return {
      regime: 'PPH25',
      title: 'PPh 25 — standard corporate income tax',
      reason: excludedByPp20
        ? `${input.legalForm} is no longer eligible for UMKM PPh Final 0.5% under PP 20/2026 (effective 2026-04-22) — must use the standard corporate tax (PPh 25/PPh Badan).`
        : `${input.legalForm} is not eligible for UMKM PPh Final.`,
      legalBasis: excludedByPp20
        ? 'PP 20/2026 (mengubah PP 55/2022) — PT/CV/Firma dikecualikan dari PPh Final 0,5%'
        : 'PP 55/2022 jo. PP 20/2026 — legal form not eligible',
      yearsOperating,
      warnings: excludedByPp20
        ? ['PP 20/2026: PT·CV·Firma는 0.5% Final 대상에서 제외되어 일반 법인세(PPh 25)로 전환됩니다. (기존 수혜자는 기존 시한까지 경과 인정)']
        : undefined,
      route: '/tax/annual/pph25',
    };
  }

  // Rule 4: Beyond UMKM max years → PPh 25. (개인/1인개인회사는 maxYears=∞ → 영구, 미해당)
  if (Number.isFinite(maxYears) && yearsOperating >= maxYears) {
    return {
      regime: 'PPH25',
      title: 'PPh 25 — standard corporate income tax',
      reason: `Year ${yearsOperating} of operation — exceeds the UMKM eligibility window for ${input.legalForm} (${maxYears} years). PPh 25 applies from next year.`,
      legalBasis: `PP 55/2022 — UMKM eligibility period (${input.legalForm}: ${maxYears} years)`,
      yearsOperating,
      warnings: ['UMKM PPh Final period has expired — switched to the standard corporate income tax regime.'],
      route: '/tax/annual/pph25',
    };
  }

  // Rule 3: Within 3 years but revenue exceeded threshold → PPh 25 from next year
  if (everExceededThreshold) {
    return {
      regime: 'PPH25',
      title: 'PPh 25 — standard corporate income tax',
      reason: `Year ${yearsOperating} of operation, but annual revenue exceeded the Rp ${thresholdBillions}B threshold — not eligible for UMKM PPh Final.`,
      legalBasis: 'UU HPP 7/2021 — UMKM revenue threshold exceeded',
      yearsOperating,
      warnings: [`Annual revenue exceeded Rp ${thresholdBillions}B → switch to PPh 25.`],
      route: '/tax/annual/pph25',
    };
  }

  // Rule 2: Within UMKM period + no threshold exceed → PPh Final
  // 개인/1인개인회사는 maxYears=∞ → 영구(잔여연수 무의미).
  const permanent = !Number.isFinite(maxYears);
  const umkmYearsRemaining = permanent ? undefined : maxYears - yearsOperating;
  return {
    regime: 'PPH_FINAL',
    title: 'PPh Final UMKM 0.5%',
    reason: permanent
      ? `${input.legalForm} — UMKM PPh Final 0.5% applies permanently while revenue stays under Rp 4.8B (PP 20/2026: no time limit for individuals/sole proprietorships).`
      : `Year ${yearsOperating} of operation (${input.legalForm}). UMKM applies (revenue under Rp 4.8B), so only 0.5% of monthly revenue is prepaid. ${umkmYearsRemaining} year(s) remaining.`,
    legalBasis: 'PP 55/2022 jo. PP 20/2026 — UMKM PPh Final 0,5%',
    yearsOperating,
    umkmYearsRemaining,
    warnings: umkmYearsRemaining != null && umkmYearsRemaining <= 1
      ? [`This is the final year of UMKM eligibility — PPh 25 takes over automatically from next year.`]
      : undefined,
    route: '/tax/annual/pph-final',
  };
}
