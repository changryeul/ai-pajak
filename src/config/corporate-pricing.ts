/**
 * Corporate pricing plans — AI Pajak (2026-04-11)
 *
 * Three monthly subscription plans for corporate (法人) customers.
 * Individual (개인) customers pay per SPT filing, not through this config.
 * External tax consultant (세무 컨설턴트) firms use their own pricing (Phase K-2).
 *
 * Each plan has hard limits on usage dimensions that determine eligibility.
 * When a customer exceeds all plan limits, they must contact sales for a
 * custom quote (handled by TAX_OPERATOR_MASTER role via custom-pricing UI).
 *
 * Pricing is in Indonesian Rupiah (IDR). All plans are monthly subscriptions,
 * billed in advance, auto-renewed. VAT (PPN 11%) is added separately at checkout.
 */

export const CORPORATE_PLAN_IDS = ['UMKM', 'BASIC', 'PRO'] as const;
export type CorporatePlanId = typeof CORPORATE_PLAN_IDS[number];

/**
 * Plan copy (name, description, features) is localised via the `pricingPlans`
 * i18n namespace — keyed by the plan `id`. Consumers that render plan text
 * should call `t('pricingPlans.' + plan.id + '.name')` etc. so all 5 locales
 * stay in sync.
 */
export interface CorporatePlan {
  id: CorporatePlanId;
  priceIdr: number;
  billingCycle: 'MONTHLY';
  /** Hard usage limits. A customer fits this plan only if ALL usage dimensions are ≤ these limits. */
  limits: {
    /** Max active employees (for PPh 21 payroll automation) */
    employees: number;
    /** Max withholding-tax (PPh 23/22/4(2)) transactions per month */
    withholdingPerMonth: number;
    /** Max PPN (VAT) invoice transactions per month. 0 = not applicable */
    ppnPerMonth: number;
  };
  /** Number of feature bullets (f1..fN) defined in i18n for this plan */
  featureCount: number;
}

export const UMKM_PLAN: CorporatePlan = {
  id: 'UMKM',
  priceIdr: 500_000,
  billingCycle: 'MONTHLY',
  limits: {
    employees: 10,
    withholdingPerMonth: 30,
    ppnPerMonth: 0, // UMKM is typically exempt from PKP → no PPN
  },
  featureCount: 4,
};

export const BASIC_PLAN: CorporatePlan = {
  id: 'BASIC',
  priceIdr: 1_500_000,
  billingCycle: 'MONTHLY',
  limits: {
    employees: 50,
    withholdingPerMonth: 100,
    ppnPerMonth: 200,
  },
  featureCount: 6,
};

export const PRO_PLAN: CorporatePlan = {
  id: 'PRO',
  priceIdr: 3_000_000,
  billingCycle: 'MONTHLY',
  limits: {
    employees: 1_000,
    withholdingPerMonth: 200,
    ppnPerMonth: 500,
  },
  featureCount: 8,
};

/** All corporate plans in ascending order of price */
export const CORPORATE_PLANS: readonly CorporatePlan[] = [UMKM_PLAN, BASIC_PLAN, PRO_PLAN] as const;

/** Lookup plan by ID */
export function getCorporatePlan(id: CorporatePlanId): CorporatePlan {
  const plan = CORPORATE_PLANS.find((p) => p.id === id);
  if (!plan) throw new Error(`Unknown corporate plan id: ${id}`);
  return plan;
}

/**
 * Format price for display in Indonesian Rupiah (full digits, no abbreviation).
 */
export function formatPlanPrice(plan: CorporatePlan): string {
  return `Rp ${plan.priceIdr.toLocaleString('id-ID')}`;
}

/**
 * Estimate VAT-inclusive price (PPN 11%) for a given plan.
 */
export function priceWithVat(plan: CorporatePlan): number {
  return Math.round(plan.priceIdr * 1.11);
}
