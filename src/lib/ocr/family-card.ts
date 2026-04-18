/**
 * Kartu Keluarga (KK, Indonesian family register) OCR — SERVER-ONLY.
 *
 * This module imports the Anthropic SDK and server loggers, so never
 * import it from client components. Pure types + derivations live in
 * `family-card-types.ts` which is safe for both client and server.
 */

import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { loggers } from '@/lib/logger';
import {
  normaliseKartuKeluarga,
  type KartuKeluargaData,
} from './family-card-types';

// Re-export the pure types for convenience — some existing call sites
// import `KartuKeluargaData` from here. The pure module is the canonical
// source; this file just widens the API for server-only callers.
export type { KartuKeluargaData, KKFamilyMember, KKDerivedFacts } from './family-card-types';
export { normaliseKartuKeluarga, deriveFactsFromKK } from './family-card-types';

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

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
