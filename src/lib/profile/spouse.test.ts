import { describe, it, expect } from 'vitest';
import { buildPTKPStatus, getPTKPAmount } from '@/lib/tax/shared/tax-utils';
import { PTKP_RATES } from '@/lib/tax/shared/constants';
import type { PTKPStatus } from '@/lib/tax/shared/types';
import { deriveFromPtkp } from './spouse';

/**
 * The SpouseAndDependentsCard derives UI state from a stored PTKP code and
 * writes back the PTKP code calculated from UI state. These tests lock the
 * round-trip so the card and the tax calculator never drift.
 */

describe('deriveFromPtkp (UI state ← stored code)', () => {
  it('null → single / separate / 0', () => {
    expect(deriveFromPtkp(null)).toEqual({
      marital: 'single', filing: 'separate', dependents: 0,
    });
  });

  it.each([
    ['TK/0', 0], ['TK/1', 1], ['TK/2', 2], ['TK/3', 3],
  ] as const)('TK/%s → single, %i deps', (code, deps) => {
    expect(deriveFromPtkp(code as PTKPStatus)).toEqual({
      marital: 'single', filing: 'separate', dependents: deps,
    });
  });

  it.each([
    ['K/0', 0], ['K/1', 1], ['K/2', 2], ['K/3', 3],
  ] as const)('%s → married separate, %i deps', (code, deps) => {
    expect(deriveFromPtkp(code as PTKPStatus)).toEqual({
      marital: 'married', filing: 'separate', dependents: deps,
    });
  });

  it.each([
    ['K/I/0', 0], ['K/I/1', 1], ['K/I/2', 2], ['K/I/3', 3],
  ] as const)('%s → married joint, %i deps', (code, deps) => {
    expect(deriveFromPtkp(code as PTKPStatus)).toEqual({
      marital: 'married', filing: 'joint', dependents: deps,
    });
  });
});

describe('buildPTKPStatus (stored code ← UI state) round-trip', () => {
  const cases = [
    'TK/0', 'TK/1', 'TK/2', 'TK/3',
    'K/0', 'K/1', 'K/2', 'K/3',
    'K/I/0', 'K/I/1', 'K/I/2', 'K/I/3',
  ] as const;

  it.each(cases)('derive(%s) → rebuild → %s', (code) => {
    const derived = deriveFromPtkp(code);
    const rebuilt = buildPTKPStatus({
      isMarried: derived.marital === 'married',
      spouseIncomeJoint: derived.filing === 'joint',
      dependents: derived.dependents,
    });
    expect(rebuilt).toBe(code);
  });
});

describe('PTKP amounts match UU PPh Pasal 7 table', () => {
  // Spot-check the three key brackets the card surfaces.
  it('TK/0 = 54M IDR', () => {
    expect(getPTKPAmount('TK/0')).toBe(54_000_000);
    expect(PTKP_RATES['TK/0']).toBe(54_000_000);
  });
  it('K/I/2 = 121.5M IDR (married joint + 2 dependents)', () => {
    expect(getPTKPAmount('K/I/2')).toBe(121_500_000);
  });
  it('K/3 = 72M IDR (married separate + 3 dependents, max)', () => {
    expect(getPTKPAmount('K/3')).toBe(72_000_000);
  });
});
