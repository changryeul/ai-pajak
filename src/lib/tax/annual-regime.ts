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

  // Rule 5: Non-UMKM eligible legal form → PPh 25
  if (!UMKM_ELIGIBLE_LEGAL_FORMS.has(input.legalForm.toUpperCase())) {
    return {
      regime: 'PPH25',
      title: 'PPh 25 — standard corporate income tax',
      reason: `${input.legalForm} is not eligible for UMKM PPh Final.`,
      legalBasis: 'PP 55/2022 — legal form not eligible for UMKM Final',
      yearsOperating,
      route: '/tax/annual/pph25',
    };
  }

  // Rule 4: Beyond UMKM max years → PPh 25
  if (yearsOperating >= maxYears) {
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
  const umkmYearsRemaining = maxYears - yearsOperating;
  return {
    regime: 'PPH_FINAL',
    title: 'PPh Final UMKM 0.5%',
    reason: `Year ${yearsOperating} of operation (${input.legalForm}). UMKM applies (revenue under Rp 4.8B), so only 0.5% of monthly revenue is prepaid. ${umkmYearsRemaining} year(s) remaining.`,
    legalBasis: 'PP 55/2022 — UMKM PPh Final 0.5%',
    yearsOperating,
    umkmYearsRemaining,
    warnings: umkmYearsRemaining <= 1
      ? [`This is the final year of UMKM eligibility — PPh 25 takes over automatically from next year.`]
      : undefined,
    route: '/tax/annual/pph-final',
  };
}
