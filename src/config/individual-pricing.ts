/**
 * Individual SPT pricing — Phase D
 *
 * Per-SPT (한 건씩) pricing for individual taxpayers (INDIVIDUAL customers).
 * Unlike corporate plans (월 구독) and consultant tiers (월 구독), individuals
 * pay only when they actually file an SPT for a given tax year.
 *
 * Used by:
 * - /pricing public page (Individual tab)
 * - /api/billing/individual-spt POST endpoint
 */

export const VAT_RATE = 0.11; // PPN 11%

export type IndividualSptId = 'SPT_1770SS' | 'SPT_1770S' | 'SPT_1770';

/**
 * Plan copy (name, description, features) is localised via the `pricingPlans`
 * i18n namespace — keyed by the plan `id`.
 */
export interface IndividualSptPlan {
  id: IndividualSptId;
  shortName: string;
  priceIdr: number;
  featureCount: number;
}

export const SPT_1770SS_PLAN: IndividualSptPlan = {
  id: 'SPT_1770SS',
  shortName: '1770SS',
  priceIdr: 100_000,
  featureCount: 4,
};

export const SPT_1770S_PLAN: IndividualSptPlan = {
  id: 'SPT_1770S',
  shortName: '1770S',
  priceIdr: 200_000,
  featureCount: 4,
};

export const SPT_1770_PLAN: IndividualSptPlan = {
  id: 'SPT_1770',
  shortName: '1770',
  priceIdr: 500_000,
  featureCount: 4,
};

export const INDIVIDUAL_SPT_PLANS: readonly IndividualSptPlan[] = [
  SPT_1770SS_PLAN,
  SPT_1770S_PLAN,
  SPT_1770_PLAN,
] as const;

export function getIndividualSptPlan(id: string): IndividualSptPlan {
  const plan = INDIVIDUAL_SPT_PLANS.find((p) => p.id === id);
  if (!plan) {
    throw new Error(`Unknown individual SPT plan: ${id}`);
  }
  return plan;
}

export function formatSptPrice(plan: IndividualSptPlan): string {
  return `Rp ${plan.priceIdr.toLocaleString('id-ID')}`;
}

export function sptPriceWithVat(plan: IndividualSptPlan): number {
  return Math.round(plan.priceIdr * (1 + VAT_RATE));
}

export function suggestSptPlan(opts: {
  hasBusinessIncome?: boolean;
  hasMultipleIncomes?: boolean;
  annualIncomeIdr?: number;
}): IndividualSptPlan {
  if (opts.hasBusinessIncome) return SPT_1770_PLAN;
  if (opts.hasMultipleIncomes) return SPT_1770S_PLAN;
  if (opts.annualIncomeIdr !== undefined && opts.annualIncomeIdr > 60_000_000) {
    return SPT_1770S_PLAN;
  }
  return SPT_1770SS_PLAN;
}
