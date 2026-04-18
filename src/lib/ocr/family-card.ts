/**
 * Kartu Keluarga (KK, Indonesian family register) OCR — Phase T-010.
 *
 * A KK scan is the cheapest, most reliable source of:
 *   - head-of-household name, NIK, address
 *   - spouse info (ISTRI / SUAMI rows)
 *   - dependents count for PTKP (ANAK + other relatives in the household)
 *
 * For INDIVIDUAL customers this is the one document that materially
 * shortens onboarding: uploading KK auto-fills full_name, nik, address,
 * spouse_name, and drives the PTKP dependents slider in
 * SpouseAndDependentsCard.
 *
 * This module is intentionally narrow — it owns the KK prompt + the
 * parsed shape + validation. Actual profile writes still flow through
 * `mapKKToProfileProposals` in src/lib/profile/from-ocr.ts so the user
 * confirms field-by-field (per the plan-eng-review outside voice rule:
 * "OCR results are NEVER written to the customer row automatically").
 */

import Anthropic from '@anthropic-ai/sdk';
import { loggers } from '@/lib/logger';

export interface KKFamilyMember {
  /** Full name exactly as printed in Nama Lengkap column. */
  fullName: string;
  /** 16-digit NIK (digits only, no separators). */
  nik: string;
  /** 'L' (Laki-laki / male) or 'P' (Perempuan / female). */
  sex: 'L' | 'P' | null;
  /** Birth date in YYYY-MM-DD if parseable, else null. */
  birthDate: string | null;
  /**
   * Relationship to head of household exactly as printed in
   * "Status Hubungan Dalam Keluarga". Common values:
   *   KEPALA KELUARGA, ISTRI, SUAMI, ANAK, MENANTU, CUCU,
   *   ORANG TUA, MERTUA, FAMILI LAIN, PEMBANTU.
   */
  relation: string;
  /**
   * Marital status exactly as printed ("Status Perkawinan"). Typical:
   *   BELUM KAWIN, KAWIN, CERAI HIDUP, CERAI MATI.
   */
  maritalStatus: string | null;
}

export interface KartuKeluargaData {
  /** 16-digit Nomor Kartu Keluarga (the KK number itself). */
  kkNumber: string | null;
  /** Head-of-household (Kepala Keluarga) full name. */
  headOfHouseholdName: string | null;
  /** Full address including RT/RW, kelurahan, kecamatan, kabupaten/kota, provinsi. */
  address: string | null;
  /** 5-digit postal code if visible. */
  postalCode: string | null;
  /** Village (Desa/Kelurahan). */
  kelurahan: string | null;
  /** Sub-district (Kecamatan). */
  kecamatan: string | null;
  /** Regency/city (Kabupaten/Kota). */
  kabupaten: string | null;
  /** Province (Provinsi). */
  provinsi: string | null;
  /** All rows from the family members table, in printed order. */
  members: KKFamilyMember[];
  /** Model-reported confidence 0..1. */
  confidence: number;
  /** Raw visible text for auditability. */
  rawText: string;
}

// Lazy singleton so importing this module in tests (no API key) doesn't throw.
let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

/**
 * The prompt is deliberately schema-driven and strict about what is and
 * isn't extracted. KK scans often include scanner artifacts, stamps, and
 * wrinkles — so we ask the model to OMIT fields it cannot read rather
 * than guess.
 */
