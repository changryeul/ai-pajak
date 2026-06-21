import { createClient } from '@/lib/supabase/client';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * SPT Masa Calculator - Indonesian Monthly Tax Return
 *
 * Implements monthly tax reporting for:
 * 1. PPh21 - Individual income tax withholding (monthly)
 * 2. PPh23 - Withholding tax on services (monthly)
 * 3. PPN - Value Added Tax (monthly)
 */

export interface SPTMasaResult {
  tax_type: 'PPh21' | 'PPh23' | 'PPh4_2' | 'PPN';
  period: string; // 'YYYY-MM'
  total_gross_income: number;
  total_tax_withheld: number;
  total_net_payable: number;
  item_count: number;
  breakdown: SPTMasaBreakdown;
  submission_deadline: Date;
  legal_basis: string;
}

export interface SPTMasaBreakdown {
  // PPh21 specific
  employee_count?: number;
  total_gross_salary?: number;
  total_deductions?: number;
  total_taxable_income?: number;
  employee_details?: Array<{
    employee_name: string;
    employee_npwp: string;
    gross_income: number;
    tax_withheld: number;
  }>;

  // PPh23 specific
  transaction_count?: number;
  total_transaction_amount?: number;
  transaction_details?: Array<{
    transaction_type: string;
    recipient_name: string;
    recipient_npwp: string;
    gross_amount: number;
    tax_rate: number;
    tax_withheld: number;
  }>;

  // PPh 4(2) specific
  final_tax_count?: number;
  final_tax_details?: Array<{
    income_type: string;
    counterparty_name: string;
    gross_amount: number;
    tax_rate: number;
    tax_withheld: number;
    sbu_grade?: string;
  }>;

  // PPN specific
  output_tax?: number; // PPN Keluaran (sales)
  input_tax?: number; // PPN Masukan (purchases)
  net_tax?: number; // Selisih
  status?: 'PAYABLE' | 'CREDITABLE';
  sales_count?: number;
  purchase_count?: number;
  sales_details?: Array<{
    invoice_number: string;
    customer_name: string;
    dpp: number;
    ppn_amount: number;
  }>;
  purchase_details?: Array<{
    invoice_number: string;
    supplier_name: string;
    dpp: number;
    ppn_amount: number;
  }>;

  // PMK 131/2024 — 4-bucket split (sales/purchase × luxury/essential)
  // Optional so legacy SPT Masa filings still render without crash.
  splits?: PPNLuxurySplit;
  legal_basis?: string;

  // DJP Form 1111 lampiran (A1/A2/B1) — faktur-level detail rows.
  // Optional so legacy filings still render. v1 covers:
  //   A1 = KELUARAN with NPWP (PKP sales)
  //   A2 = KELUARAN without NPWP (Non-PKP sales)
  //   B1 = MASUKAN all (creditable assumed; B2/B3 deferred)
  lampiran?: PPNLampiran;
}

/**
 * Per-faktur row for DJP Form 1111 lampiran tables.
 * Shape is shared by A1/A2/B1 — caller distinguishes by which array it's in.
 */
export interface FakturRow {
  id: string;
  faktur_number: string | null;
  faktur_date: string;
  counterparty_npwp: string | null;
  counterparty_name: string | null;
  dpp: number;
  dpp_nilai_lain: number;
  ppn: number;
  ppnbm: number;
  is_luxury: boolean;
}

export interface PPNLampiran {
  a1_pkp_sales: FakturRow[];
  a2_non_pkp_sales: FakturRow[];
  b1_input_credit: FakturRow[];
}

/**
 * PMK 131/2024 split — sales/purchase × luxury/essential.
 * dpp_nilai_lain = essential 의 11/12 조정 후 DPP (luxury 는 dpp 그대로).
 */
export interface PPNLuxuryBucket {
  count: number;
  total_dpp: number;
  total_dpp_nilai_lain: number;
  total_ppn: number;
}

