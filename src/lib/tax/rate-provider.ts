/**
 * DB-backed rate overrides for PPh 21 (Track: UI-configurable rates).
 *
 * Model: the hardcoded TS constants (config/constants.ts) are ALWAYS the
 * authoritative baseline. This provider layers optional OVERRIDES from
 * `tax_rate_config` on top — an admin can change PTKP / Pasal 17 brackets /
 * no-NPWP surcharge in the /admin/tax-rates UI and have it take effect within
 * ~60s, without a code change or deploy. If the DB row is missing, inactive,
 * out of its effective window, or fails a sanity range check, the TS default
 * is used. A DB outage or a bad edit therefore CANNOT break tax calculation —
 * it silently falls back to the version-controlled constants.
 *
 * TER (125-bracket monthly table) is intentionally NOT overridable here — it
 * changes rarely and stays in config/pph21-ter-rates.ts.
 *
 * Cache: 60s in-memory (per serverless instance), same pattern as coretax
 * isEnabled(). Sync getters read the warmed cache; if cold they return the TS
 * default, so warming (loadRateOverrides) is an enablement step, not a
 * correctness requirement — forgetting to warm just means "no overrides".
 */
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';

export interface RateBracket {
  min: number;
  max: number;
  rate: number;
}

interface RateOverrides {
  ptkp: Record<string, number>; // ptkp code (TK0..KI3) -> amount
  brackets: RateBracket[] | null;
  npwpSurcharge: number | null;
}

const TTL_MS = 60_000;
let cache: { data: RateOverrides; expiresAt: number } | null = null;

const EMPTY: RateOverrides = { ptkp: {}, brackets: null, npwpSurcharge: null };

/**
 * Warm the override cache from tax_rate_config. Best-effort: on any error the
 * cache is set to EMPTY (→ all getters fall back to TS). Safe to call on every
 * request; only hits the DB once per TTL window.
 */
export async function loadRateOverrides(): Promise<void> {
  if (cache && cache.expiresAt > Date.now()) return;
  try {
    const admin = getSupabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await admin
      .from('tax_rate_config')
      .select('category, code, rate_value, amount_value, threshold_min, threshold_max, sort_order, effective_date, expiry_date, is_active')
      .in('category', ['PTKP', 'PPH21_BRACKET', 'NPWP_SURCHARGE'])
      .eq('is_active', true);

    if (error) {
      loggers.api.warn({ err: error.message }, 'rate-provider load failed, using TS defaults');
      cache = { data: EMPTY, expiresAt: Date.now() + TTL_MS };
      return;
    }

    const rows = (data ?? []).filter((r) => {
      const eff = (r.effective_date as string | null) ?? '0000-01-01';
      const exp = (r.expiry_date as string | null) ?? '9999-12-31';
      return eff <= today && today <= exp;
    });

    const ptkp: Record<string, number> = {};
    const bracketRows: RateBracket[] = [];
    let npwpSurcharge: number | null = null;

    for (const r of rows) {
      if (r.category === 'PTKP' && typeof r.amount_value === 'number') {
        ptkp[r.code as string] = Number(r.amount_value);
      } else if (r.category === 'PPH21_BRACKET' && typeof r.rate_value === 'number') {
        bracketRows.push({
          min: Number(r.threshold_min ?? 0),
          max: r.threshold_max === null || r.threshold_max === undefined ? Infinity : Number(r.threshold_max),
          rate: Number(r.rate_value),
        });
      } else if (r.category === 'NPWP_SURCHARGE' && typeof r.rate_value === 'number') {
        npwpSurcharge = Number(r.rate_value);
      }
    }

    // brackets: only accept a full, ordered ladder (>=2 rows, sorted by min)
    const brackets = bracketRows.length >= 2
      ? bracketRows.sort((a, b) => a.min - b.min)
      : null;

    cache = { data: { ptkp, brackets, npwpSurcharge }, expiresAt: Date.now() + TTL_MS };
  } catch (err) {
    loggers.api.warn({ err }, 'rate-provider load threw, using TS defaults');
    cache = { data: EMPTY, expiresAt: Date.now() + TTL_MS };
  }
}

/** Admin PATCH calls this after editing tax_rate_config. */
export function invalidateRateCache(): void {
  cache = null;
}

// ── sync getters: DB override if sane, else TS default ──

/** PTKP amount for a status code (TK0..KI3). Sane range: 0 < v < 1e12. */
export function resolvePTKP(code: string, tsDefault: number): number {
  const v = cache?.data.ptkp[code];
  return typeof v === 'number' && v > 0 && v < 1e12 ? v : tsDefault;
}

/** Pasal 17 progressive brackets. Requires a full ladder (>=2 brackets). */
export function resolveBrackets(tsDefault: readonly RateBracket[]): readonly RateBracket[] {
  const b = cache?.data.brackets;
  if (!b || b.length < 2) return tsDefault;
  // sanity: first min must be 0, rates within (0,1]
  if (b[0].min !== 0) return tsDefault;
  if (b.some((x) => x.rate <= 0 || x.rate > 1)) return tsDefault;
  return b;
}

/** No-NPWP surcharge fraction (TS 0.20 = +20%). Sane range: 0 <= v <= 1. */
export function resolveNpwpSurcharge(tsDefault: number): number {
  const v = cache?.data.npwpSurcharge;
  return typeof v === 'number' && v >= 0 && v <= 1 ? v : tsDefault;
}
