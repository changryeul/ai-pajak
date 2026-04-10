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

const UMKM_ELIGIBLE_LEGAL_FORMS = new Set(['PT', 'CV', 'UD', 'FIRMA', 'KOPERASI']);

/**
 * Map legal form to maximum UMKM PPh Final years per PP 55/2022.
 * PT: 3 years, CV/Firma: 4 years, individual (UD): 7 years, Koperasi: 4 years.
 */
export function getMaxUmkmYears(legalForm?: string | null): number {
  if (!legalForm) return NEW_COMPANY_EXEMPTION_YEARS;
  switch (legalForm.toUpperCase()) {
    case 'PT': return 3;
    case 'CV':
    case 'FIRMA':
    case 'KOPERASI': return 4;
    case 'UD': return 7;
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

  // Missing data → cannot determine
  if (!establishedYear || !input.legalForm) {
    return {
      regime: 'NOT_DETERMINED',
      title: '회사 정보가 부족합니다',
      reason: '연 결산 방식 판정을 위해 설립 연도와 법인 형태가 필요합니다.',
      legalBasis: '',
      yearsOperating: 0,
      warnings: ['회사정보 메뉴에서 설립 연도와 법인 형태를 먼저 입력하세요'],
      route: null,
    };
  }

  // Rule 1: PPh 25 elected at NPWP creation → PPh 25 from day 1
  if (input.npwpPph25Elected) {
    return {
      regime: 'PPH25',
      title: 'PPh 25 — 일반 법인세',
      reason: 'NPWP 발행 시점에 PPh 25 적용을 선택하셨습니다. 설립 3년 이내라도 UMKM PPh Final 대신 일반 법인세(PPh 25)를 적용합니다.',
      legalBasis: 'PP 55/2022 Pasal 59 — PPh 25 election at NPWP registration',
      yearsOperating,
      route: '/tax/annual/pph25',
    };
  }

  // Rule 5: Non-UMKM eligible legal form → PPh 25
  if (!UMKM_ELIGIBLE_LEGAL_FORMS.has(input.legalForm.toUpperCase())) {
    return {
      regime: 'PPH25',
      title: 'PPh 25 — 일반 법인세',
      reason: `${input.legalForm}은 UMKM PPh Final 적용 대상이 아닙니다.`,
      legalBasis: 'PP 55/2022 — legal form not eligible for UMKM Final',
      yearsOperating,
      route: '/tax/annual/pph25',
    };
  }

  // Rule 4: Beyond UMKM max years → PPh 25
  if (yearsOperating >= maxYears) {
    return {
      regime: 'PPH25',
      title: 'PPh 25 — 일반 법인세',
      reason: `설립 ${yearsOperating}년차로 ${input.legalForm} UMKM 최대 기간(${maxYears}년)을 초과했습니다. 익년부터 PPh 25가 적용됩니다.`,
      legalBasis: `PP 55/2022 — UMKM eligibility period (${input.legalForm}: ${maxYears} years)`,
      yearsOperating,
      warnings: ['UMKM PPh Final 기간이 만료되어 일반 법인세 체계로 전환되었습니다'],
      route: '/tax/annual/pph25',
    };
  }

  // Rule 3: Within 3 years but revenue exceeded threshold → PPh 25 from next year
  if (everExceededThreshold) {
    return {
      regime: 'PPH25',
      title: 'PPh 25 — 일반 법인세',
      reason: `설립 ${yearsOperating}년차이지만 연매출이 ${(UMKM_REVENUE_THRESHOLD / 1_000_000_000).toFixed(1)}억 IDR 임계값을 초과하여 UMKM PPh Final 대상에서 제외됩니다.`,
      legalBasis: 'UU HPP 7/2021 — UMKM revenue threshold exceeded',
      yearsOperating,
      warnings: [`연매출 ${(UMKM_REVENUE_THRESHOLD / 1_000_000_000).toFixed(1)}억 IDR 초과 → PPh 25 전환`],
      route: '/tax/annual/pph25',
    };
  }

  // Rule 2: Within UMKM period + no threshold exceed → PPh Final
  const umkmYearsRemaining = maxYears - yearsOperating;
  return {
    regime: 'PPH_FINAL',
    title: 'PPh Final UMKM 0.5%',
    reason: `설립 ${yearsOperating}년차 (${input.legalForm}). UMKM 대상(연매출 < 48억 IDR)으로 매출의 0.5%만 매월 선납합니다. 잔여 기간 ${umkmYearsRemaining}년.`,
    legalBasis: 'PP 55/2022 — UMKM PPh Final 0.5%',
    yearsOperating,
    umkmYearsRemaining,
    warnings: umkmYearsRemaining <= 1
      ? [`UMKM 적용 마지막 해입니다. 익년부터 PPh 25로 자동 전환됩니다`]
      : undefined,
    route: '/tax/annual/pph-final',
  };
}