export interface PPNLuxurySplit {
  sales_luxury: PPNLuxuryBucket;
  sales_essential: PPNLuxuryBucket;
  purchase_luxury: PPNLuxuryBucket;
  purchase_essential: PPNLuxuryBucket;
}

export class SPTMasaCalculator {
  /**
   * Calculate PPh21 monthly summary
   *
   * Aggregates all PPh21 calculations for a given month
   * Deadline: 20th of following month
   */
  static async calculatePPh21Masa(params: {
    month: string; // 'YYYY-MM'
    customerId: string;
  }): Promise<SPTMasaResult> {
    const { month, customerId } = params;
    const supabase = createClient();

    // PRIMARY: Fetch from monthly_payslip (actual payroll data)
    const { data: payslips, error: payslipError } = await supabase
      .from('monthly_payslip')
      .select('*, employee:employee_id(employee_name, employee_npwp)')
      .eq('customer_id', customerId)
      .eq('period', month);

    // FALLBACK: If no payslips, try tax_calculation (legacy/manual entries)
    if (payslipError || !payslips || payslips.length === 0) {
      const { data: calculations } = await supabase
        .from('tax_calculation')
        .select('*')
        .eq('customer_id', customerId)
        .eq('tax_type', 'PPh21')
        .like('tax_period', `${month}%`);

      if (!calculations || calculations.length === 0) {
        const deadline = this.getSubmissionDeadline(month, 'PPh21');
        return {
          tax_type: 'PPh21',
          period: month,
          total_gross_income: 0,
          total_tax_withheld: 0,
          total_net_payable: 0,
          item_count: 0,
          breakdown: { employee_count: 0, employee_details: [] },
          submission_deadline: deadline,
          legal_basis: 'UU HPP 2021 Pasal 21 - Monthly withholding tax on employment income'
        };
      }

      // Use tax_calculation fallback
      let tGross = 0, tTax = 0, tDeductions = 0, tTaxable = 0;
      const empDetails: Array<{ employee_name: string; employee_npwp: string; gross_income: number; tax_withheld: number }> = [];
      for (const calc of calculations) {
        const r = calc.calculation_result || {};
        tGross += r.grossIncome || 0;
        tTax += r.calculatedTax || 0;
        tDeductions += r.totalDeductions || 0;
        tTaxable += r.taxableIncome || 0;
        empDetails.push({
          employee_name: calc.income_data?.employee_name || 'Unknown',
          employee_npwp: calc.income_data?.employee_npwp || '',
          gross_income: r.grossIncome || 0,
          tax_withheld: r.calculatedTax || 0,
        });
      }
      const deadline = this.getSubmissionDeadline(month, 'PPh21');
      return {
        tax_type: 'PPh21', period: month,
        total_gross_income: tGross, total_tax_withheld: tTax, total_net_payable: tTax,
        item_count: calculations.length,
        breakdown: {
          employee_count: calculations.length,
          total_gross_salary: tGross, total_deductions: tDeductions, total_taxable_income: tTaxable,
          employee_details: empDetails,
        },
        submission_deadline: deadline,
        legal_basis: 'UU HPP 2021 Pasal 21 - Monthly withholding tax on employment income'
      };
    }

    // Use monthly_payslip data (primary path)
    let totalGrossIncome = 0;
    let totalTaxWithheld = 0;
    let totalGrossSalary = 0;
    let totalDeductions = 0;
    let totalTaxableIncome = 0;
    interface EmployeeDetail {
      employee_name: string;
      employee_npwp: string;
      gross_income: number;
      tax_withheld: number;
    }
    const employeeDetails: EmployeeDetail[] = [];

    for (const ps of payslips) {
      const gross = Number(ps.total_gross || 0);
      const tax = Number(ps.pph21_tax || 0);
      const deduction = Number(ps.total_deduction || 0);
      const taxable = Number(ps.taxable_income || 0);

      totalGrossIncome += gross;
      totalTaxWithheld += tax;
      totalGrossSalary += gross;
      totalDeductions += deduction;
      totalTaxableIncome += taxable;

      employeeDetails.push({
        // 2026-06-21: payslip 자체에도 employee_name/npwp 컬럼이 있어 sync 전에도 동작
        employee_name: ps.employee?.employee_name || ps.employee_name || 'Unknown',
        employee_npwp: ps.employee?.employee_npwp || ps.employee_npwp || '',
        gross_income: gross,
        tax_withheld: tax,
      });
    }

    const deadline = this.getSubmissionDeadline(month, 'PPh21');

    return {
      tax_type: 'PPh21',
      period: month,
      total_gross_income: totalGrossIncome,
      total_tax_withheld: totalTaxWithheld,
      total_net_payable: totalTaxWithheld,
      item_count: payslips.length,
      breakdown: {
        employee_count: payslips.length,
        total_gross_salary: totalGrossSalary,
        total_deductions: totalDeductions,
        total_taxable_income: totalTaxableIncome,
        employee_details: employeeDetails
      },
      submission_deadline: deadline,
      legal_basis: 'UU HPP 2021 Pasal 21 - Monthly withholding tax on employment income'
    };
  }

