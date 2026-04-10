import { describe, it, expect } from 'vitest';
import {
  SERVICE_TYPE_TO_CATEGORY,
  taxTypeToRegime,
  isDgtFormValid,
} from '../withholding-helpers';

describe('SERVICE_TYPE_TO_CATEGORY', () => {
  it('should map all 9 Indonesian service types to engine categories', () => {
    expect(SERVICE_TYPE_TO_CATEGORY.DIVIDEN).toBe('DIVIDEND');
    expect(SERVICE_TYPE_TO_CATEGORY.BUNGA).toBe('INTEREST');
    expect(SERVICE_TYPE_TO_CATEGORY.ROYALTI).toBe('ROYALTY');
    expect(SERVICE_TYPE_TO_CATEGORY.HADIAH).toBe('OTHER');
    expect(SERVICE_TYPE_TO_CATEGORY.SEWA).toBe('RENTAL');
    expect(SERVICE_TYPE_TO_CATEGORY.JASA_TEKNIK).toBe('SERVICE');
    expect(SERVICE_TYPE_TO_CATEGORY.JASA_MANAJEMEN).toBe('SERVICE');
    expect(SERVICE_TYPE_TO_CATEGORY.JASA_KONSULTAN).toBe('SERVICE');
    expect(SERVICE_TYPE_TO_CATEGORY.JASA_LAINNYA).toBe('SERVICE');
  });

  it('should return undefined for unknown service types', () => {
    expect(SERVICE_TYPE_TO_CATEGORY.UNKNOWN_TYPE).toBeUndefined();
  });
});

describe('taxTypeToRegime', () => {
  it('should return EXEMPT for any zero-rate result', () => {
    expect(taxTypeToRegime('PPh23', 0)).toBe('EXEMPT');
    expect(taxTypeToRegime('PPh4_2', 0)).toBe('EXEMPT');
    expect(taxTypeToRegime('PPh26', 0)).toBe('EXEMPT');
  });

  it('should map PPh23 → PPH23', () => {
    expect(taxTypeToRegime('PPh23', 0.02)).toBe('PPH23');
    expect(taxTypeToRegime('PPh23', 0.15)).toBe('PPH23');
  });

  it('should map PPh4_2 → PPH4_2', () => {
    expect(taxTypeToRegime('PPh4_2', 0.10)).toBe('PPH4_2');
    expect(taxTypeToRegime('PPh4_2', 0.20)).toBe('PPH4_2');
  });

  it('should map PPh26 → PPH26', () => {
    expect(taxTypeToRegime('PPh26', 0.20)).toBe('PPH26');
    expect(taxTypeToRegime('PPh26', 0.10)).toBe('PPH26');
  });

  it('should map PPh21 → PPH23 (legacy fallback)', () => {
    expect(taxTypeToRegime('PPh21', 0.05)).toBe('PPH23');
  });

  it('should map PPh22 → PPH23', () => {
    expect(taxTypeToRegime('PPh22', 0.025)).toBe('PPH23');
  });

  it('should map PPh15 → PPH_FINAL', () => {
    expect(taxTypeToRegime('PPh15', 0.012)).toBe('PPH_FINAL');
  });

  it('should default to PPH23 for unknown taxType', () => {
    expect(taxTypeToRegime('UNKNOWN', 0.05)).toBe('PPH23');
  });

  it('should treat zero rate as EXEMPT regardless of taxType', () => {
    // This handles UU HPP corporate dividend exemption case
    expect(taxTypeToRegime('PPh23', 0)).toBe('EXEMPT');
  });
});

describe('isDgtFormValid', () => {
  const txDate = '2026-04-15';

  it('should return false when no DGT Form date provided', () => {
    expect(isDgtFormValid(null, txDate)).toBe(false);
    expect(isDgtFormValid(undefined, txDate)).toBe(false);
    expect(isDgtFormValid('', txDate)).toBe(false);
  });

  it('should return true when DGT Form is valid past transaction date', () => {
    expect(isDgtFormValid('2026-12-31', txDate)).toBe(true);
    expect(isDgtFormValid('2027-01-01', txDate)).toBe(true);
  });

  it('should return true when DGT Form expires exactly on transaction date', () => {
    expect(isDgtFormValid('2026-04-15', txDate)).toBe(true);
  });

  it('should return false when DGT Form expired before transaction date', () => {
    expect(isDgtFormValid('2026-04-14', txDate)).toBe(false);
    expect(isDgtFormValid('2025-12-31', txDate)).toBe(false);
  });

  it('should handle ISO timestamp format', () => {
    expect(isDgtFormValid('2026-12-31T00:00:00.000Z', txDate)).toBe(true);
  });
});
