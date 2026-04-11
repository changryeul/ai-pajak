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

export interface CorporatePlan {
  id: CorporatePlanId;
  name: string;
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
  /** Short Korean description for UI */
  description: string;
  /** Highlighted features for pricing page */
  features: string[];
}

/**
 * UMKM 플랜 — small business, very low volume
 */
export const UMKM_PLAN: CorporatePlan = {
  id: 'UMKM',
  name: 'UMKM (소기업)',
  priceIdr: 500_000,
  billingCycle: 'MONTHLY',
  limits: {
    employees: 10,
    withholdingPerMonth: 30,
    ppnPerMonth: 0, // UMKM is typically exempt from PKP → no PPN
  },
  description: '직원 10명 / 월 거래 30건 이하의 소규모 사업자 전용',
  features: [
    'PPh Final UMKM 0.5% 자동 계산',
    'PPh 21 급여 세무 (최대 10명)',
    '월 30건까지 원천세 자동 처리',
    '연간 SPT Badan 자동 생성',
  ],
};

/**
 * Basic 플랜 — standard corporate with automated tax flow
 */
export const BASIC_PLAN: CorporatePlan = {
  id: 'BASIC',
  name: 'Basic (중소기업)',
  priceIdr: 1_500_000,
  billingCycle: 'MONTHLY',
  limits: {
    employees: 50,
    withholdingPerMonth: 100,
    ppnPerMonth: 200,
  },
  description: '표준적인 법인 세무를 AI로 자동화하고자 하는 중소기업',
  features: [
    'PPh 21 급여 세무 자동화 (최대 50명)',
    '원천세 월 100건 AI 자동 처리 (PPh 22/23/4(2))',
    '부가세 월 200건 인보이스 처리 (PPN)',
    '월/연간 SPT 자동 생성 + 제출',
    '세금 최적화 추천',
    '거래 상대방 관리 + DTA 서류 추적',
  ],
};

/**
 * Pro 플랜 — larger enterprises with advanced governance
 */
export const PRO_PLAN: CorporatePlan = {
  id: 'PRO',
  name: 'Pro (중견/대기업)',
  priceIdr: 3_000_000,
  billingCycle: 'MONTHLY',
  limits: {
    employees: 1_000,
    withholdingPerMonth: 200,
    ppnPerMonth: 500,
  },
  description: '중견/대기업 및 고도화 관리 요구 사항을 위한 플랜',
  features: [
    'Basic 전 기능 포함',
    'PPh 21 급여 세무 (최대 1,000명)',
    '원천세 월 200건',
    '부가세 월 500건',
    '주주 관리 + 배당 PPh 자동 판정',
    '세무조사 대비 기능',
    'Transfer Pricing 기본 지원',
    '우선 지원 (Priority Support)',
  ],
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
