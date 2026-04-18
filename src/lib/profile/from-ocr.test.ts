import { describe, it, expect } from 'vitest';
import type { Form1721A1Data } from '@/lib/ocr/form-1721-a1';
import type { KartuKeluargaData } from '@/lib/ocr/family-card-types';
import {
  mapA1ToProfileProposals,
  mapKKToProfileProposals,
  proposalsToPatchPayload,
  type FieldProposal,
  type ProposalField,
} from './from-ocr';

const baseA1: Form1721A1Data = {
  employeeName: 'Budi Santoso',
  employeeNpwp: '12.345.678.9-012.345', // dotted form from OCR
  employeeNik: '3174012345678901',
  employeeStatus: 'TK/0',
  penghasilanBruto: 240_000_000,
  pphDipotong: 18_000_000,
};

describe('mapA1ToProfileProposals — context=self', () => {
  it('proposes name/NPWP/NIK from an empty customer', () => {
    const out = mapA1ToProfileProposals(baseA1, {}, 'self');
    expect(out).toHaveLength(3);
    const fields = out.map((p) => p.field);
    expect(fields).toEqual(['full_name', 'npwp', 'nik']);
  });

  it('normalises NPWP to 15 digits (strips dots/hyphens)', () => {
    const out = mapA1ToProfileProposals(baseA1, {}, 'self');
    const npwp = out.find((p) => p.field === 'npwp')!;
    expect(npwp.proposedValue).toBe('123456789012345');
  });

  it('flags conflict when current value differs from OCR', () => {
    const out = mapA1ToProfileProposals(
      baseA1,
      { full_name: 'Somebody Else' },
      'self',
    );
    const name = out.find((p) => p.field === 'full_name')!;
    expect(name.conflict).toBe(true);
    expect(name.currentValue).toBe('Somebody Else');
    expect(name.proposedValue).toBe('Budi Santoso');
  });

  it('does not flag conflict when current value matches OCR', () => {
    const out = mapA1ToProfileProposals(
      baseA1,
      { full_name: 'Budi Santoso' },
      'self',
    );
    expect(out.find((p) => p.field === 'full_name')!.conflict).toBe(false);
  });

  it('does not flag conflict when current value is empty', () => {
    const out = mapA1ToProfileProposals(baseA1, { full_name: null }, 'self');
    expect(out.find((p) => p.field === 'full_name')!.conflict).toBe(false);
  });

  it('drops NPWP when OCR returns an invalid length', () => {
    const out = mapA1ToProfileProposals(
      { ...baseA1, employeeNpwp: '123' }, // too short
      {},
      'self',
    );
    expect(out.find((p) => p.field === 'npwp')).toBeUndefined();
  });

  it('drops NIK when OCR returns an invalid length', () => {
    const out = mapA1ToProfileProposals(
      { ...baseA1, employeeNik: '999' }, // too short
      {},
      'self',
    );
    expect(out.find((p) => p.field === 'nik')).toBeUndefined();
  });

  it('drops name when OCR returned only whitespace', () => {
    const out = mapA1ToProfileProposals(
      { ...baseA1, employeeName: '   ' },
      {},
      'self',
    );
    expect(out.find((p) => p.field === 'full_name')).toBeUndefined();
  });

  it('proposes nothing from an empty OCR result', () => {
    const out = mapA1ToProfileProposals({}, {}, 'self');
    expect(out).toHaveLength(0);
  });

  it('never proposes spouse fields in self context', () => {
    const out = mapA1ToProfileProposals(baseA1, {}, 'self');
    const spouseFields = out.filter((p) => p.field.startsWith('spouse_'));
    expect(spouseFields).toEqual([]);
  });
});

