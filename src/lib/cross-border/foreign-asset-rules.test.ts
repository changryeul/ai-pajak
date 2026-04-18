import { describe, it, expect } from 'vitest';
import {
  getForeignAssetRule,
  checkForeignAssetThreshold,
} from './foreign-asset-rules';

describe('getForeignAssetRule', () => {
  it('returns null for ID (no additional rule beyond SPT Tahunan)', () => {
    expect(getForeignAssetRule('ID')).toBeNull();
  });

  it('returns null for null / undefined nationality', () => {
    expect(getForeignAssetRule(null)).toBeNull();
    expect(getForeignAssetRule(undefined)).toBeNull();
  });

  it('returns Korea rule with 500M KRW threshold', () => {
    const r = getForeignAssetRule('KR');
    expect(r).not.toBeNull();
    expect(r!.country).toBe('KR');
    expect(r!.threshold).toBe(500_000_000);
    expect(r!.thresholdCurrency).toBe('KRW');
  });

  it('returns US FBAR rule with 10k USD threshold', () => {
    const r = getForeignAssetRule('US');
    expect(r!.country).toBe('US');
    expect(r!.threshold).toBe(10_000);
    expect(r!.thresholdCurrency).toBe('USD');
  });

  it('returns Japan rule with 50M JPY threshold', () => {
    const r = getForeignAssetRule('JP');
    expect(r!.country).toBe('JP');
    expect(r!.threshold).toBe(50_000_000);
    expect(r!.thresholdCurrency).toBe('JPY');
  });

  it('every rule has thresholdIdr = threshold * idrPerUnit', () => {
    for (const cc of ['KR', 'US', 'JP'] as const) {
      const r = getForeignAssetRule(cc)!;
      expect(r.thresholdIdr).toBeCloseTo(r.threshold * r.idrPerUnit);
    }
  });
});

describe('checkForeignAssetThreshold', () => {
  it('ID nationality → no reporting required regardless of amount', () => {
    const out = checkForeignAssetThreshold('ID', 10_000_000_000);
    expect(out.requiresReporting).toBe(false);
    expect(out.rule).toBeNull();
    expect(out.ratio).toBeNull();
  });

  it('KR + foreign assets below 5억 KRW threshold → no report', () => {
    // 5억 KRW * 11.5 = 5,750,000,000 IDR threshold
    const out = checkForeignAssetThreshold('KR', 3_000_000_000);
    expect(out.requiresReporting).toBe(false);
    expect(out.ratio).toBeLessThan(1);
    expect(out.rule?.country).toBe('KR');
  });

  it('KR + exactly at threshold → requires report (>=)', () => {
    const rule = getForeignAssetRule('KR')!;
    const out = checkForeignAssetThreshold('KR', rule.thresholdIdr);
    expect(out.requiresReporting).toBe(true);
    expect(out.ratio).toBeCloseTo(1);
  });

  it('KR + well above threshold', () => {
    const rule = getForeignAssetRule('KR')!;
    const out = checkForeignAssetThreshold('KR', rule.thresholdIdr * 2);
    expect(out.requiresReporting).toBe(true);
    expect(out.ratio).toBeCloseTo(2);
  });

  it('US FBAR — just under 10k USD threshold (approximate FX) → no report', () => {
    const rule = getForeignAssetRule('US')!;
    const out = checkForeignAssetThreshold('US', rule.thresholdIdr - 1);
    expect(out.requiresReporting).toBe(false);
  });

  it('US FBAR — just over 10k USD threshold → report', () => {
    const rule = getForeignAssetRule('US')!;
    const out = checkForeignAssetThreshold('US', rule.thresholdIdr + 1);
    expect(out.requiresReporting).toBe(true);
  });

  it('null nationality + non-zero foreign assets → no rule, no report', () => {
    const out = checkForeignAssetThreshold(null, 5_000_000_000);
    expect(out.requiresReporting).toBe(false);
    expect(out.rule).toBeNull();
    expect(out.totalForeignIdr).toBe(5_000_000_000);
  });

  it('zero foreign assets → never triggers', () => {
    for (const cc of ['KR', 'US', 'JP'] as const) {
      const out = checkForeignAssetThreshold(cc, 0);
      expect(out.requiresReporting).toBe(false);
      expect(out.ratio).toBe(0);
    }
  });
});
