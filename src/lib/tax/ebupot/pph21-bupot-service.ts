/**
 * e-Bupot 1721-A1 Service
 *
 * Generates Bukti Potong numbers for PPh 21 monthly payslips.
 * Format: 1.1-MM.YY-NNNNNNN (Form 1721-A1, monthly, sequence)
 */

export interface BupotPPh21Data {
  // Pemotong (company/employer)
  pemotongNama: string;
  pemotongNpwp: string;

  // Penerima penghasilan (employee)
  employeeName: string;
  employeeNpwp: string | null;
  employeeNik: string | null;
  ptkpCategory: string;

  // Income
  grossSalary: number;
  totalDeductions: number;
  taxableIncome: number;
  pph21Amount: number;
  terRate: number;

  // Period
  period: string; // YYYY-MM
  buktiPotongNumber: string;
  buktiPotongDate: string;
}

/**
 * Generate Bukti Potong number for PPh 21 (Form 1721-A1)
 * Format: 1.1-MM.YY-NNNNNNN
 */
export function generateBPNumber1721A1(period: string, sequence: number): string {
  const [yearStr, monthStr] = period.split('-');
  const yy = yearStr.slice(-2);
  const mm = monthStr.padStart(2, '0');
  const seq = String(sequence).padStart(7, '0');
  return `1.1-${mm}.${yy}-${seq}`;
}
