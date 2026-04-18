/**
 * Pure types + derivations for Kartu Keluarga (KK) OCR.
 *
 * Separated from family-card.ts so that client components can import
 * `KartuKeluargaData` and `deriveFactsFromKK` without pulling the
 * Anthropic SDK or server-only loggers into the browser bundle.
 *
 * family-card.ts (the Anthropic wrapper) is server-only.
 */

export interface KKFamilyMember {
  fullName: string;
  nik: string;
  sex: 'L' | 'P' | null;
  birthDate: string | null;
  relation: string;
  maritalStatus: string | null;
}

export interface KartuKeluargaData {
  kkNumber: string | null;
  headOfHouseholdName: string | null;
  address: string | null;
  postalCode: string | null;
  kelurahan: string | null;
  kecamatan: string | null;
  kabupaten: string | null;
  provinsi: string | null;
  members: KKFamilyMember[];
  confidence: number;
  rawText: string;
}

export interface KKDerivedFacts {
  head: KKFamilyMember | null;
  spouse: KKFamilyMember | null;
  dependentsCapped: number;
  dependentsActual: number;
  dependents: KKFamilyMember[];
  looksMarried: boolean;
}

export function normaliseKartuKeluarga(raw: KartuKeluargaData): KartuKeluargaData {
  const digits16 = (v: string | null | undefined): string | null => {
    if (!v) return null;
    const d = String(v).replace(/\D/g, '');
    return d.length === 16 ? d : null;
  };

  const members = Array.isArray(raw.members) ? raw.members : [];
  return {
    kkNumber: digits16(raw.kkNumber),
    headOfHouseholdName: raw.headOfHouseholdName?.trim() || null,
    address: raw.address?.trim() || null,
    postalCode: raw.postalCode?.replace(/\D/g, '').slice(0, 5) || null,
    kelurahan: raw.kelurahan?.trim() || null,
    kecamatan: raw.kecamatan?.trim() || null,
    kabupaten: raw.kabupaten?.trim() || null,
    provinsi: raw.provinsi?.trim() || null,
    members: members.map((m) => ({
      fullName: (m.fullName || '').trim(),
      nik: digits16(m.nik) ?? '',
      sex: m.sex === 'L' || m.sex === 'P' ? m.sex : null,
      birthDate: normaliseDate(m.birthDate),
      relation: (m.relation || '').trim().toUpperCase(),
      maritalStatus: m.maritalStatus?.trim().toUpperCase() || null,
    })),
    confidence: clamp01(raw.confidence),
    rawText: raw.rawText || '',
  };
}

function clamp01(v: number | undefined): number {
  if (typeof v !== 'number' || Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function normaliseDate(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

/**
 * Derive PTKP-relevant facts from a parsed KK. Pure function.
 *
 * Rules (aligned with UU PPh Pasal 7 + PMK 101/2016):
 *   - Spouse = member whose relation is ISTRI or SUAMI.
 *   - Dependents = household members OTHER than head-of-household and
 *     spouse, capped at 3 (the PTKP maximum).
 *   - Head-of-household = the first member whose relation === 'KEPALA
 *     KELUARGA'; fall back to index 0 if the tag is missing.
 */
export function deriveFactsFromKK(kk: KartuKeluargaData): KKDerivedFacts {
  const members = kk.members;
  if (members.length === 0) {
    return {
      head: null, spouse: null,
      dependentsCapped: 0, dependentsActual: 0,
      dependents: [], looksMarried: false,
    };
  }

  const headIdx = members.findIndex((m) => m.relation === 'KEPALA KELUARGA');
  const head = headIdx >= 0 ? members[headIdx] : members[0];

  const spouse =
    members.find((m) => m.relation === 'ISTRI' || m.relation === 'SUAMI') ?? null;

  const dependents = members.filter((m) => m !== head && m !== spouse);
  const dependentsActual = dependents.length;
  const dependentsCapped = Math.min(dependentsActual, 3);

  const looksMarried =
    head.maritalStatus === 'KAWIN' || spouse !== null;

  return { head, spouse, dependentsCapped, dependentsActual, dependents, looksMarried };
}