const KK_PROMPT = `You are an expert OCR assistant for Indonesian KARTU KELUARGA (KK, family register) scans.

Extract the full structure of this KK document. This is a multi-person household
register with a header block, then a table of family members.

Return ONE JSON object — no prose, no markdown fences — with this exact shape:

{
  "kkNumber": "16-digit Nomor Kartu Keluarga, digits only, or null",
  "headOfHouseholdName": "Nama Kepala Keluarga exactly as printed, or null",
  "address": "full Alamat line, or null",
  "postalCode": "5-digit Kode Pos, or null",
  "kelurahan": "Desa/Kelurahan value, or null",
  "kecamatan": "Kecamatan value, or null",
  "kabupaten": "Kabupaten/Kota value, or null",
  "provinsi": "Provinsi value, or null",
  "members": [
    {
      "fullName": "Nama Lengkap exactly as printed",
      "nik": "16-digit NIK, digits only",
      "sex": "L | P | null",
      "birthDate": "YYYY-MM-DD | null",
      "relation": "Status Hubungan Dalam Keluarga exactly as printed (KEPALA KELUARGA / ISTRI / SUAMI / ANAK / MENANTU / CUCU / ORANG TUA / MERTUA / FAMILI LAIN / PEMBANTU)",
      "maritalStatus": "Status Perkawinan exactly as printed (BELUM KAWIN / KAWIN / CERAI HIDUP / CERAI MATI) or null"
    }
  ],
  "confidence": 0.0-1.0,
  "rawText": "all text visible in the document, line-broken, no summarisation"
}

Hard rules — these prevent downstream data-quality bugs:
1. NIK and kkNumber: DIGITS ONLY, 16 characters. If you cannot read all 16 digits confidently, return null for that field. Never pad, never guess.
2. "members" must be ordered the same as the printed table (head-of-household first).
3. relation field: copy the Indonesian label VERBATIM, uppercase. Do not translate.
4. Birth dates in the KK use DD-MM-YYYY — convert to ISO YYYY-MM-DD.
5. If the scan is blurry/cropped for a specific row, include the row but set unreadable fields to null rather than guessing.
6. confidence reflects the readability of the document AS A WHOLE. Blurry scans → 0.3-0.5. Clean scans → 0.85-1.0.

Do not invent family members that are not printed on the page. If the table shows only 3 rows, return exactly 3 members.`;

const KK_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
type KKMediaType = (typeof KK_MEDIA_TYPES)[number];

/**
 * Extract a KartuKeluargaData object from a KK image using Claude's
 * vision model. Callers should pre-validate file size + media type.
 *
 * On failure returns `null` and logs — callers treat this like any
 * other OCR miss and fall back to manual entry.
 */
export async function extractKartuKeluarga(
  imageBase64: string,
  mediaType: KKMediaType,
): Promise<KartuKeluargaData | null> {
  try {
    const response = await getAnthropic().messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: KK_PROMPT },
          ],
        },
      ],
    });

    const block = response.content[0];
    if (!block || block.type !== 'text') {
      loggers.ocr.warn({}, 'KK OCR: non-text response from Claude');
      return null;
    }

    // Strip fenced code if the model wrapped JSON in ```json ... ```.
    const cleaned = block.text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) {
      loggers.ocr.warn({ raw: block.text.slice(0, 200) }, 'KK OCR: no JSON in response');
      return null;
    }

    const parsed = JSON.parse(match[0]) as KartuKeluargaData;
    return normaliseKartuKeluarga(parsed);
  } catch (err) {
    loggers.ocr.error({ err }, 'KK OCR failed');
    return null;
  }
}

/**
 * Defensive normalisation so downstream code can trust the shape:
 *   - NIK / kkNumber stripped to digits and validated to 16 chars
 *   - relation uppercased + trimmed
 *   - members default to empty array
 *
 * Export-level to make it unit-testable without hitting the model.
 */
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
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD-MM-YYYY or DD/MM/YYYY
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
 *
 * The caller (mapKKToProfileProposals) is responsible for reconciling
 * these facts with existing customer fields and presenting proposals.
 */
export interface KKDerivedFacts {
  head: KKFamilyMember | null;
  spouse: KKFamilyMember | null;
  /** Capped at 3. All non-head-non-spouse members. */
  dependentsCapped: number;
  /** Actual (uncapped) count — useful to warn user if > 3. */
  dependentsActual: number;
  /** Member rows that contribute to dependent count. */
  dependents: KKFamilyMember[];
  /** True when head.maritalStatus === 'KAWIN' or a spouse row exists. */
  looksMarried: boolean;
}

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
