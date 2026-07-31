import type { SupabaseClient } from '@supabase/supabase-js';

const AUTO_QUEUE_TAX_TYPES = new Set(['PPh21', 'PPh23', 'PPN', 'PPh_FINAL']);

export function isAutoQueueTaxType(taxType: string): boolean {
  return AUTO_QUEUE_TAX_TYPES.has(taxType);
}

/** 'YYYY-MM' → { month, year } | null (month 1-12 검증). */
export function parsePeriod(period: string): { month: number; year: number } | null {
  const m = (period ?? '').match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return { month, year };
}

/**
 * best-effort: (customer×taxType×월) djp_submission_queue 행이 없으면 생성.
 * 담당 operator(operator_client_assignments active)를 operator_id 로 세팅.
 * 어떤 예외도 던지지 않는다 — 호출측 write 를 절대 실패시키지 않는다.
 */
export async function ensureQueueForActivity(
  admin: SupabaseClient,
  customerId: string,
  taxType: string,
  period: string,
): Promise<{ created: boolean; reason?: string }> {
  try {
    if (!customerId || !isAutoQueueTaxType(taxType)) return { created: false, reason: 'unsupported' };
    const parsed = parsePeriod(period);
    if (!parsed) return { created: false, reason: 'bad-period' };
    const { month, year } = parsed;

    const { data: existing } = await admin
      .from('djp_submission_queue')
      .select('id')
      .eq('customer_id', customerId).eq('tax_type', taxType)
      .eq('tax_period_month', month).eq('tax_period_year', year)
      .maybeSingle();
    if (existing) return { created: false, reason: 'exists' };

    const { data: assign } = await admin
      .from('operator_client_assignments')
      .select('operator_id')
      .eq('customer_id', customerId).eq('is_active', true)
      .order('assigned_date', { ascending: false })
      .limit(1).maybeSingle();

    const { error } = await admin
      .from('djp_submission_queue')
      .insert({
        customer_id: customerId, tax_type: taxType,
        tax_period_month: month, tax_period_year: year,
        operator_id: assign?.operator_id ?? null, status: 'PENDING',
      });
    if (error) {
      // 23505 = UNIQUE race, treat as already-exists (idempotent).
      return { created: false, reason: error.code === '23505' ? 'exists' : error.message };
    }
    return { created: true };
  } catch (e) {
    return { created: false, reason: e instanceof Error ? e.message : 'exception' };
  }
}
