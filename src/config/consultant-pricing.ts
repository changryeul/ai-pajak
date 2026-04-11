/**
 * External tax consultant (세무 사무소) pricing plans — Phase B-3
 *
 * Tier-based monthly subscription for external tax consulting firms that
 * use AI Pajak to manage their own clients. Similar to Xero/QuickBooks
 * "Accountants" plans.
 *
 * The consulting firm pays AI Pajak a monthly tool fee based on the
 * number of customers they manage. The firm's clients do NOT pay AI Pajak
 * directly — the firm bills them separately.
 *
 * This is distinct from CORPORATE_PLANS (法人 고객 직접 구독) in that:
 * - Subscriber is a tax_partner row (not a customer row)
 * - Limit dimension is "managed clients" (customer_consultant count)
 * - No per-transaction limits (unlike corporate plans)
 */

export const CONSULTANT_TIER_IDS = ['STARTER', 'GROWTH', 'ENTERPRISE'] as const;
export type ConsultantTierId = typeof CONSULTANT_TIER_IDS[number];

export interface ConsultantTier {
  id: ConsultantTierId;
  name: string;
  priceIdr: number;
  billingCycle: 'MONTHLY';
  /** Maximum number of active managed clients. Use 0 or Infinity for unlimited. */
  maxClients: number;
  /** Short Korean description */
  description: string;
  /** Highlighted features */
  features: string[];
}

/**
 * Starter — small tax consulting firms just getting started
 */
export const STARTER_TIER: ConsultantTier = {
  id: 'STARTER',
  name: 'Starter',
  priceIdr: 1_000_000,
  billingCycle: 'MONTHLY',
  maxClients: 10,
  description: '신규 또는 소규모 사무소 (최대 10명 고객)',
  features: [
    '최대 10명 고객 관리',
    '모든 세무 자동화 도구 접근',
    '고객별 대시보드 + 월/연 신고',
    'e-Filing 대행 + e-Bupot',
    '기본 지원',
  ],
};

/**
 * Growth — mid-size firms scaling up
 */
export const GROWTH_TIER: ConsultantTier = {
  id: 'GROWTH',
  name: 'Growth',
  priceIdr: 3_000_000,
  billingCycle: 'MONTHLY',
  maxClients: 50,
  description: '성장 중인 사무소 (최대 50명 고객)',
  features: [
    'Starter 전 기능 포함',
    '최대 50명 고객 관리',
    '팀원·직원 초대 (수퍼바이저 권한 포함)',
    '다수 고객 일괄 처리 (대량 업로드)',
    '고객별 POA·정관·주주 관리',
    '우선 지원',
  ],
};

/**
 * Enterprise — large firms with many clients
 */
export const ENTERPRISE_TIER: ConsultantTier = {
  id: 'ENTERPRISE',
  name: 'Enterprise',
  priceIdr: 8_000_000,
  billingCycle: 'MONTHLY',
  maxClients: 999_999, // effectively unlimited; 50+ gets custom quote by master
  description: '대형 사무소 (50명 이상, 맞춤 견적 가능)',
  features: [
    'Growth 전 기능 포함',
    '관리 고객 수 무제한',
    '전담 계정 매니저',
    '맞춤 통합 (API 연동)',
    '전용 SLA + 우선 장애 대응',
    '세무조사·이전가격 컨설팅 할인',
  ],
};

/** All consultant tiers in ascending order of price */
export const CONSULTANT_TIERS: readonly ConsultantTier[] = [
  STARTER_TIER,
  GROWTH_TIER,
  ENTERPRISE_TIER,
] as const;

/** Lookup tier by ID */
export function getConsultantTier(id: ConsultantTierId): ConsultantTier {
  const tier = CONSULTANT_TIERS.find((t) => t.id === id);
  if (!tier) throw new Error(`Unknown consultant tier id: ${id}`);
  return tier;
}

/**
 * Suggest the cheapest tier that covers a firm's managed client count.
 * Returns the tier, or null if count exceeds even Enterprise limit
 * (which is effectively unlimited, so null should never occur in practice).
 */
export function suggestConsultantTier(clientCount: number): {
  tier: ConsultantTier | null;
  reason: string;
} {
  const safe = Math.max(0, Math.floor(clientCount || 0));
  for (const tier of CONSULTANT_TIERS) {
    if (safe <= tier.maxClients) {
      return {
        tier,
        reason: `${tier.name} 티어 추천: 현재 ${safe}명 고객 (한도 ${
          tier.maxClients >= 999_999 ? '무제한' : `${tier.maxClients}명`
        })`,
      };
    }
  }
  return {
    tier: null,
    reason: `관리 고객 ${safe}명 — 모든 티어 한도 초과, 맞춤 견적 필요`,
  };
}

/** Format consultant tier price for display (full IDR digits) */
export function formatTierPrice(tier: ConsultantTier): string {
  return `Rp ${tier.priceIdr.toLocaleString('id-ID')}`;
}

/** VAT-inclusive price (PPN 11%) */
export function tierPriceWithVat(tier: ConsultantTier): number {
  return Math.round(tier.priceIdr * 1.11);
}
