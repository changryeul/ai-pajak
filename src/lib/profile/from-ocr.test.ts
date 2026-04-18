import { describe, it, expect } from 'vitest';
import type { Form1721A1Data } from '@/lib/ocr/form-1721-a1';
import {
  mapA1ToProfileProposals,
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
