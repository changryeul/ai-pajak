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

export interface IndividualSptPlan {
  id: IndividualSptId;
  name: string;
  shortName: string;
  priceIdr: number;
  description: string;
  features: string[];
  /**
   * Soft eligibility hint shown in the UI. Not enforced server-side; the
   * customer is free to pick a higher tier than they technically need.
   */
  recommendedFor: string;
}

export const SPT_1770SS_PLAN: IndividualSptPlan = {
  id: 'SPT_1770SS',
  name: '1770SS (단순)',
  shortName: '1770SS',
  priceIdr: 100_000,
  description: '직장인 · 단일 소득원',
  features: [
    'A1 (1721-A1) 원천징수영수증 OCR 자동 입력',
    '1770SS 자동 생성 및 검증',
    '세금 환급 여부 자동 판정',
    'JTC 세무사 검토 후 DJP 제출',
  ],
  recommendedFor: '연 소득 6천만 루피아 이하, 단일 고용주',
};

export const SPT_1770S_PLAN: IndividualSptPlan = {
  id: 'SPT_1770S',
  name: '1770S (표준)',
  shortName: '1770S',
  priceIdr: 200_000,
  description: '다중 소득 · 부수입 있는 경우',
  features: [
    '여러 원천징수영수증 병합',
    '기타 소득 · 자산 · 부채 자동 정리',
    'PTKP 프로필 연동',
    'JTC 세무사 검토 후 DJP 제출',
  ],
  recommendedFor: '직장인 + 이자 · 배당 · 임대 같은 부수입자',
};

export const SPT_1770_PLAN: IndividualSptPlan = {
  id: 'SPT_1770',
  name: '1770 (풀)',
  shortName: '1770',
  priceIdr: 300_000,
  description: '사업자 · 프리랜서 · 복잡 소득',
  features: [
    '사업 손익 자동 분류',
    '연간 세무 최적화 추천',
    '증빙 일괄 관리',
    'JTC 세무사 검토 후 DJP 제출',
  ],
  recommendedFor: '사업자 · 프리랜서 · 복수 사업장 · 해외 소득자',
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
