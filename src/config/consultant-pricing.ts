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

/**
 * Tier copy (name, description, features) is localised via the `pricingPlans`
 * i18n namespace — keyed by the tier `id`.
 */
export interface ConsultantTier {
  id: ConsultantTierId;
  priceIdr: number;
  billingCycle: 'MONTHLY';
  /** Maximum number of active managed clients. Use 0 or Infinity for unlimited. */
  maxClients: number;
  /** Number of feature bullets defined in i18n for this tier */
  featureCount: number;
}

export const STARTER_TIER: ConsultantTier = {
  id: 'STARTER',
  priceIdr: 1_000_000,
  billingCycle: 'MONTHLY',
  maxClients: 10,
  featureCount: 5,
};

export const GROWTH_TIER: ConsultantTier = {
  id: 'GROWTH',
  priceIdr: 3_000_000,
  billingCycle: 'MONTHLY',
  maxClients: 50,
  featureCount: 6,
};

export const ENTERPRISE_TIER: ConsultantTier = {
  id: 'ENTERPRISE',
  priceIdr: 8_000_000,
  billingCycle: 'MONTHLY',
  maxClients: 999_999, // effectively unlimited; 50+ gets custom quote by master
  featureCount: 6,
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
        // Reason is machine-readable; UI renders localised copy via i18n.
        reason: `tier=${tier.id};clients=${safe};limit=${
          tier.maxClients >= 999_999 ? 'unlimited' : tier.maxClients
        }`,
      };
    }
  }
  return {
    tier: null,
    reason: `exceeds_all_tiers;clients=${safe}`,
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
