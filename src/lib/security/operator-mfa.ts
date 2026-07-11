/**
 * Operator-tier 2FA enforcement (docs/manuals/04-tax-operator.md §2FA 필수).
 *
 * DB-backed toggle: system_setting.security.operator_mfa_required
 * (`{enabled: boolean}`). MASTER flips via the /operator/settings card;
 * PATCH endpoint calls invalidateOperatorMfaCache() after the flip.
 * 60s in-memory cache — same pattern as coretax isEnabled() (Track D).
 *
 * Enforcement happens in the server layouts (operator/layout.tsx and the
 * TAX_OPERATOR_MASTER branch of admin/layout.tsx) via checkOperatorMfaGate():
 *   'ok'        — pass through (toggle off, or session is aal2)
 *   'enroll'    — no verified TOTP factor → funnel to /settings?mfa=required
 *   'challenge' — factor enrolled but session is aal1 → /login?mfa=challenge
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';

export const SETTING_KEY = 'security.operator_mfa_required';

export const OPERATOR_TIER_ROLES = [
  'TAX_OPERATOR',
  'TAX_OPERATOR_LEAD',
  'TAX_OPERATOR_SUPERVISOR',
  'TAX_OPERATOR_MASTER',
] as const;

const CACHE_TTL_MS = 60_000;
let cache: { value: boolean; expiresAt: number } | null = null;

export async function isOperatorMfaRequired(): Promise<boolean> {
  if (cache && cache.expiresAt > Date.now()) {
    return cache.value;
  }
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('system_setting')
    .select('value')
    .eq('key', SETTING_KEY)
    .single();
  if (error) {
    loggers.auth.warn(
      { err: error.message, code: error.code },
      'operator-mfa isOperatorMfaRequired DB read failed, defaulting to false',
    );
  }
  const value = (data?.value as { enabled?: boolean } | undefined)?.enabled === true;
  cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}

/** PATCH endpoint 가 toggle 후 호출. test helper 로도 사용. */
export function invalidateOperatorMfaCache(): void {
  cache = null;
}

export type OperatorMfaGate = 'ok' | 'enroll' | 'challenge';

/**
 * Gate decision for the CURRENT cookie/bearer session. Fail-open on
 * transient auth API errors — a Supabase hiccup must not lock the whole
 * operations team out of the workbench (the toggle read itself also
 * defaults to false on error).
 */
export async function checkOperatorMfaGate(
  supabase: SupabaseClient,
): Promise<OperatorMfaGate> {
  if (!(await isOperatorMfaRequired())) return 'ok';

  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) {
    loggers.auth.warn(
      { err: error?.message },
      'operator-mfa getAuthenticatorAssuranceLevel failed, failing open',
    );
    return 'ok';
  }
  if (data.currentLevel === 'aal2') return 'ok';
  return data.nextLevel === 'aal2' ? 'challenge' : 'enroll';
}
