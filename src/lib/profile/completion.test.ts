import { describe, it, expect } from 'vitest';
import {
  calculateCompletion,
  isEmailValid,
  isIdValid,
  isNameValid,
  isPhoneValid,
  isTaxCredentialsValid,
  isComplete,
} from './completion';

describe('completion field validators', () => {
  describe('isNameValid', () => {
    it('rejects empty and whitespace-only', () => {
      expect(isNameValid('')).toBe(false);
      expect(isNameValid(null)).toBe(false);
      expect(isNameValid(undefined)).toBe(false);
      expect(isNameValid('   ')).toBe(false);
    });
    it('accepts any non-empty trimmed string', () => {
      expect(isNameValid('홍길동')).toBe(true);
      expect(isNameValid('A')).toBe(true);
      expect(isNameValid(' Alice ')).toBe(true);
    });
  });

  describe('isIdValid', () => {
    it('accepts NPWP of exactly 15 digits', () => {
      expect(isIdValid('npwp', '123456789012345', '')).toBe(true);
    });
    it('rejects NPWP of wrong length', () => {
      expect(isIdValid('npwp', '12345678901234', '')).toBe(false);
      expect(isIdValid('npwp', '1234567890123456', '')).toBe(false);
    });
    it('rejects NPWP with non-digits', () => {
      expect(isIdValid('npwp', '12345678901234A', '')).toBe(false);
    });
    it('accepts NIK of exactly 16 digits', () => {
      expect(isIdValid('nik', '', '1234567890123456')).toBe(true);
    });
    it('rejects NIK of wrong length', () => {
      expect(isIdValid('nik', '', '123456789012345')).toBe(false);
    });
    it('checks only the field matching idType', () => {
      // idType=npwp, nik is set correctly but npwp missing → still invalid
      expect(isIdValid('npwp', '', '1234567890123456')).toBe(false);
    });
  });

  describe('isEmailValid', () => {
    it('requires an @ character', () => {
      expect(isEmailValid('alice@example.com')).toBe(true);
      expect(isEmailValid('@example.com')).toBe(true);
      expect(isEmailValid('alice@')).toBe(true);
      expect(isEmailValid('alice')).toBe(false);
      expect(isEmailValid('')).toBe(false);
      expect(isEmailValid(null)).toBe(false);
    });
  });

  describe('isPhoneValid', () => {
    it('strips non-digits then requires 8+', () => {
      expect(isPhoneValid('081234567')).toBe(true);
      expect(isPhoneValid('0812-3456-789')).toBe(true);  // 10 digits after strip
      expect(isPhoneValid('+62 812 345 678')).toBe(true); // 11 digits
      expect(isPhoneValid('1234567')).toBe(false);
      expect(isPhoneValid('(123)')).toBe(false);
      expect(isPhoneValid('')).toBe(false);
    });
  });

  describe('isTaxCredentialsValid', () => {
    it('requires at least one of coretaxId / djpPassword / efin', () => {
      expect(isTaxCredentialsValid({
        idType: 'npwp',
      })).toBe(false);
      expect(isTaxCredentialsValid({
        idType: 'npwp',
        coretaxId: 'abc',
      })).toBe(true);
      expect(isTaxCredentialsValid({
        idType: 'npwp',
        djpPassword: 'x',
      })).toBe(true);
      expect(isTaxCredentialsValid({
        idType: 'npwp',
        efin: '123',
      })).toBe(true);
    });
  });
});

describe('calculateCompletion', () => {
  it('returns 0 for fully empty profile', () => {
    const result = calculateCompletion({
      idType: 'npwp',
    });
    expect(result.score).toBe(0);
    expect(result.fields).toEqual({
      name: false, id: false, email: false, phone: false, taxCredentials: false,
    });
    expect(result.firstMissing).toBe('name');
  });

  it('returns 100 when all five groups are valid', () => {
    const result = calculateCompletion({
      idType: 'npwp',
      name: 'Alice',
      npwp: '123456789012345',
      email: 'alice@example.com',
      phone: '081234567890',
      coretaxId: 'alice-id',
    });
    expect(result.score).toBe(100);
    expect(result.firstMissing).toBeNull();
  });

  it('steps through 20-point increments per field', () => {
    const base = { idType: 'npwp' as const };
    expect(calculateCompletion({ ...base, name: 'Alice' }).score).toBe(20);
    expect(
      calculateCompletion({ ...base, name: 'Alice', npwp: '123456789012345' }).score,
    ).toBe(40);
    expect(
      calculateCompletion({
        ...base,
        name: 'Alice',
        npwp: '123456789012345',
        email: 'a@b',
      }).score,
    ).toBe(60);
    expect(
      calculateCompletion({
        ...base,
        name: 'Alice',
        npwp: '123456789012345',
        email: 'a@b',
        phone: '08123456',
      }).score,
    ).toBe(80);
    expect(
      calculateCompletion({
        ...base,
        name: 'Alice',
        npwp: '123456789012345',
        email: 'a@b',
        phone: '08123456',
        efin: '12345',
      }).score,
    ).toBe(100);
  });

  it('reports firstMissing in stable order', () => {
    // name + id filled, email missing → firstMissing = email
    const result = calculateCompletion({
      idType: 'nik',
      name: 'Alice',
      nik: '1234567890123456',
    });
    expect(result.firstMissing).toBe('email');
  });

  it('isComplete reflects 100', () => {
    expect(isComplete({ idType: 'npwp' })).toBe(false);
    expect(
      isComplete({
        idType: 'npwp',
        name: 'Alice',
        npwp: '123456789012345',
        email: 'a@b',
        phone: '08123456',
        efin: '1',
      }),
    ).toBe(true);
  });
});