  /**
   * Calculate PPh23 monthly summary
   *
   * Aggregates all PPh23 calculations for a given month
   * Deadline: 20th of following month
   */
  static async calculatePPh23Masa(params: {
    month: string; // 'YYYY-MM'
    customerId: string;
  }): Promise<SPTMasaResult> {
    const { month, customerId } = params;
    const supabase = createClient();

    // Fetch all PPh23 calculations for this month
    const { data: calculations, error } = await supabase
      .from('tax_calculation')
      .select('*')
      .eq('customer_id', customerId)
      .eq('tax_type', 'PPh23')
      .like('tax_period', `${month}%`)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch PPh23 calculations: ${error.message}`);
    }

    if (!calculations || calculations.length === 0) {
      const deadline = this.getSubmissionDeadline(month, 'PPh23');
      return {
        tax_type: 'PPh23',
        period: month,
        total_gross_income: 0,
        total_tax_withheld: 0,
        total_net_payable: 0,
        item_count: 0,
        breakdown: {
          transaction_count: 0,
          transaction_details: []
        },
        submission_deadline: deadline,
        legal_basis: 'PMK 141/2015 - Withholding tax on services and other income'
      };
    }

    // Aggregate calculations
    let totalGrossAmount = 0;
    let totalTaxWithheld = 0;
    interface TransactionDetail {
      transaction_type: string;
      recipient_name: string;
      recipient_npwp: string;
      gross_amount: number;
      tax_rate: number;
      tax_withheld: number;
    }
    const transactionDetails: TransactionDetail[] = [];

    for (const calc of calculations) {
      const result = calc.calculation_result;
      totalGrossAmount += result.grossIncome || 0;
      totalTaxWithheld += result.calculatedTax || 0;

      transactionDetails.push({
        transaction_type: calc.income_data.transaction_type || 'service',
        recipient_name: calc.income_data.recipient_name || 'Unknown',
        recipient_npwp: calc.income_data.recipient_npwp || '',
        gross_amount: result.grossIncome || 0,
        tax_rate: calc.income_data.transaction_type === 'service' ? 0.02 : 0.15,
        tax_withheld: result.calculatedTax || 0
      });
    }

    const deadline = this.getSubmissionDeadline(month, 'PPh23');

    return {
      tax_type: 'PPh23',
      period: month,
      total_gross_income: totalGrossAmount,
      total_tax_withheld: totalTaxWithheld,
      total_net_payable: totalTaxWithheld,
      item_count: calculations.length,
      breakdown: {
        transaction_count: calculations.length,
        total_transaction_amount: totalGrossAmount,
        transaction_details: transactionDetails
      },
      submission_deadline: deadline,
      legal_basis: 'PMK 141/2015 - Withholding tax on services and other income'
    };
  }

  /**
   * Calculate PPh 4(2) Final Tax monthly summary
   *
   * Aggregates construction, rental, and other final tax transactions
   * Deadline: 20th of following month
   */
  static async calculatePPh42Masa(params: {
    month: string;
    customerId: string;
  }): Promise<SPTMasaResult> {
    const { month, customerId } = params;
    const supabase = createClient();

    // Fetch PPh Final calculations for this month
    const { data: calculations, error } = await supabase
      .from('tax_calculation')
      .select('*')
      .eq('customer_id', customerId)
      .eq('tax_type', 'PPh_FINAL')
      .like('tax_period', `${month}%`)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch PPh 4(2) calculations: ${error.message}`);
    }

    const deadline = this.getSubmissionDeadline(month, 'PPh4_2');

    if (!calculations || calculations.length === 0) {
      return {
        tax_type: 'PPh4_2',
        period: month,
        total_gross_income: 0,
        total_tax_withheld: 0,
        total_net_payable: 0,
        item_count: 0,
        breakdown: { final_tax_count: 0, final_tax_details: [] },
        submission_deadline: deadline,
        legal_basis: 'PP 9/2022, PP 34/2017 - Final tax on construction, rental, and other income',
      };
    }

    let totalGross = 0;
    let totalTax = 0;
    const details: Array<{
      income_type: string;
      counterparty_name: string;
      gross_amount: number;
      tax_rate: number;
      tax_withheld: number;
      sbu_grade?: string;
    }> = [];

    for (const calc of calculations) {
      const result = calc.calculation_result;
      const brackets = result.taxBrackets || [];
      const bracket = brackets[0];

      totalGross += result.grossIncome || 0;
      totalTax += result.calculatedTax || 0;

      details.push({
        income_type: bracket?.bracket?.replace('Pasal 4(2) - ', '') || 'UNKNOWN',
        counterparty_name: calc.income_data?.counterparty_name || 'Unknown',
        gross_amount: result.grossIncome || 0,
        tax_rate: bracket?.rate || 0,
        tax_withheld: result.calculatedTax || 0,
        sbu_grade: bracket?.details?.sbu_grade,
      });
    }

    return {
      tax_type: 'PPh4_2',
      period: month,
      total_gross_income: totalGross,
      total_tax_withheld: totalTax,
      total_net_payable: totalTax,
      item_count: calculations.length,
      breakdown: {
        final_tax_count: calculations.length,
        final_tax_details: details,
      },
      submission_deadline: deadline,
      legal_basis: 'PP 9/2022, PP 34/2017 - Final tax on construction, rental, and other income',
    };
  }

  /**
   * Calculate PPN monthly summary
   *
   * 2026-06-03 Phase 3.x upgrade — source switched from `tax_calculation`
   * (legacy manual entries) to `ppn_faktur_monthly` (actual import flow).
   *
   * Output now includes a 4-bucket split (sales/purchase × luxury/essential)
   * per PMK 131/2024, with both `dpp` and `dpp_nilai_lain` totals so the
   * PDF can render the effective rate (essential: DPP × 11/12 × 12% = 11%).
   *
   * Backward-compat: `output_tax / input_tax / net_tax / sales_count /
   * purchase_count` preserved — existing callers (route.ts response,
   * legacy PDF render path) continue to work without changes.
   *
   * Deadline: End of following month.
   */
  static async calculatePPNMasa(params: {
    month: string; // 'YYYY-MM'
    customerId: string;
  }): Promise<SPTMasaResult> {
    const { month, customerId } = params;
    // Server-side admin client — matches the pattern used by every other
    // ppn_faktur_monthly call site (route.ts, bulk-import, export, etc.).
    // The auth gate has already run in the route's middleware, so RLS-free
    // read here is safe.
    const supabase = getSupabaseAdmin();

    // NEW source: ppn_faktur_monthly (Phase 3.x import target).
    // Extra fields (id, counterparty_npwp, ppnbm) added for DJP Form 1111
    // lampiran A1/A2/B1 row-level detail. ppnbm may be NULL on schemas
    // that pre-date the luxury column — caller normalizes to 0.
    const { data: fakturs, error } = await supabase
      .from('ppn_faktur_monthly')
      .select(
        'id, faktur_type, dpp, dpp_nilai_lain, ppn, ppnbm, is_luxury, status, faktur_number, faktur_date, counterparty_name, counterparty_npwp',
      )
      .eq('customer_id', customerId)
      .eq('tax_period', month)
      .order('faktur_date', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch PPN fakturs: ${error.message}`);
    }

    const deadline = this.getSubmissionDeadline(month, 'PPN');
    const LEGAL_BASIS =
      'PMK 131/2024 — Essential: DPP × 11/12 × 12% = effective 11%; Luxury: DPP × 12%';

    // Initialize 4-bucket split.
    const emptyBucket = (): PPNLuxuryBucket => ({
      count: 0,
      total_dpp: 0,
      total_dpp_nilai_lain: 0,
      total_ppn: 0,
    });
    const splits: PPNLuxurySplit = {
      sales_luxury: emptyBucket(),
      sales_essential: emptyBucket(),
      purchase_luxury: emptyBucket(),
      purchase_essential: emptyBucket(),
    };

    interface SaleDetail {
      invoice_number: string;
      customer_name: string;
      dpp: number;
      ppn_amount: number;
    }
    interface PurchaseDetail {
      invoice_number: string;
      supplier_name: string;
      dpp: number;
      ppn_amount: number;
    }
    const salesDetails: SaleDetail[] = [];
    const purchaseDetails: PurchaseDetail[] = [];

    for (const f of fakturs ?? []) {
      const side = f.faktur_type === 'KELUARAN' ? 'sales' : 'purchase';
      const kind = f.is_luxury === true ? 'luxury' : 'essential';
      const k = `${side}_${kind}` as keyof PPNLuxurySplit;
      const dpp = Number(f.dpp) || 0;
      // dpp_nilai_lain can be null for legacy rows — fall back to dpp.
      const dppNilaiLain = Number(f.dpp_nilai_lain ?? f.dpp) || 0;
      const ppn = Number(f.ppn) || 0;

      splits[k].count += 1;
      splits[k].total_dpp += dpp;
      splits[k].total_dpp_nilai_lain += dppNilaiLain;
      splits[k].total_ppn += ppn;

      if (side === 'sales') {
        salesDetails.push({
          invoice_number: f.faktur_number || '',
          customer_name: f.counterparty_name || 'Unknown',
          dpp,
          ppn_amount: ppn,
        });
      } else {
        purchaseDetails.push({
          invoice_number: f.faktur_number || '',
          supplier_name: f.counterparty_name || 'Unknown',
          dpp,
          ppn_amount: ppn,
        });
      }
    }

    // DJP Form 1111 lampiran — per-faktur detail for A1/A2/B1.
    // A1 = KELUARAN with NPWP (≥15-digit) → PKP sales
    // A2 = KELUARAN without NPWP → Non-PKP sales
    // B1 = MASUKAN all (creditable assumed; B2/B3 deferred — needs schema)
    const a1_pkp_sales: FakturRow[] = [];
    const a2_non_pkp_sales: FakturRow[] = [];
    const b1_input_credit: FakturRow[] = [];

    const mapRow = (f: typeof fakturs[number]): FakturRow => ({
      id: f.id,
      faktur_number: f.faktur_number ?? null,
      faktur_date: f.faktur_date,
      counterparty_npwp: f.counterparty_npwp ?? null,
      counterparty_name: f.counterparty_name ?? null,
      dpp: Number(f.dpp) || 0,
      dpp_nilai_lain: Number(f.dpp_nilai_lain ?? f.dpp) || 0,
      ppn: Number(f.ppn) || 0,
      ppnbm: Number(f.ppnbm) || 0,
      is_luxury: f.is_luxury === true,
    });

    for (const f of fakturs ?? []) {
      if (f.faktur_type === 'KELUARAN') {
        const hasNpwp = (f.counterparty_npwp ?? '').trim().length >= 15;
        (hasNpwp ? a1_pkp_sales : a2_non_pkp_sales).push(mapRow(f));
      } else if (f.faktur_type === 'MASUKAN') {
        b1_input_credit.push(mapRow(f));
      }
    }

    // Sort by faktur_date ASC — DJP convention for lampiran tables.
    const byDate = (x: FakturRow, y: FakturRow) =>
      x.faktur_date.localeCompare(y.faktur_date);
    a1_pkp_sales.sort(byDate);
    a2_non_pkp_sales.sort(byDate);
    b1_input_credit.sort(byDate);

    const outputTax =
      splits.sales_luxury.total_ppn + splits.sales_essential.total_ppn;
    const inputTax =
      splits.purchase_luxury.total_ppn + splits.purchase_essential.total_ppn;
    // Signed net (positive = KURANG BAYAR, negative = LEBIH BAYAR).
    const netTax = outputTax - inputTax;
    const status: 'PAYABLE' | 'CREDITABLE' = netTax >= 0 ? 'PAYABLE' : 'CREDITABLE';
    const salesCount =
      splits.sales_luxury.count + splits.sales_essential.count;
    const purchaseCount =
      splits.purchase_luxury.count + splits.purchase_essential.count;
    const itemCount = salesCount + purchaseCount;

    return {
      tax_type: 'PPN',
      period: month,
      total_gross_income: outputTax,
      total_tax_withheld: inputTax,
      total_net_payable: Math.max(0, netTax), // Only payable if positive
      item_count: itemCount,
      breakdown: {
        output_tax: outputTax,
        input_tax: inputTax,
        // Signed net so PDF B.3 can label KURANG BAYAR / LEBIH BAYAR / NIHIL.
        net_tax: netTax,
        status,
        sales_count: salesCount,
        purchase_count: purchaseCount,
        sales_details: salesDetails,
        purchase_details: purchaseDetails,
        // NEW — PMK 131/2024 split.
        splits,
        legal_basis: LEGAL_BASIS,
        // NEW — DJP Form 1111 lampiran (faktur-level detail).
        lampiran: {
          a1_pkp_sales,
          a2_non_pkp_sales,
          b1_input_credit,
        },
      },
      submission_deadline: deadline,
      legal_basis: LEGAL_BASIS,
    };
  }

  /**
   * Get submission deadline for SPT Masa
   *
   * - PPh21/PPh23: 20th of following month
   * - PPN: End of following month
   */
  private static getSubmissionDeadline(month: string, taxType: 'PPh21' | 'PPh23' | 'PPh4_2' | 'PPN'): Date {
    const [year, monthNum] = month.split('-').map(Number);

    if (taxType === 'PPN') {
      // PPN deadline: End of following month
      return new Date(year, monthNum, 0); // Last day of following month
    } else {
      // PPh21/PPh23 deadline: 20th of following month
      return new Date(year, monthNum, 20);
    }
  }

  /**
   * Helper: Format Rupiah
   */
  static formatRupiah(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  /**
   * Helper: Validate period format (YYYY-MM)
   */
  static isValidPeriod(period: string): boolean {
    const regex = /^\d{4}-(0[1-9]|1[0-2])$/;
    return regex.test(period);
  }

  /**
   * Helper: Get current tax period
   */
  static getCurrentPeriod(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * Helper: Get previous tax period
   */
  static getPreviousPeriod(period: string): string {
    const [year, month] = period.split('-').map(Number);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    return `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
  }

  /**
   * Helper: Check if period is overdue
   */
  static isOverdue(period: string, taxType: 'PPh21' | 'PPh23' | 'PPh4_2' | 'PPN'): boolean {
    const deadline = this.getSubmissionDeadline(period, taxType);
    return new Date() > deadline;
  }
}
