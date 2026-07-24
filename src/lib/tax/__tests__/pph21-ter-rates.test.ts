import { describe, it, expect } from 'vitest';
import {
  normalizePtkpCategory,
  getTERCategory,
  lookupTERRate,
  TER_CATEGORY_A,
  TER_CATEGORY_B,
  TER_CATEGORY_C,
} from '@/config/pph21-ter-rates';

describe('normalizePtkpCategory', () => {
  it('accepts canonical keys unchanged', () => {
    for (const k of ['TK0', 'TK3', 'K0', 'K3', 'KI0', 'KI3'] as const) {
      expect(normalizePtkpCategory(k)).toBe(k);
    }
  });

  it('strips slashes / spaces / hyphens and uppercases', () => {
    expect(normalizePtkpCategory('TK/0')).toBe('TK0');
    expect(normalizePtkpCategory('tk 1')).toBe('TK1');
    expect(normalizePtkpCategory('k-2')).toBe('K2');
    expect(normalizePtkpCategory('K/1')).toBe('K1');
  });

  it('collapses K/I/n married-combined notation to KIn', () => {
    expect(normalizePtkpCategory('K/I/1')).toBe('KI1');
    expect(normalizePtkpCategory('KI 3')).toBe('KI3');
  });

  it('defaults dependant-less prefixes to 0 dependants', () => {
    expect(normalizePtkpCategory('TK')).toBe('TK0');
    expect(normalizePtkpCategory('K')).toBe('K0');
    expect(normalizePtkpCategory('KI')).toBe('KI0');
  });

  it('falls back to TK0 for empty / unknown (never under-taxes)', () => {
    expect(normalizePtkpCategory('')).toBe('TK0');
    expect(normalizePtkpCategory(null)).toBe('TK0');
    expect(normalizePtkpCategory(undefined)).toBe('TK0');
    expect(normalizePtkpCategory('garbage')).toBe('TK0');
    expect(normalizePtkpCategory('K9')).toBe('TK0'); // 9 dependants not a valid PTKP
  });
});

describe('getTERCategory (PMK 168/2023 mapping)', () => {
  it('maps A: TK0, TK1, K0', () => {
    for (const k of ['TK0', 'TK1', 'K0']) expect(getTERCategory(k)).toBe('A');
  });
  it('maps B: TK2, TK3, K1, K2', () => {
    for (const k of ['TK2', 'TK3', 'K1', 'K2']) expect(getTERCategory(k)).toBe('B');
  });
  it('maps C: K3', () => {
    expect(getTERCategory('K3')).toBe('C');
  });
  it('maps KI/n to the same category as K/n dependant count', () => {
    expect(getTERCategory('KI0')).toBe('A');
    expect(getTERCategory('KI1')).toBe('B');
    expect(getTERCategory('KI2')).toBe('B');
    expect(getTERCategory('KI3')).toBe('C');
  });
  it('never returns undefined — normalizes loose/unknown input', () => {
    expect(getTERCategory('K/1')).toBe('B');   // slashed
    expect(getTERCategory('tk 2')).toBe('B');  // spaced lowercase
    expect(getTERCategory('???')).toBe('A');   // unknown → TK0 → A
    expect(getTERCategory(null)).toBe('A');
  });
});

describe('lookupTERRate', () => {
  it('returns 0 below the PTKP-equivalent floor', () => {
    expect(lookupTERRate('A', 5_000_000)).toBe(0);   // < 5.4M
    expect(lookupTERRate('B', 6_000_000)).toBe(0);   // < 6.2M
    expect(lookupTERRate('C', 6_500_000)).toBe(0);   // < 6.6M
  });

  it('matches known PMK 168/2023 bracket rates', () => {
    // Category A: >5.4M–5.65M = 0.25%, >10.7M–11.05M = 3%
    expect(lookupTERRate('A', 5_500_000)).toBe(0.0025);
    expect(lookupTERRate('A', 10_800_000)).toBe(0.03);
    // Category B: >7.3M–9.2M = 1%
    expect(lookupTERRate('B', 8_000_000)).toBe(0.01);
    // Category C: >8.85M–9.8M = 1.25%
    expect(lookupTERRate('C', 9_000_000)).toBe(0.0125);
  });

  it('caps at 34% for the top bracket', () => {
    expect(lookupTERRate('A', 2_000_000_000)).toBe(0.34);
    expect(lookupTERRate('C', 2_000_000_000)).toBe(0.34);
  });

  it('every category table is contiguous (no gaps/overlaps) and ends at Infinity', () => {
    for (const table of [TER_CATEGORY_A, TER_CATEGORY_B, TER_CATEGORY_C]) {
      expect(table[0].min).toBe(0);
      for (let i = 1; i < table.length; i++) {
        expect(table[i].min).toBe(table[i - 1].max); // no gap, no overlap
      }
      expect(table[table.length - 1].max).toBe(Infinity);
    }
  });

  it('rates are monotonically non-decreasing across brackets', () => {
    for (const table of [TER_CATEGORY_A, TER_CATEGORY_B, TER_CATEGORY_C]) {
      for (let i = 1; i < table.length; i++) {
        expect(table[i].rate).toBeGreaterThanOrEqual(table[i - 1].rate);
      }
    }
  });
});
