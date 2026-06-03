/**
 * Annual Aggregator — Aggregates monthly filing data into annual summary
 *
 * Connects monthly PPh21/23/22/25/26 withholding data to annual SPT returns.
 * Used by SPT 1770SS/S/1770 API routes to auto-fill tax credits (kredit pajak).
 */

import { createClient } from '@/lib/supabase/client';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export interface MonthlyItem {
  period: string; // YYYY-MM
  grossIncome: number;
  taxWithheld: number;
}

export interface PPh23TransactionSummary {
  counterpartyName: string;
  counterpartyNpwp: string;
  serviceType: string;
  totalGross: number;
  totalTax: number;
  transactionCount: number;
}

export interface AnnualSummary {
  taxYear: number;
  customerId: string;

  pph21: {
    totalGross: number;
    totalWithheld: number;
    monthCount: number;
    monthlyBreakdown: MonthlyItem[];
  };

  pph23: {
    totalGross: number;
    totalWithheld: number;
    transactionCount: number;
    byCounterparty: PPh23TransactionSummary[];
  };

  pph22: {
    totalWithheld: number;
  };

  pph25: {
    totalInstallments: number;
  };

  pph26: {
    totalGross: number;
    totalWithheld: number;
    transactionCount: number;
  };

  ppn: {
    totalOutputTax: number;
    totalInputTax: number;
    netPayable: number;
  };

  // Kredit Pajak total (for SPT annual form)
  totalTaxCredits: number;

  // Data completeness
  monthsWithData: number;
  dataSource: 'MONTHLY_FILINGS';
}

export class AnnualAggregator {
  /**
   * Aggregate all monthly tax data for a customer and year
   */
  static async aggregate(customerId: string, taxYear: number): Promise<AnnualSummary> {
    const supabase = createClient();
    const yearPrefix = `${taxYear}-`;

    // Parallel queries for all tax types
    const [pph21Result, pph23Result, pph26Result, ppnResult, paymentsResult] = await Promise.all([
      // PPh 21 from tax_calculation
      supabase
        .from('tax_calculation')
        .select('tax_period, calculation_result, income_data')
        .eq('customer_id', customerId)
        .eq('tax_type', 'PPh21')
        .like('tax_period', `${yearPrefix}%`)
        .order('tax_period'),

      // PPh 23 from pph23_transaction
      supabase
        .from('pph23_transaction')
        .select('*')
        .eq('customer_id', customerId)
        .like('tax_period', `${yearPrefix}%`)
        .order('transaction_date'),

      // PPh 26 from pph26_transaction
      supabase
        .from('pph26_transaction')
        .select('*')
        .eq('customer_id', customerId)
        .like('tax_period', `${yearPrefix}%`),

      // PPN from ppn_faktur_monthly
      supabase
        .from('ppn_faktur_monthly')
        .select('*')
        .eq('customer_id', customerId)
        .like('tax_period', `${yearPrefix}%`),

      // Monthly payments for PPh25 installments
      supabase
        .from('tax_monthly_payment')
        .select('*')
        .eq('customer_id', customerId)
        .eq('tax_type', 'PPh25')
        .like('tax_period', `${yearPrefix}%`),
    ]);

    // PPh 21 aggregation
    const pph21Monthly: MonthlyItem[] = [];
    let pph21TotalGross = 0;
    let pph21TotalWithheld = 0;

    for (const calc of pph21Result.data || []) {
      const result = calc.calculation_result || {};
      const gross = result.grossIncome || 0;
      const withheld = result.calculatedTax || 0;
      pph21TotalGross += gross;
      pph21TotalWithheld += withheld;
      pph21Monthly.push({
        period: calc.tax_period,
        grossIncome: gross,
        taxWithheld: withheld,
      });
    }

    // PPh 23 aggregation
    let pph23TotalGross = 0;
    let pph23TotalWithheld = 0;
    const pph23ByCounterparty = new Map<string, PPh23TransactionSummary>();

    for (const tx of pph23Result.data || []) {
      const gross = Number(tx.gross_amount);
      const tax = Number(tx.tax_amount);
      pph23TotalGross += gross;
      pph23TotalWithheld += tax;

      const key = tx.counterparty_npwp || tx.counterparty_name;
      const existing = pph23ByCounterparty.get(key) || {
        counterpartyName: tx.counterparty_name,
        counterpartyNpwp: tx.counterparty_npwp || '',
        serviceType: tx.service_type,
        totalGross: 0,
        totalTax: 0,
        transactionCount: 0,
      };
      existing.totalGross += gross;
      existing.totalTax += tax;
      existing.transactionCount += 1;
      pph23ByCounterparty.set(key, existing);
    }

    // PPh 26 aggregation
    let pph26TotalGross = 0;
    let pph26TotalWithheld = 0;
    for (const tx of pph26Result.data || []) {
      pph26TotalGross += Number(tx.gross_amount);
      pph26TotalWithheld += Number(tx.tax_amount);
    }

    // PPN aggregation
    let ppnOutput = 0;
    let ppnInput = 0;
    for (const f of ppnResult.data || []) {
      if (f.faktur_type === 'KELUARAN') ppnOutput += Number(f.ppn);
      else ppnInput += Number(f.ppn);
    }

    // PPh 25 installments
    let pph25Total = 0;
    for (const p of paymentsResult.data || []) {
      pph25Total += Number(p.amount_paid || 0);
    }

    // PPh 22 — from tax_calculation
    const pph22Result = await supabase
      .from('tax_calculation')
      .select('calculation_result')
      .eq('customer_id', customerId)
      .eq('tax_type', 'PPh22')
      .like('tax_period', `${yearPrefix}%`);

    let pph22Total = 0;
    for (const calc of pph22Result.data || []) {
      pph22Total += calc.calculation_result?.calculatedTax || 0;
    }

    // Total tax credits
    const totalTaxCredits = pph21TotalWithheld + pph22Total + pph23TotalWithheld + pph25Total;

    // Count months with any data
    const allPeriods = new Set<string>();
    for (const m of pph21Monthly) allPeriods.add(m.period);
    for (const tx of pph23Result.data || []) allPeriods.add(tx.tax_period);

    return {
      taxYear,
      customerId,
      pph21: {
        totalGross: pph21TotalGross,
        totalWithheld: pph21TotalWithheld,
        monthCount: pph21Monthly.length,
        monthlyBreakdown: pph21Monthly,
      },
      pph23: {
        totalGross: pph23TotalGross,
        totalWithheld: pph23TotalWithheld,
        transactionCount: (pph23Result.data || []).length,
        byCounterparty: Array.from(pph23ByCounterparty.values()),
      },
      pph22: { totalWithheld: pph22Total },
      pph25: { totalInstallments: pph25Total },
      pph26: {
        totalGross: pph26TotalGross,
        totalWithheld: pph26TotalWithheld,
        transactionCount: (pph26Result.data || []).length,
      },
      ppn: {
        totalOutputTax: ppnOutput,
        totalInputTax: ppnInput,
        netPayable: Math.max(0, ppnOutput - ppnInput),
      },
      totalTaxCredits,
      monthsWithData: allPeriods.size,
      dataSource: 'MONTHLY_FILINGS',
    };
  }
}

