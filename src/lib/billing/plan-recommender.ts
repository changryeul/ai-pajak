/**
 * Plan recommender — pure functions for determining which corporate plan
 * fits a customer based on their measured monthly usage.
 *
 * DB access is kept separate (see usage-query.ts) so these helpers are
 * 100% unit-testable without mocking Supabase.
 */

import {
  CORPORATE_PLANS,
  type CorporatePlan,
  type CorporatePlanId,
} from '@/config/corporate-pricing';

/**
 * Monthly usage snapshot for a single corporate customer.
 * All counts are expected to be the 3-month rolling average (or max) to avoid
 * bouncing plans due to one-off spikes.
 */
export interface CustomerUsage {
  employees: number;
  /** Combined count of PPh 22/23/4(2) withholding transactions in the observation month */
  withholdingPerMonth: number;
  /** Count of PPN invoice transactions in the observation month */
  ppnPerMonth: number;
}

/**
 * Return value of plan recommendation — includes the recommended plan
 * plus diagnostic info (which usage dimension was the deciding factor).
 */
export interface PlanRecommendation {
  /** Recommended plan, or null if usage exceeds all plans (→ custom quote needed) */
  plan: CorporatePlan | null;
  /** If plan is null, this indicates custom pricing required */
  exceedsAllPlans: boolean;
  /**
   * Which dimensions exceed the highest plan. Empty array if within limits.
   * e.g. ['employees'] — only employee count is too high
   */
  exceedingDimensions: Array<'employees' | 'withholdingPerMonth' | 'ppnPerMonth'>;
  /** Plain-Korean explanation for display */
  reason: string;
}

/**
 * Check whether a given usage fits within a plan's hard limits.
 * ALL dimensions must be ≤ the plan's limits. Returns true if the plan covers this usage.
 */
export function doesPlanFit(plan: CorporatePlan, usage: CustomerUsage): boolean {
  if (usage.employees > plan.limits.employees) return false;
  if (usage.withholdingPerMonth > plan.limits.withholdingPerMonth) return false;
  // PPN limit of 0 means "not applicable" — only fits if the customer has 0 PPN activity
  if (plan.limits.ppnPerMonth === 0) {
    if (usage.ppnPerMonth > 0) return false;
  } else {
    if (usage.ppnPerMonth > plan.limits.ppnPerMonth) return false;
  }
  return true;
}

/**
 * Pick the cheapest plan that covers a customer's usage.
 *
 * Logic:
 *   1. Iterate plans in price ascending order (UMKM → Basic → Pro)
 *   2. Return the first plan where ALL usage dimensions fit
 *   3. If no plan fits, return null (exceedsAllPlans=true) — custom quote needed
 *
 * This matches the business rule: "Pro 플랜 초과 시에는 상담 후 가격 책정".
 */
export function suggestPlanForCustomer(usage: CustomerUsage): PlanRecommendation {
  // Safety: clamp negative usage to 0
  const safe: CustomerUsage = {
    employees: Math.max(0, Math.floor(usage.employees || 0)),
    withholdingPerMonth: Math.max(0, Math.floor(usage.withholdingPerMonth || 0)),
    ppnPerMonth: Math.max(0, Math.floor(usage.ppnPerMonth || 0)),
  };

  for (const plan of CORPORATE_PLANS) {
    if (doesPlanFit(plan, safe)) {
      return {
        plan,
        exceedsAllPlans: false,
        exceedingDimensions: [],
        reason: buildFitReason(plan, safe),
      };
    }
  }

  // No plan fits — identify which dimensions exceed the highest plan
  const topPlan = CORPORATE_PLANS[CORPORATE_PLANS.length - 1];
  const exceeding: PlanRecommendation['exceedingDimensions'] = [];
  if (safe.employees > topPlan.limits.employees) exceeding.push('employees');
  if (safe.withholdingPerMonth > topPlan.limits.withholdingPerMonth) exceeding.push('withholdingPerMonth');
  if (safe.ppnPerMonth > topPlan.limits.ppnPerMonth) exceeding.push('ppnPerMonth');

  return {
    plan: null,
    exceedsAllPlans: true,
    exceedingDimensions: exceeding,
    reason: buildExceedReason(topPlan, safe, exceeding),
  };
}

function buildFitReason(plan: CorporatePlan, usage: CustomerUsage): string {
  const parts = [
    `직원 ${usage.employees}명 (한도 ${plan.limits.employees})`,
    `원천세 월 ${usage.withholdingPerMonth}건 (한도 ${plan.limits.withholdingPerMonth})`,
  ];
  if (plan.limits.ppnPerMonth > 0) {
    parts.push(`PPN 월 ${usage.ppnPerMonth}건 (한도 ${plan.limits.ppnPerMonth})`);
  }
  return `${plan.name} 플랜 추천: ${parts.join(', ')}`;
}

function buildExceedReason(
  topPlan: CorporatePlan,
  usage: CustomerUsage,
  exceeding: PlanRecommendation['exceedingDimensions']
): string {
  const labels: Record<typeof exceeding[number], string> = {
    employees: `직원 ${usage.employees}명 > ${topPlan.limits.employees}명 한도`,
    withholdingPerMonth: `원천세 월 ${usage.withholdingPerMonth}건 > ${topPlan.limits.withholdingPerMonth}건 한도`,
    ppnPerMonth: `PPN 월 ${usage.ppnPerMonth}건 > ${topPlan.limits.ppnPerMonth}건 한도`,
  };
  const parts = exceeding.map((k) => labels[k]);
  return `Pro 플랜 한도 초과 — 상담 후 맞춤 견적 필요: ${parts.join(', ')}`;
}

/**
 * Check whether a customer on a given plan is currently OVER their limits.
 * Used to warn customers and suggest an upgrade.
 */
export function isOverLimit(planId: CorporatePlanId, usage: CustomerUsage): boolean {
  const plan = CORPORATE_PLANS.find((p) => p.id === planId);
  if (!plan) return false;
  return !doesPlanFit(plan, usage);
}
