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