/**
 * Closing-wizard-friendly credit summary. Server-side only — uses the admin
 * client so the operator/consultant variants of the closing wizard endpoint
 * can call this without the browser RLS gate. Customers still hit the same
 * code path because `customer_id` is bound to the session row that owns the
 * closing session before we call here.
 *
 * Returns per-tax-type totals + a small breakdown of where the numbers came
 * from so the UI can show "auto-detected" badges and source tables.
 */
export interface ClosingCreditSummary {
  pph22: number;
  pph23: number;
  pph25: number;
  pph26: number;
  sources: {
    pph22: { table: string; rowCount: number };
    pph23: { table: string; rowCount: number };
    pph25: { table: string; rowCount: number };
    pph26: { table: string; rowCount: number };
  };
}

export async function aggregateClosingCredits(params: {
  customerId: string;
  fiscalYear: number;
}): Promise<ClosingCreditSummary> {
  const sb = getSupabaseAdmin();
  const yearPrefix = `${params.fiscalYear}-`;

  const [pph22Res, pph23Res, pph26Res, pph25Res] = await Promise.all([
    // PPh22 — `tax_calculation` fallback (consistent with AnnualAggregator).
    sb
      .from('tax_calculation')
      .select('calculation_result')
      .eq('customer_id', params.customerId)
      .eq('tax_type', 'PPh22')
      .like('tax_period', `${yearPrefix}%`),

    // PPh23 — sum of withheld tax_amount per transaction.
    sb
      .from('pph23_transaction')
      .select('tax_amount')
      .eq('customer_id', params.customerId)
      .like('tax_period', `${yearPrefix}%`),

    // PPh26 — same shape as PPh23.
    sb
      .from('pph26_transaction')
      .select('tax_amount')
      .eq('customer_id', params.customerId)
      .like('tax_period', `${yearPrefix}%`),

    // PPh25 — monthly installments actually paid.
    sb
      .from('tax_monthly_payment')
      .select('amount_paid')
      .eq('customer_id', params.customerId)
      .eq('tax_type', 'PPh25')
      .like('tax_period', `${yearPrefix}%`),
  ]);

  let pph22Total = 0;
  for (const r of pph22Res.data ?? []) {
    const v = (r as { calculation_result?: { calculatedTax?: number } }).calculation_result;
    pph22Total += Number(v?.calculatedTax ?? 0);
  }

  let pph23Total = 0;
  for (const r of pph23Res.data ?? []) {
    pph23Total += Number((r as { tax_amount?: number | string }).tax_amount ?? 0);
  }

  let pph26Total = 0;
  for (const r of pph26Res.data ?? []) {
    pph26Total += Number((r as { tax_amount?: number | string }).tax_amount ?? 0);
  }

  let pph25Total = 0;
  for (const r of pph25Res.data ?? []) {
    pph25Total += Number((r as { amount_paid?: number | string }).amount_paid ?? 0);
  }

  return {
    pph22: Math.round(pph22Total),
    pph23: Math.round(pph23Total),
    pph25: Math.round(pph25Total),
    pph26: Math.round(pph26Total),
    sources: {
      pph22: { table: 'tax_calculation', rowCount: (pph22Res.data ?? []).length },
      pph23: { table: 'pph23_transaction', rowCount: (pph23Res.data ?? []).length },
      pph25: { table: 'tax_monthly_payment', rowCount: (pph25Res.data ?? []).length },
      pph26: { table: 'pph26_transaction', rowCount: (pph26Res.data ?? []).length },
    },
  };
}
