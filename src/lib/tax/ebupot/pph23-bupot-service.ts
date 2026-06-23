/**
 * e-Bupot PPh 23 Service
 *
 * Generates Bukti Potong (withholding tax certificates) for PPh 23 transactions.
 * Handles automatic numbering and bulk generation per monthly period.
 */

export interface BupotPPh23Data {
  id: string;
  buktiPotongNumber: string;
  buktiPotongDate: string;
  taxPeriod: string;

  // Pemotong (withholding agent / customer)
  pemotongName: string;
  pemotongNpwp: string;

  // Penerima penghasilan (income recipient / counterparty)
  recipientName: string;
  recipientNpwp: string;
  recipientAddress?: string;

  // Transaction details
  serviceType: string;
  serviceTypeLabel: string;
  description: string;
  transactionDate: string;
  invoiceNumber?: string;

  // Amounts
  grossAmount: number;
  taxRate: number;
  taxAmount: number;

  // e-Bupot code (PMK 141/2015)
  ebupotServiceCode?: string;
}

/**
 * Generate a Bukti Potong number for PPh 23.
 *
 * Format: BP-23/MM.YY/NNNNNNN
 * - MM: month (01-12)
 * - YY: last 2 digits of year
 * - NNNNNNN: 7-digit sequence number (zero-padded)
 */
export function generateBuktiPotongNumber(
  period: string,
  sequence: number
): string {
  // period format: YYYY-MM
  const [year, month] = period.split('-');
  const yy = year.slice(-2);
  const seq = String(sequence).padStart(7, '0');
  return `BP-23/${month}.${yy}/${seq}`;
}

/**
 * Generate PPh 26 Bukti Potong number.
 * Format: BP-26/MM.YY/NNNNNNN
 */
export function generateBuktiPotongNumberPPh26(
  period: string,
  sequence: number
): string {
  const [year, month] = period.split('-');
  const yy = year.slice(-2);
  const seq = String(sequence).padStart(7, '0');
  return `BP-26/${month}.${yy}/${seq}`;
}

/**
 * 2026-06-24: 같은 (customer_id, tax_period) 의 BP 번호 누락 행에 자동
 * 부여. 거래 insert 직후 호출하면 사용자가 수동 발행 버튼 안 눌러도 됨.
 * @returns 새로 부여된 행 수
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function assignPendingBPNumbers(sb: any, customerId: string, period: string): Promise<number> {
  // 1) BP 번호 비어있는 행 가져옴
  const { data: pending } = await sb
    .from('pph23_transaction')
    .select('id')
    .eq('customer_id', customerId)
    .eq('tax_period', period)
    .is('bukti_potong_number', null)
    .order('transaction_date');
  const rows = (pending ?? []) as Array<{ id: string }>;
  if (rows.length === 0) return 0;

  // 2) 가장 큰 sequence 조회 → startSeq
  const { data: existing } = await sb
    .from('pph23_transaction')
    .select('bukti_potong_number')
    .eq('customer_id', customerId)
    .eq('tax_period', period)
    .not('bukti_potong_number', 'is', null)
    .order('bukti_potong_number', { ascending: false })
    .limit(1);
  let startSeq = 1;
  const existingRows = (existing ?? []) as Array<{ bukti_potong_number: string }>;
  if (existingRows.length > 0) {
    const parts = (existingRows[0].bukti_potong_number || '').split('/');
    if (parts.length === 3) {
      const n = parseInt(parts[2], 10);
      if (Number.isFinite(n) && n > 0) startSeq = n + 1;
    }
  }

  // 3) 각 행에 BP 번호 + 날짜 부여
  const today = new Date().toISOString().slice(0, 10);
  let assigned = 0;
  for (let i = 0; i < rows.length; i++) {
    const bpNumber = generateBuktiPotongNumber(period, startSeq + i);
    const { error } = await sb
      .from('pph23_transaction')
      .update({ bukti_potong_number: bpNumber, bukti_potong_date: today })
      .eq('id', rows[i].id);
    if (!error) assigned++;
  }
  return assigned;
}

/**
 * Format Rupiah amount for display in bukti potong
 */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format percentage for display
 */
export function formatPercent(rate: number): string {
  const pct = rate * 100;
  const rounded = Math.round(pct * 100) / 100;
  // If it's a whole number (e.g., 2, 15, 20), no decimals
  if (Number.isInteger(rounded)) return `${rounded}%`;
  return `${rounded.toFixed(2)}%`;
}