describe('mapA1ToProfileProposals — context=spouse', () => {
  it('maps employee* fields to spouse_* fields', () => {
    const out = mapA1ToProfileProposals(baseA1, {}, 'spouse');
    const fields = out.map((p) => p.field);
    expect(fields).toEqual([
      'spouse_name',
      'spouse_npwp',
      'spouse_annual_income',
      'spouse_withheld_tax',
    ]);
  });

  it('passes through numeric income + withheld untouched', () => {
    const out = mapA1ToProfileProposals(baseA1, {}, 'spouse');
    expect(out.find((p) => p.field === 'spouse_annual_income')!.proposedValue).toBe(240_000_000);
    expect(out.find((p) => p.field === 'spouse_withheld_tax')!.proposedValue).toBe(18_000_000);
  });

  it('never proposes self (full_name/npwp/nik) in spouse context', () => {
    const out = mapA1ToProfileProposals(baseA1, {}, 'spouse');
    expect(out.find((p) => p.field === 'full_name')).toBeUndefined();
    expect(out.find((p) => p.field === 'npwp')).toBeUndefined();
    expect(out.find((p) => p.field === 'nik')).toBeUndefined();
  });

  it('drops negative income (sanity check for bad OCR)', () => {
    const out = mapA1ToProfileProposals(
      { ...baseA1, penghasilanBruto: -100 },
      {},
      'spouse',
    );
    expect(out.find((p) => p.field === 'spouse_annual_income')).toBeUndefined();
  });

  it('drops NaN income', () => {
    const out = mapA1ToProfileProposals(
      { ...baseA1, penghasilanBruto: Number.NaN },
      {},
      'spouse',
    );
    expect(out.find((p) => p.field === 'spouse_annual_income')).toBeUndefined();
  });

  it('flags income conflict when stored income differs', () => {
    const out = mapA1ToProfileProposals(
      baseA1,
      { spouse_annual_income: 1_000_000 },
      'spouse',
    );
    const inc = out.find((p) => p.field === 'spouse_annual_income')!;
    expect(inc.conflict).toBe(true);
  });

  it('does not flag conflict when stored income matches', () => {
    const out = mapA1ToProfileProposals(
      baseA1,
      { spouse_annual_income: 240_000_000 },
      'spouse',
    );
    expect(out.find((p) => p.field === 'spouse_annual_income')!.conflict).toBe(false);
  });
});

describe('proposalsToPatchPayload', () => {
  const proposals: FieldProposal[] = [
    { field: 'full_name', label: '', currentValue: null, proposedValue: 'Alice', source: 'A1', conflict: false },
    { field: 'npwp', label: '', currentValue: null, proposedValue: '123456789012345', source: 'A1', conflict: false },
    { field: 'nik', label: '', currentValue: null, proposedValue: '9999999999999999', source: 'A1', conflict: false },
  ];

  it('only includes fields whose name is in the accepted set', () => {
    const accepted = new Set<ProposalField>(['full_name', 'nik']);
    const patch = proposalsToPatchPayload(proposals, accepted);
    expect(patch).toEqual({
      full_name: 'Alice',
      nik: '9999999999999999',
    });
  });

  it('returns an empty patch when nothing is accepted', () => {
    const patch = proposalsToPatchPayload(proposals, new Set<ProposalField>());
    expect(patch).toEqual({});
  });

  it('ignores accepted fields that have no matching proposal', () => {
    const accepted = new Set<ProposalField>(['spouse_name']);
    const patch = proposalsToPatchPayload(proposals, accepted);
    expect(patch).toEqual({});
  });
});

