import { describe, it, expect } from 'vitest';
import { parsePeriod, isAutoQueueTaxType } from '../ensure-queue-item';

describe('parsePeriod', () => {
  it('parses a valid YYYY-MM', () => {
    expect(parsePeriod('2026-06')).toEqual({ month: 6, year: 2026 });
  });
  it('parses December boundary', () => {
    expect(parsePeriod('2099-12')).toEqual({ month: 12, year: 2099 });
  });
  it('rejects malformed input', () => {
    expect(parsePeriod('2026')).toBeNull();
    expect(parsePeriod('2026-13')).toBeNull();
    expect(parsePeriod('2026-00')).toBeNull();
    expect(parsePeriod('')).toBeNull();
    expect(parsePeriod('abcd-ef')).toBeNull();
  });
});

describe('isAutoQueueTaxType', () => {
  it('accepts the 4 supported types', () => {
    for (const t of ['PPh21', 'PPh23', 'PPN', 'PPh_FINAL']) expect(isAutoQueueTaxType(t)).toBe(true);
  });
  it('rejects others', () => {
    expect(isAutoQueueTaxType('PPh26')).toBe(false);
    expect(isAutoQueueTaxType('SPT_TAHUNAN')).toBe(false);
  });
});
