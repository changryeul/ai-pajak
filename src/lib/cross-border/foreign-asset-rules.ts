/**
 * Home-country foreign-asset reporting thresholds.
 *
 * Used on the dashboard to warn a customer that their Indonesian tax return
 * is not the full picture: if their home country has its own rule for
 * offshore accounts/assets, they may need to file there too. We do NOT
 * file those returns here — we surface the likelihood and link out.
 *
 * Thresholds are approximate and updated by hand. Always display the rule
 * source + last-updated date and a "consult a local advisor" disclaimer
 * so users don't treat the warning as legal advice.
 */

export type CountryCode = 'ID' | 'KR' | 'US' | 'JP';

export interface ForeignAssetRule {
  country: CountryCode;
  /** Human-readable rule name, used as an i18n key root. */
  labelKey: string;
  /** Threshold amount, in `thresholdCurrency` units. */
  threshold: number;
  thresholdCurrency: 'KRW' | 'USD' | 'JPY';
  /** Approximate IDR per 1 unit of thresholdCurrency, for comparing snapshots. */
  idrPerUnit: number;
  /** Effective threshold in IDR (threshold * idrPerUnit). */
  thresholdIdr: number;
  /** ISO date of the last manual rate/threshold refresh. */
  ratesAsOf: string;
  /** External reference URL for the user to verify. */
  referenceUrl: string;
}

/**
 * Rule table. These figures are ballpark — always renderable with an
 * "approximate, as of {ratesAsOf}" caveat. Exact filing decisions are the
 * user's responsibility.
 *
 *   KR: 해외금융계좌 신고의무 — resident holding aggregate > 5억 KRW
 *       at any time in the year. (국세청 가이드 기준)
 *   US: FBAR (FinCEN 114) — US person with > USD 10,000 aggregate in
 *       foreign financial accounts at any time.
 *   JP: 国外財産調書 — Japan resident individual with > JPY 50M
 *       foreign property value on Dec 31.
 *   ID: no additional foreign-asset reporting beyond SPT Tahunan Harta.
 */
const RULES: Record<Exclude<CountryCode, 'ID'>, ForeignAssetRule> = {
  KR: {
    country: 'KR',
    labelKey: 'crossBorder.KR',
    threshold: 500_000_000,
    thresholdCurrency: 'KRW',
    idrPerUnit: 11.5,
    thresholdIdr: 500_000_000 * 11.5,
    ratesAsOf: '2026-04-18',
    referenceUrl: 'https://www.nts.go.kr/',
  },
  US: {
    country: 'US',
    labelKey: 'crossBorder.US',
    threshold: 10_000,
    thresholdCurrency: 'USD',
    idrPerUnit: 16_000,
    thresholdIdr: 10_000 * 16_000,
    ratesAsOf: '2026-04-18',
    referenceUrl: 'https://www.fincen.gov/report-foreign-bank-and-financial-accounts',
  },
  JP: {
    country: 'JP',
    labelKey: 'crossBorder.JP',
    threshold: 50_000_000,
    thresholdCurrency: 'JPY',
    idrPerUnit: 108,
    thresholdIdr: 50_000_000 * 108,
    ratesAsOf: '2026-04-18',
    referenceUrl: 'https://www.nta.go.jp/',
  },
};

/**
 * Look up the applicable rule for a given nationality. Returns null when
 * the country has no foreign-asset reporting obligation beyond the local
 * tax return (ID), or when nationality is unset.
 */
export function getForeignAssetRule(nationality: CountryCode | null | undefined): ForeignAssetRule | null {
  if (!nationality || nationality === 'ID') return null;
  return RULES[nationality] ?? null;
}

export interface ThresholdCheckResult {
  requiresReporting: boolean;
  /** Current foreign-asset total in IDR at latest year. */
  totalForeignIdr: number;
  /** The rule evaluated (null when nationality has no rule). */
  rule: ForeignAssetRule | null;
  /** Ratio of total to threshold. >= 1 means threshold met/exceeded. */
  ratio: number | null;
}

/**
 * Decide whether the customer should be warned to file in their home
 * country. `totalForeignIdr` comes from summing asset_snapshot rows with
 * is_foreign=true for the latest year (sumForeignByYear in trend.ts).
 *
 * Rule: threshold met or exceeded → requiresReporting=true.
 */
export function checkForeignAssetThreshold(
  nationality: CountryCode | null | undefined,
  totalForeignIdr: number,
): ThresholdCheckResult {
  const rule = getForeignAssetRule(nationality);
  if (!rule) {
    return { requiresReporting: false, totalForeignIdr, rule: null, ratio: null };
  }
  const ratio = rule.thresholdIdr > 0 ? totalForeignIdr / rule.thresholdIdr : null;
  const requiresReporting = totalForeignIdr >= rule.thresholdIdr;
  return { requiresReporting, totalForeignIdr, rule, ratio };
}
