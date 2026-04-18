/**
 * OCR → customer profile proposals.
 *
 * Per the 2026-04-18 /plan-eng-review outside voice #4: OCR results are NEVER
 * written to the customer row automatically. They are turned into a list of
 * **proposals** the user confirms field-by-field in <ProfileFillProposal>.
 *
 * Supported sources:
 *   - A1 (Form 1721-A1) — employee income slip. Handled here.
 *   - KK (Kartu Keluarga) — family register, via the generic OCR processor.
 *     KK maps differently (family_count is not on customer; name/NIK overlap).
 *     See T-010 in TODOS.md for the INDIVIDUAL OCR prompt tuning follow-up.
 *
 * Pure function: no I/O, no side effects.
 */

import type { Form1721A1Data } from '@/lib/ocr/form-1721-a1';
import { deriveFactsFromKK, type KartuKeluargaData } from '@/lib/ocr/family-card';
import { buildPTKPStatus } from '@/lib/tax/shared/tax-utils';
import type { PTKPStatus } from '@/lib/tax/shared/types';

export type ProposalSource = 'A1' | 'KK';

/** Who the form belongs to — the user or their spouse. */
export type ProposalContext = 'self' | 'spouse';

export type ProposalField =
  | 'full_name'
  | 'npwp'
  | 'nik'
  | 'address'
  | 'spouse_name'
  | 'spouse_npwp'
  | 'spouse_annual_income'
  | 'spouse_withheld_tax'
  | 'ptkp_status';

export interface FieldProposal {
  /** customer table column name */
  field: ProposalField;
  /** stable, translator-friendly label key or verbatim label */
  label: string;
  /** existing value on the customer row (null for blank) */
  currentValue: string | number | null;
  /** value extracted from OCR */
  proposedValue: string | number | null;
  /** which document produced this proposal */
  source: ProposalSource;
  /** true when currentValue is present AND differs from proposedValue */
  conflict: boolean;
}

type CustomerSnapshot = Partial<{
  full_name: string | null;
  npwp: string | null;
  nik: string | null;
  address: string | null;
  spouse_name: string | null;
  spouse_npwp: string | null;
  spouse_annual_income: number | null;
  spouse_withheld_tax: number | null;
  ptkp_status: PTKPStatus | null;
}>;

/**
 * Normalises NPWP/NIK to digits only so OCR formats (dots, hyphens) match
 * the stored compact form.
 */
function digitsOnly(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = v.replace(/\D/g, '');
  return d.length === 0 ? null : d;
}

