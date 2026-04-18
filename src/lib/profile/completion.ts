/**
 * Profile completion score for INDIVIDUAL customers.
 *
 * Pure function, no I/O. Used by both the client (for instant progress bar
 * feedback) and the server (to include the score in API responses so we don't
 * re-implement the rule in two places).
 *
 * Scoring (20 points each, max 100):
 *   1. name              — non-empty
 *   2. id (NPWP or NIK)  — correct length (15 / 16 digits)
 *   3. email             — includes `@`
 *   4. phone             — 8 digits or more
 *   5. tax credentials   — any one of Coretax ID / DJP password / EFIN is set
 *
 * Missing fields return 0 points for that field; the overall score never exceeds
 * 100. Validation mirrors the /settings UI checks so the visible red/green states
 * stay in lock-step with the number.
 */

export type IdType = 'npwp' | 'nik';

export interface CompletionInput {
  name?: string | null;
  idType: IdType;
  npwp?: string | null;
  nik?: string | null;
  email?: string | null;
  phone?: string | null;
  coretaxId?: string | null;
  djpPassword?: string | null;
  efin?: string | null;
}

const PER_FIELD_WEIGHT = 20;

export function isNameValid(name?: string | null): boolean {
  return !!name && name.trim().length > 0;
}

export function isIdValid(idType: IdType, npwp?: string | null, nik?: string | null): boolean {
  if (idType === 'npwp') return !!npwp && /^\d{15}$/.test(npwp);
  return !!nik && /^\d{16}$/.test(nik);
}

export function isEmailValid(email?: string | null): boolean {
  return !!email && email.includes('@');
}

export function isPhoneValid(phone?: string | null): boolean {
  return !!phone && phone.replace(/\D/g, '').length >= 8;
}

export function isTaxCredentialsValid(input: CompletionInput): boolean {
  return !!(input.coretaxId || input.djpPassword || input.efin);
}

export interface CompletionResult {
  score: number;                  // 0..100
  fields: {
    name: boolean;
    id: boolean;
    email: boolean;
    phone: boolean;
    taxCredentials: boolean;
  };
  /** First field (in stable order) that fails. Used by /settings scroll-to-error. */
  firstMissing: keyof CompletionResult['fields'] | null;
}

export function calculateCompletion(input: CompletionInput): CompletionResult {
  const fields = {
    name: isNameValid(input.name),
    id: isIdValid(input.idType, input.npwp, input.nik),
    email: isEmailValid(input.email),
    phone: isPhoneValid(input.phone),
    taxCredentials: isTaxCredentialsValid(input),
  };

  const score =
    (fields.name ? PER_FIELD_WEIGHT : 0) +
    (fields.id ? PER_FIELD_WEIGHT : 0) +
    (fields.email ? PER_FIELD_WEIGHT : 0) +
    (fields.phone ? PER_FIELD_WEIGHT : 0) +
    (fields.taxCredentials ? PER_FIELD_WEIGHT : 0);

  const order: Array<keyof CompletionResult['fields']> = [
    'name',
    'id',
    'email',
    'phone',
    'taxCredentials',
  ];
  const firstMissing = order.find((key) => !fields[key]) ?? null;

  return { score, fields, firstMissing };
}

export function isComplete(input: CompletionInput): boolean {
  return calculateCompletion(input).score === 100;
}