describe('mapKKToProfileProposals', () => {
  const baseKK: KartuKeluargaData = {
    kkNumber: '3171021212345678',
    headOfHouseholdName: 'Budi Santoso',
    address: 'Jl. Sudirman No. 1 RT/RW 001/002',
    postalCode: '12190',
    kelurahan: 'Karet',
    kecamatan: 'Setiabudi',
    kabupaten: 'Jakarta Selatan',
    provinsi: 'DKI Jakarta',
    members: [
      { fullName: 'Budi Santoso', nik: '3171012301851234', sex: 'L', birthDate: '1985-01-23', relation: 'KEPALA KELUARGA', maritalStatus: 'KAWIN' },
      { fullName: 'Siti Aminah', nik: '3171023002901234', sex: 'P', birthDate: '1990-02-28', relation: 'ISTRI', maritalStatus: 'KAWIN' },
      { fullName: 'Rafi Santoso', nik: '3171011005151234', sex: 'L', birthDate: '2015-05-10', relation: 'ANAK', maritalStatus: 'BELUM KAWIN' },
    ],
    confidence: 0.92,
    rawText: '',
  };

  it('proposes head-of-household name + NIK + joined address', () => {
    const out = mapKKToProfileProposals(baseKK, {});
    const byField = Object.fromEntries(out.map((p) => [p.field, p]));
    expect(byField.full_name?.proposedValue).toBe('Budi Santoso');
    expect(byField.nik?.proposedValue).toBe('3171012301851234');
    expect(String(byField.address?.proposedValue)).toContain('Jl. Sudirman');
    expect(String(byField.address?.proposedValue)).toContain('DKI Jakarta');
    expect(String(byField.address?.proposedValue)).toContain('12190');
  });

  it('proposes spouse name when an ISTRI row exists', () => {
    const out = mapKKToProfileProposals(baseKK, {});
    const spouse = out.find((p) => p.field === 'spouse_name');
    expect(spouse?.proposedValue).toBe('Siti Aminah');
  });

  it('derives PTKP K/1 from married + 1 child', () => {
    const out = mapKKToProfileProposals(baseKK, {});
    const ptkp = out.find((p) => p.field === 'ptkp_status');
    expect(ptkp?.proposedValue).toBe('K/1');
  });

  it('derives TK/0 from single-person household', () => {
    const out = mapKKToProfileProposals({
      ...baseKK,
      members: [
        { fullName: 'Solo', nik: '3171010101901234', sex: 'L', birthDate: null, relation: 'KEPALA KELUARGA', maritalStatus: 'BELUM KAWIN' },
      ],
    });
    const ptkp = out.find((p) => p.field === 'ptkp_status');
    expect(ptkp?.proposedValue).toBe('TK/0');
  });

  it('caps PTKP dependents at 3 even when KK lists more', () => {
    const out = mapKKToProfileProposals({
      ...baseKK,
      members: [
        { fullName: 'H', nik: '3171011111111111', sex: 'L', birthDate: null, relation: 'KEPALA KELUARGA', maritalStatus: 'KAWIN' },
        { fullName: 'S', nik: '3171022222222222', sex: 'P', birthDate: null, relation: 'ISTRI', maritalStatus: 'KAWIN' },
        { fullName: 'A1', nik: '3171013333333333', sex: 'L', birthDate: null, relation: 'ANAK', maritalStatus: null },
        { fullName: 'A2', nik: '3171014444444444', sex: 'L', birthDate: null, relation: 'ANAK', maritalStatus: null },
        { fullName: 'A3', nik: '3171015555555555', sex: 'P', birthDate: null, relation: 'ANAK', maritalStatus: null },
        { fullName: 'A4', nik: '3171016666666666', sex: 'L', birthDate: null, relation: 'ANAK', maritalStatus: null },
      ],
    });
    const ptkp = out.find((p) => p.field === 'ptkp_status');
    // K/3, never K/4
    expect(ptkp?.proposedValue).toBe('K/3');
  });

  it('flags conflict when existing NIK differs', () => {
    const out = mapKKToProfileProposals(baseKK, { nik: '9999999999999999' });
    const nik = out.find((p) => p.field === 'nik')!;
    expect(nik.conflict).toBe(true);
  });

  it('sources all proposals as KK (not A1)', () => {
    const out = mapKKToProfileProposals(baseKK, {});
    expect(out.every((p) => p.source === 'KK')).toBe(true);
  });
});
