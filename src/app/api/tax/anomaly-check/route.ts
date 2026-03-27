import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import type { RequestWithSession } from '@/types/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { detectAnomalies, type AnomalyDetectionInput } from '@/lib/ai/anomaly-detector';
import { PTKP_RATES } from '@/lib/tax/shared/constants';
import type { PTKPStatus } from '@/lib/tax/shared/types';

/**
 * POST /api/tax/anomaly-check
 *
 * Run anomaly detection on a customer's tax data
 */
async function handleAnomalyCheck(req: RequestWithSession): Promise<Response> {
  try {
    const body = await req.json();
    const { customerId, taxYear, ptkpStatus } = body;

    if (!customerId || !taxYear) {
      return NextResponse.json({ error: 'customerId and taxYear required' }, { status: 400 });
    }

    // Get customer info
    const { data: customer } = await getSupabaseAdmin()
      .from('customer')
      .select('id, full_name')
      .eq('id', customerId)
      .single();

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Get current year calculations
    const { data: currentCalcs } = await getSupabaseAdmin()
      .from('tax_calculation')
      .select('calculation_result, income_data')
      .eq('customer_id', customerId)
      .eq('tax_year', taxYear)
      .eq('tax_type', 'PPh21');

    // Get previous year calculations
    const { data: prevCalcs } = await getSupabaseAdmin()
      .from('tax_calculation')
      .select('calculation_result')
      .eq('customer_id', customerId)
      .eq('tax_year', taxYear - 1)
      .eq('tax_type', 'PPh21');

    // Get filing history
    const { data: filings } = await getSupabaseAdmin()
      .from('tax_filing')
      .select('tax_year, status, filed_at, created_at')
      .eq('customer_id', customerId)
      .order('tax_year', { ascending: false })
      .limit(5);

    // Get document count
    const { count: docCount } = await getSupabaseAdmin()
      .from('document')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId);

    // Aggregate current year data
    let grossIncome = 0, netIncome = 0, deductions = 0, taxDue = 0, taxWithheld = 0;
    let employerCount = 0;

    if (currentCalcs) {
      for (const calc of currentCalcs) {
        const r = calc.calculation_result || {};
        grossIncome += r.grossIncome || 0;
        netIncome += r.netIncome || 0;
        deductions += (r.positionCosts || 0) + (r.pensionContribution || 0);
        taxDue += r.taxDue || r.pphTerutang || 0;
        taxWithheld += r.calculatedTax || r.pphDipotong || 0;
        employerCount++;
      }
    }

    // Also accept direct data from body
    if (body.currentData) {
      const d = body.currentData;
      if (d.grossIncome) grossIncome = d.grossIncome;
      if (d.netIncome) netIncome = d.netIncome;
      if (d.taxDue) taxDue = d.taxDue;
      if (d.taxWithheld) taxWithheld = d.taxWithheld;
      if (d.employerCount) employerCount = d.employerCount;
    }

    const effectiveRate = grossIncome > 0 ? taxDue / grossIncome : 0;

    // Previous year
    let previousYearData;
    if (prevCalcs && prevCalcs.length > 0) {
      let prevGross = 0, prevNet = 0, prevTax = 0;
      for (const calc of prevCalcs) {
        const r = calc.calculation_result || {};
        prevGross += r.grossIncome || 0;
        prevNet += r.netIncome || 0;
        prevTax += r.taxDue || r.pphTerutang || 0;
      }
      previousYearData = {
        grossIncome: prevGross,
        netIncome: prevNet,
        taxDue: prevTax,
        effectiveRate: prevGross > 0 ? prevTax / prevGross : 0,
      };
    }

    // Filing history
    const filingHistory = filings?.map(f => {
      const deadline = new Date(f.tax_year + 1, 2, 31); // March 31
      const filedDate = f.filed_at ? new Date(f.filed_at) : null;
      return {
        year: f.tax_year,
        status: f.status,
        filedOnTime: filedDate ? filedDate <= deadline : false,
      };
    });

    const input: AnomalyDetectionInput = {
      customerId,
      customerName: customer.full_name,
      taxYear,
      currentData: {
        grossIncome,
        netIncome,
        deductions,
        taxDue,
        taxWithheld,
        effectiveRate,
        employerCount,
        ptkpStatus: ptkpStatus || 'TK/0',
      },
      previousYearData,
      filingHistory,
      documentCount: docCount || 0,
    };

    const result = await detectAnomalies(input);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Anomaly check error:', error);
    return NextResponse.json(
      { error: 'Anomaly detection failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return composeMiddleware(requireAuth, blockPlatformAdmin)(request as RequestWithSession, handleAnomalyCheck);
}
