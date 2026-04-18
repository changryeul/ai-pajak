import { describe, expect, it } from 'vitest';
import {
  normaliseKartuKeluarga,
  deriveFactsFromKK,
  type KartuKeluargaData,
} from './family-card';

const BASE: KartuKeluargaData = {
  kkNumber: null,
  headOfHouseholdName: null,
  address: null,
  postalCode: null,
  kelurahan: null,
  kecamatan: null,
  kabupaten: null,
  provinsi: null,
  members: [],
  confidence: 1,
  rawText: '',
};

describe('normaliseKartuKeluarga', () => {
  it('strips non-digits from kkNumber + NIK and validates 16-digit length', () => {
    const out = normaliseKartuKeluarga({
      ...BASE,
      kkNumber: '3171.02.12 1234 5678',
      members: [
        { fullName: 'Budi', nik: '3171-0212-3456-7890', sex: 'L', birthDate: null, relation: 'kepala keluarga', maritalStatus: null },
        { fullName: 'Short', nik: '12345', sex: 'L', birthDate: null, relation: 'anak', maritalStatus: null },
      ],
    });

    expect(out.kkNumber).toBe('3171021212345678');
    expect(out.members[0].nik).toBe('3171021234567890');
    expect(out.members[0].relation).toBe('KEPALA KELUARGA');
    // 5-digit NIK is rejected → empty string rather than partial
    expect(out.members[1].nik).toBe('');
  });

  it('converts DD-MM-YYYY birth dates to ISO', () => {
    const out = normaliseKartuKeluarga({
      ...BASE,
      members: [
        { fullName: 'A', nik: '1111222233334444', sex: 'L', birthDate: '05-11-1985', relation: 'KEPALA KELUARGA', maritalStatus: null },
        { fullName: 'B', nik: '1111222233335555', sex: 'P', birthDate: '1990-02-02', relation: 'ISTRI', maritalStatus: null },
        { fullName: 'C', nik: '1111222233336666', sex: 'L', birthDate: '06/08/2012', relation: 'ANAK', maritalStatus: null },
        { fullName: 'D', nik: '1111222233337777', sex: 'P', birthDate: 'garbage', relation: 'ANAK', maritalStatus: null },
      ],
    });
    expect(out.members[0].birthDate).toBe('1985-11-05');
    expect(out.members[1].birthDate).toBe('1990-02-02');
    expect(out.members[2].birthDate).toBe('2012-08-06');
    expect(out.members[3].birthDate).toBe(null);
  });

  it('clamps confidence to [0, 1]', () => {
    expect(normaliseKartuKeluarga({ ...BASE, confidence: 1.4 }).confidence).toBe(1);
    expect(normaliseKartuKeluarga({ ...BASE, confidence: -0.2 }).confidence).toBe(0);
    expect(normaliseKartuKeluarga({ ...BASE, confidence: 0.73 }).confidence).toBe(0.73);
    // NaN/undefined → 0
    expect(normaliseKartuKeluarga({ ...BASE, confidence: NaN }).confidence).toBe(0);
  });

  it('truncates postal code to 5 digits, strips non-digits', () => {
    const out = normaliseKartuKeluarga({ ...BASE, postalCode: '12-3450 AB' });
    expect(out.postalCode).toBe('12345');
  });
});

describe('deriveFactsFromKK', () => {
  const kk = (members: KartuKeluargaData['members']): KartuKeluargaData => ({
    ...BASE, members,
  });

  it('single-person household: 0 dependents, not married', () => {
    const f = deriveFactsFromKK(kk([
      { fullName: 'Budi', nik: '1111222233334444', sex: 'L', birthDate: null, relation: 'KEPALA KELUARGA', maritalStatus: 'BELUM KAWIN' },
    ]));
    expect(f.head?.fullName).toBe('Budi');
    expect(f.spouse).toBe(null);
    expect(f.dependentsActual).toBe(0);
    expect(f.dependentsCapped).toBe(0);
    expect(f.looksMarried).toBe(false);
  });

  it('married, 2 kids → 2 dependents, married', () => {
    const f = deriveFactsFromKK(kk([
      { fullName: 'Budi', nik: '1111222233334444', sex: 'L', birthDate: null, relation: 'KEPALA KELUARGA', maritalStatus: 'KAWIN' },
      { fullName: 'Siti', nik: '1111222233335555', sex: 'P', birthDate: null, relation: 'ISTRI', maritalStatus: 'KAWIN' },
      { fullName: 'Anak1', nik: '1111222233336666', sex: 'L', birthDate: null, relation: 'ANAK', maritalStatus: 'BELUM KAWIN' },
      { fullName: 'Anak2', nik: '1111222233337777', sex: 'P', birthDate: null, relation: 'ANAK', maritalStatus: 'BELUM KAWIN' },
    ]));
    expect(f.head?.fullName).toBe('Budi');
    expect(f.spouse?.fullName).toBe('Siti');
    expect(f.dependentsActual).toBe(2);
    expect(f.dependentsCapped).toBe(2);
    expect(f.looksMarried).toBe(true);
  });

  it('large household caps at 3', () => {
    const f = deriveFactsFromKK(kk([
      { fullName: 'H', nik: '1111222233334444', sex: 'L', birthDate: null, relation: 'KEPALA KELUARGA', maritalStatus: 'KAWIN' },
      { fullName: 'S', nik: '1111222233335555', sex: 'P', birthDate: null, relation: 'ISTRI', maritalStatus: 'KAWIN' },
      { fullName: 'A1', nik: '1111222233336666', sex: 'L', birthDate: null, relation: 'ANAK', maritalStatus: null },
      { fullName: 'A2', nik: '1111222233337777', sex: 'L', birthDate: null, relation: 'ANAK', maritalStatus: null },
      { fullName: 'A3', nik: '1111222233338888', sex: 'P', birthDate: null, relation: 'ANAK', maritalStatus: null },
      { fullName: 'A4', nik: '1111222233339999', sex: 'L', birthDate: null, relation: 'ANAK', maritalStatus: null },
      { fullName: 'OrangTua', nik: '1111222233330000', sex: 'L', birthDate: null, relation: 'ORANG TUA', maritalStatus: 'CERAI MATI' },
    ]));
    expect(f.dependentsActual).toBe(5);
    expect(f.dependentsCapped).toBe(3);
  });

  it('falls back to index 0 when no KEPALA KELUARGA row is tagged', () => {
    const f = deriveFactsFromKK(kk([
      { fullName: 'X', nik: '1111222233334444', sex: 'L', birthDate: null, relation: 'ANAK', maritalStatus: null },
      { fullName: 'Y', nik: '1111222233335555', sex: 'P', birthDate: null, relation: 'ANAK', maritalStatus: null },
    ]));
    expect(f.head?.fullName).toBe('X');
    // Y is not head and not spouse → counts as dependent
    expect(f.dependentsActual).toBe(1);
  });

  it('empty member list → all-null facts', () => {
    const f = deriveFactsFromKK(kk([]));
    expect(f.head).toBe(null);
    expect(f.spouse).toBe(null);
    expect(f.dependentsCapped).toBe(0);
    expect(f.looksMarried).toBe(false);
  });
});