function trimmed(v: string | null | undefined): string | null {
  if (!v) return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

function nonNegativeNumber(v: number | null | undefined): number | null {
  if (v == null) return null;
  if (Number.isNaN(v)) return null;
  if (v < 0) return null;
  return v;
}

/**
 * Build proposal objects, skipping any field where the OCR produced nothing
 * useful. Returns proposals in display order.
 */
export function mapA1ToProfileProposals(
  ocr: Form1721A1Data,
  current: CustomerSnapshot = {},
  context: ProposalContext = 'self',
): FieldProposal[] {
  const out: FieldProposal[] = [];

  const push = (p: Omit<FieldProposal, 'conflict'>) => {
    const hasCurrent = p.currentValue !== null && p.currentValue !== '' && p.currentValue !== undefined;
    const conflict =
      hasCurrent && p.proposedValue !== null && String(p.currentValue) !== String(p.proposedValue);
    out.push({ ...p, conflict });
  };

  if (context === 'self') {
    const name = trimmed(ocr.employeeName);
    if (name) {
      push({
        field: 'full_name',
        label: 'profile.fullName',
        currentValue: current.full_name ?? null,
        proposedValue: name,
        source: 'A1',
      });
    }

    const npwp = digitsOnly(ocr.employeeNpwp);
    if (npwp && npwp.length === 15) {
      push({
        field: 'npwp',
        label: 'profile.npwp',
        currentValue: current.npwp ?? null,
        proposedValue: npwp,
        source: 'A1',
      });
    }

    const nik = digitsOnly(ocr.employeeNik);
    if (nik && nik.length === 16) {
      push({
        field: 'nik',
        label: 'profile.nik',
        currentValue: current.nik ?? null,
        proposedValue: nik,
        source: 'A1',
      });
    }
    return out;
  }

  // context === 'spouse' — a spouse's 1721-A1. Used when the user has joint
  // filing and uploads their spouse's slip.
  const spouseName = trimmed(ocr.employeeName);
  if (spouseName) {
    push({
      field: 'spouse_name',
      label: 'spouse.spouseName',
      currentValue: current.spouse_name ?? null,
      proposedValue: spouseName,
      source: 'A1',
    });
  }

  const spouseNpwp = digitsOnly(ocr.employeeNpwp);
  if (spouseNpwp && spouseNpwp.length === 15) {
    push({
      field: 'spouse_npwp',
      label: 'spouse.spouseNpwp',
      currentValue: current.spouse_npwp ?? null,
      proposedValue: spouseNpwp,
      source: 'A1',
    });
  }

  const spouseIncome = nonNegativeNumber(ocr.penghasilanBruto);
  if (spouseIncome !== null) {
    push({
      field: 'spouse_annual_income',
      label: 'spouse.spouseIncome',
      currentValue: current.spouse_annual_income ?? null,
      proposedValue: spouseIncome,
      source: 'A1',
    });
  }

  const spouseWithheld = nonNegativeNumber(ocr.pphDipotong);
  if (spouseWithheld !== null) {
    push({
      field: 'spouse_withheld_tax',
      label: 'spouse.spouseWithheld',
      currentValue: current.spouse_withheld_tax ?? null,
      proposedValue: spouseWithheld,
      source: 'A1',
    });
  }

  return out;
}

/**
 * Map a parsed KK (Kartu Keluarga) to a list of profile proposals.
 *
 * KK is the single most informative INDIVIDUAL onboarding doc: it
 * gives the head-of-household name/NIK/address, confirms marital
 * status, and defines the dependent count that drives PTKP.
 *
 * Rules:
 *   - full_name + nik come from the head-of-household row.
 *   - address = "<Alamat>, RT/RW, <kelurahan>, <kecamatan>, <kabupaten>, <provinsi> <postalCode>" (joined only from non-null parts).
 *   - spouse_name from the ISTRI/SUAMI row, if present.
 *   - ptkp_status from `buildPTKPStatus` using the derived dependent count,
 *     defaulting filing mode to "separate" (PH/MT/HB) which is the
 *     conservative choice — user can switch to joint (KK) in the UI.
 *
 * Pure function. No I/O, no model calls.
 */
export function mapKKToProfileProposals(
  kk: KartuKeluargaData,
  current: CustomerSnapshot = {},
): FieldProposal[] {
  const out: FieldProposal[] = [];
  const facts = deriveFactsFromKK(kk);

  const push = (p: Omit<FieldProposal, 'conflict'>) => {
    const hasCurrent = p.currentValue !== null && p.currentValue !== '' && p.currentValue !== undefined;
    const conflict =
      hasCurrent && p.proposedValue !== null && String(p.currentValue) !== String(p.proposedValue);
    out.push({ ...p, conflict });
  };

  if (facts.head?.fullName) {
    push({
      field: 'full_name',
      label: 'profile.fullName',
      currentValue: current.full_name ?? null,
      proposedValue: facts.head.fullName,
      source: 'KK',
    });
  }

  if (facts.head?.nik && facts.head.nik.length === 16) {
    push({
      field: 'nik',
      label: 'profile.nik',
      currentValue: current.nik ?? null,
      proposedValue: facts.head.nik,
      source: 'KK',
    });
  }

  const addressBits = [kk.address, kk.kelurahan, kk.kecamatan, kk.kabupaten, kk.provinsi, kk.postalCode]
    .map((v) => (v ?? '').trim())
    .filter((v) => v.length > 0);
  if (addressBits.length > 0) {
    const joined = addressBits.join(', ');
    push({
      field: 'address',
      label: 'profile.address',
      currentValue: current.address ?? null,
      proposedValue: joined,
      source: 'KK',
    });
  }

  if (facts.spouse?.fullName) {
    push({
      field: 'spouse_name',
      label: 'spouse.spouseName',
      currentValue: current.spouse_name ?? null,
      proposedValue: facts.spouse.fullName,
      source: 'KK',
    });
  }

  // PTKP — derive from dependent count + marital guess.
  // The KK doesn't tell us whether the spouse is working or whether the
  // couple files jointly, so we default to "separate" (conservative) and
  // let the user confirm in SpouseAndDependentsCard if they want joint.
  const proposedPtkp = buildPTKPStatus({
    isMarried: facts.looksMarried,
    spouseIncomeJoint: false,
    dependents: facts.dependentsCapped,
  });
  push({
    field: 'ptkp_status',
    label: 'spouse.ptkpStatus',
    currentValue: current.ptkp_status ?? null,
    proposedValue: proposedPtkp,
    source: 'KK',
  });

  return out;
}

/**
 * Given an array of proposals, filter to those the user actually accepted
 * (identified by `field` name). Returns the shape the PATCH endpoint wants.
 */
export function proposalsToPatchPayload(
  proposals: FieldProposal[],
  acceptedFields: ReadonlySet<ProposalField>,
): Partial<Record<ProposalField, string | number | null>> {
  const patch: Partial<Record<ProposalField, string | number | null>> = {};
  for (const p of proposals) {
    if (acceptedFields.has(p.field)) {
      patch[p.field] = p.proposedValue;
    }
  }
  return patch;
}
