import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * (customer × tax_type × 귀속월) 의 납부 세액을 소스 테이블에서 계산한다.
 *
 * 자동 큐 생성(ensureQueueForActivity) 행은 amount 가 null 이라 승인돼도
 * ID Billing 발행대상(amount>0 조건)에 뜨지 않는다 — 검토완료/승인 전이
 * 시점에 이 값을 큐 행에 스탬프하는 용도. 지원하지 않는 세목/데이터 없음은
 * null 반환 (기존 amount 유지).
 */
export async function computeQueueAmount(
  admin: SupabaseClient,
  customerId: string,
  taxType: string,
  month: number,
  year: number,
): Promise<number | null> {
  const period = `${year}-${String(month).padStart(2, '0')}`;
  try {
    if (taxType === 'PPh21') {
      const { data } = await admin
        .from('monthly_payslip')
        .select('pph21_tax')
        .eq('customer_id', customerId).eq('period', period);
      if (!data || data.length === 0) return null;
      return Math.round(data.reduce((s, r) => s + Number(r.pph21_tax ?? 0), 0));
    }
    if (taxType === 'PPh23' || taxType === 'PPh4_2' || taxType === 'PPh26') {
      // 원천세 패널과 동일 소스 — pph23_transaction 은 4(2)/26 도 담는다.
      const { data } = await admin
        .from('pph23_transaction')
        .select('tax_amount')
        .eq('customer_id', customerId).eq('tax_period', period);
      if (!data || data.length === 0) return null;
      return Math.round(data.reduce((s, r) => s + Number(r.tax_amount ?? 0), 0));
    }
    if (taxType === 'PPN') {
      const { data } = await admin
        .from('ppn_faktur_monthly')
        .select('faktur_type, ppn')
        .eq('customer_id', customerId).eq('tax_period', period);
      if (!data || data.length === 0) return null;
      const out = data.filter(r => r.faktur_type !== 'MASUKAN').reduce((s, r) => s + Number(r.ppn ?? 0), 0);
      const inn = data.filter(r => r.faktur_type === 'MASUKAN').reduce((s, r) => s + Number(r.ppn ?? 0), 0);
      return Math.max(0, Math.round(out - inn)); // 납부 PPN (매입 초과 시 0)
    }
    if (taxType === 'PPh_FINAL' || taxType === 'PPh25') {
      const { data } = await admin
        .from('tax_monthly_payment')
        .select('amount_due')
        .eq('customer_id', customerId).eq('tax_period', period)
        .in('tax_type', ['PPh_FINAL', 'PPh25']);
      if (!data || data.length === 0) return null;
      return Math.round(data.reduce((s, r) => s + Number(r.amount_due ?? 0), 0));
    }
    return null; // SPT_TAHUNAN 등 — 결산 세션이 자체 세액을 갖는다
  } catch {
    return null;
  }
}
