import { createClient } from '@/lib/supabase/client';

/**
 * SPT Masa Calculator - Indonesian Monthly Tax Return
 *
 * Implements monthly tax reporting for:
 * 1. PPh21 - Individual income tax withholding (monthly)
 * 2. PPh23 - Withholding tax on services (monthly)
 * 3. PPN - Value Added Tax (monthly)
 */

export interface SPTMasaResult {
  tax_type: 'PPh21' | 'PPh23' | 'PPN';
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

    // Fetch all PPh21 calculations for this month
    const { data: calculations, error } = await supabase
      .from('tax_calculation')
      .select('*')
      .eq('customer_id', customerId)
      .eq('tax_type', 'PPh21')
      .like('tax_period', `${month}%`)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch PPh21 calculations: ${error.message}`);
    }

    if (!calculations || calculations.length === 0) {
      // Return empty result
      const deadline = this.getSubmissionDeadline(month, 'PPh21');
      return {
        tax_type: 'PPh21',
        period: month,
        total_gross_income: 0,
        total_tax_withheld: 0,
        total_net_payable: 0,
        item_count: 0,
        breakdown: {
          employee_count: 0,
          employee_details: []
        },
        submission_deadline: deadline,
        legal_basis: 'UU HPP 2021 Pasal 21 - Monthly withholding tax on employment income'
      };
    }

    // Aggregate calculations
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

    for (const calc of calculations) {
      const result = calc.calculation_result;
      totalGrossIncome += result.grossIncome || 0;
      totalTaxWithheld += result.calculatedTax || 0;
      totalGrossSalary += result.grossIncome || 0;
      totalDeductions += result.totalDeductions || 0;
      totalTaxableIncome += result.taxableIncome || 0;

      employeeDetails.push({
        employee_name: calc.income_data.employee_name || 'Unknown',
        employee_npwp: calc.income_data.employee_npwp || '',
        gross_income: result.grossIncome || 0,
        tax_withheld: result.calculatedTax || 0
      });
    }

    const deadline = this.getSubmissionDeadline(month, 'PPh21');

    return {
      tax_type: 'PPh21',
      period: month,
      total_gross_income: totalGrossIncome,
      total_tax_withheld: totalTaxWithheld,
      total_net_payable: totalTaxWithheld, // For PPh21, withheld = payable
      item_count: calculations.length,
      breakdown: {
        employee_count: calculations.length,
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
   * Calculate PPN monthly summary
   *
   * Aggregates all PPN calculations for a given month (sales - purchases)
   * Deadline: End of month
   */
  static async calculatePPNMasa(params: {
    month: string; // 'YYYY-MM'
    customerId: string;
  }): Promise<SPTMasaResult> {
    const { month, customerId } = params;
    const supabase = createClient();

    // Fetch all PPN calculations for this month
    const { data: calculations, error } = await supabase
      .from('tax_calculation')
      .select('*')
      .eq('customer_id', customerId)
      .eq('tax_type', 'PPN')
      .like('tax_period', `${month}%`)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch PPN calculations: ${error.message}`);
    }

    if (!calculations || calculations.length === 0) {
      const deadline = this.getSubmissionDeadline(month, 'PPN');
      return {
        tax_type: 'PPN',
        period: month,
        total_gross_income: 0,
        total_tax_withheld: 0,
        total_net_payable: 0,
        item_count: 0,
        breakdown: {
          output_tax: 0,
          input_tax: 0,
          net_tax: 0,
          status: 'PAYABLE',
          sales_count: 0,
          purchase_count: 0,
          sales_details: [],
          purchase_details: []
        },
        submission_deadline: deadline,
        legal_basis: 'UU HPP 2021 - Value Added Tax (PPN 11%/12%)'
      };
    }

    // Separate sales and purchases
    const sales = calculations.filter(c => c.income_data.transaction_type === 'sale');
    const purchases = calculations.filter(c => c.income_data.transaction_type === 'purchase');

    // Calculate output tax (sales)
    let outputTax = 0;
    interface SaleDetail {
      invoice_number: string;
      customer_name: string;
      dpp: number;
      ppn_amount: number;
    }
    const salesDetails: SaleDetail[] = [];
    for (const sale of sales) {
      const ppnAmount = sale.calculation_result.calculatedTax || 0;
      outputTax += ppnAmount;

      salesDetails.push({
        invoice_number: sale.income_data.invoice_number || '',
        customer_name: sale.income_data.customer_name || 'Unknown',
        dpp: sale.income_data.dpp || 0,
        ppn_amount: ppnAmount
      });
    }

    // Calculate input tax (purchases)
    let inputTax = 0;
    interface PurchaseDetail {
      invoice_number: string;
      supplier_name: string;
      dpp: number;
      ppn_amount: number;
    }
    const purchaseDetails: PurchaseDetail[] = [];
    for (const purchase of purchases) {
      const ppnAmount = purchase.calculation_result.calculatedTax || 0;
      inputTax += ppnAmount;

      purchaseDetails.push({
        invoice_number: purchase.income_data.invoice_number || '',
        supplier_name: purchase.income_data.supplier_name || 'Unknown',
        dpp: purchase.income_data.dpp || 0,
        ppn_amount: ppnAmount
      });
    }

    // Calculate net tax (output - input)
    const netTax = outputTax - inputTax;
    const status: 'PAYABLE' | 'CREDITABLE' = netTax >= 0 ? 'PAYABLE' : 'CREDITABLE';

    const deadline = this.getSubmissionDeadline(month, 'PPN');

    return {
      tax_type: 'PPN',
      period: month,
      total_gross_income: outputTax,
      total_tax_withheld: inputTax,
      total_net_payable: Math.max(0, netTax), // Only payable if positive
      item_count: calculations.length,
      breakdown: {
        output_tax: outputTax,
        input_tax: inputTax,
        net_tax: Math.abs(netTax),
        status,
        sales_count: sales.length,
        purchase_count: purchases.length,
        sales_details: salesDetails,
        purchase_details: purchaseDetails
      },
      submission_deadline: deadline,
      legal_basis: 'UU HPP 2021 - Value Added Tax (PPN 11%/12%)'
    };
  }

  /**
   * Get submission deadline for SPT Masa
   *
   * - PPh21/PPh23: 20th of following month
   * - PPN: End of following month
   */
  private static getSubmissionDeadline(month: string, taxType: 'PPh21' | 'PPh23' | 'PPN'): Date {
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
  static isOverdue(period: string, taxType: 'PPh21' | 'PPh23' | 'PPN'): boolean {
    const deadline = this.getSubmissionDeadline(period, taxType);
    return new Date() > deadline;
  }
}
