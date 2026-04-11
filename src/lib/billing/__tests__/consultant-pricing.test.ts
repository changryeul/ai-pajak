import { describe, it, expect } from 'vitest';
import {
  CONSULTANT_TIERS,
  STARTER_TIER,
  GROWTH_TIER,
  ENTERPRISE_TIER,
  getConsultantTier,
  suggestConsultantTier,
  formatTierPrice,
  tierPriceWithVat,
} from '@/config/consultant-pricing';

describe('consultant-pricing constants', () => {
  it('exposes exactly 3 tiers in ascending price order', () => {
    expect(CONSULTANT_TIERS).toHaveLength(3);
    expect(CONSULTANT_TIERS[0].id).toBe('STARTER');
    expect(CONSULTANT_TIERS[1].id).toBe('GROWTH');
    expect(CONSULTANT_TIERS[2].id).toBe('ENTERPRISE');
    expect(CONSULTANT_TIERS[0].priceIdr).toBeLessThan(CONSULTANT_TIERS[1].priceIdr);
    expect(CONSULTANT_TIERS[1].priceIdr).toBeLessThan(CONSULTANT_TIERS[2].priceIdr);
  });

  it('Starter tier matches business spec', () => {
    expect(STARTER_TIER.priceIdr).toBe(1_000_000);
    expect(STARTER_TIER.maxClients).toBe(10);
    expect(STARTER_TIER.billingCycle).toBe('MONTHLY');
  });

  it('Growth tier matches business spec', () => {
    expect(GROWTH_TIER.priceIdr).toBe(3_000_000);
    expect(GROWTH_TIER.maxClients).toBe(50);
  });

  it('Enterprise tier is effectively unlimited', () => {
    expect(ENTERPRISE_TIER.priceIdr).toBe(8_000_000);
    expect(ENTERPRISE_TIER.maxClients).toBeGreaterThanOrEqual(999_999);
  });

  it('formatTierPrice displays full IDR digits', () => {
    expect(formatTierPrice(STARTER_TIER)).toBe('Rp 1.000.000');
    expect(formatTierPrice(GROWTH_TIER)).toBe('Rp 3.000.000');
    expect(formatTierPrice(ENTERPRISE_TIER)).toBe('Rp 8.000.000');
  });

  it('tierPriceWithVat adds 11% PPN', () => {
    expect(tierPriceWithVat(STARTER_TIER)).toBe(1_110_000);
    expect(tierPriceWithVat(GROWTH_TIER)).toBe(3_330_000);
    expect(tierPriceWithVat(ENTERPRISE_TIER)).toBe(8_880_000);
  });

  it('getConsultantTier looks up by id', () => {
    expect(getConsultantTier('STARTER').id).toBe('STARTER');
    expect(getConsultantTier('GROWTH').id).toBe('GROWTH');
    expect(getConsultantTier('ENTERPRISE').id).toBe('ENTERPRISE');
  });

  it('getConsultantTier throws on unknown id', () => {
    expect(() => getConsultantTier('UNKNOWN' as 'STARTER')).toThrow();
  });
});

describe('suggestConsultantTier', () => {
  it('recommends Starter for 0 clients', () => {
    const r = suggestConsultantTier(0);
    expect(r.tier?.id).toBe('STARTER');
  });

  it('recommends Starter at exactly 10 clients (inclusive)', () => {
    expect(suggestConsultantTier(10).tier?.id).toBe('STARTER');
  });

  it('upgrades to Growth at 11 clients', () => {
    expect(suggestConsultantTier(11).tier?.id).toBe('GROWTH');
  });

  it('recommends Growth at exactly 50 clients (inclusive)', () => {
    expect(suggestConsultantTier(50).tier?.id).toBe('GROWTH');
  });

  it('upgrades to Enterprise at 51 clients', () => {
    expect(suggestConsultantTier(51).tier?.id).toBe('ENTERPRISE');
  });

  it('recommends Enterprise for very large firms', () => {
    expect(suggestConsultantTier(500).tier?.id).toBe('ENTERPRISE');
  });

  it('clamps negative values to 0 (→ Starter)', () => {
    expect(suggestConsultantTier(-5).tier?.id).toBe('STARTER');
  });

  it('returns reason string with tier name', () => {
    const r = suggestConsultantTier(8);
    expect(r.reason).toContain('Starter');
    expect(r.reason).toContain('8');
  });

  it('handles NaN/undefined gracefully', () => {
    expect(suggestConsultantTier(NaN).tier?.id).toBe('STARTER');
  });
});
