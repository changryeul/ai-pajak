import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limiter';
import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import type { RequestWithSession } from '@/types/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { analyzeTaxSavings, type TaxSavingsInput } from '@/lib/ai/tax-savings-advisor';
import type { PTKPStatus, IncomeSource1721A1 } from '@/lib/tax/shared/types';
import { PTKP_RATES } from '@/lib/tax/shared/constants';
import { convertOCRToIncomeSource } from '@/lib/tax/spt-1770ss/calculator';
import type { Form1721A1Data } from '@/lib/ocr/form-1721-a1';

/**
 * POST /api/tax/savings-advice
 *
 * Analyze tax data and provide savings recommendations
 */
async function handleSavingsAdvice(req: RequestWithSession): Promise<Response> {
  try {
    const body = await req.json();
    const { customerId, taxYear, ptkpStatus } = body;

    if (!customerId || !taxYear || !ptkpStatus) {
      return NextResponse.json(
        { error: 'customerId, taxYear, and ptkpStatus are required' },
        { status: 400 }
      );
    }

    if (!PTKP_RATES[ptkpStatus as PTKPStatus]) {
      return NextResponse.json({ error: 'Invalid ptkpStatus' }, { status: 400 });
    }

    // Fetch customer data
    const { data: customer, error: customerError } = await getSupabaseAdmin()
      .from('customer')
      .select('id, full_name, npwp, nik')
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Fetch income sources from OCR'd documents
    let incomeSources: IncomeSource1721A1[] = [];

    const { data: documents } = await getSupabaseAdmin()
      .from('document')
      .select('id, ocr_result, form_type')
      .eq('customer_id', customerId)
      .eq('form_type', 'FORM_1721_A1')
      .eq('ocr_status', 'COMPLETED');

    if (documents && documents.length > 0) {
      for (const doc of documents) {
        const ocrResult = doc.ocr_result as { extractedData?: Form1721A1Data };
        if (ocrResult?.extractedData && ocrResult.extractedData.tahunPajak === taxYear) {
          incomeSources.push(convertOCRToIncomeSource(ocrResult.extractedData, taxYear));
        }
      }
    }

    // Fallback to tax_calculation table
    if (incomeSources.length === 0) {
      const { data: calculations } = await getSupabaseAdmin()
        .from('tax_calculation')
        .select('*')
        .eq('customer_id', customerId)
        .eq('tax_type', 'PPh21')
        .eq('tax_year', taxYear);

      if (calculations && calculations.length > 0) {
        for (const calc of calculations) {
          const result = calc.calculation_result || {};
          const incomeData = calc.income_data || {};
          incomeSources.push({
            employerNpwp: incomeData.employer_npwp || '',
            employerName: incomeData.employer_name || 'Pemberi Kerja',
            periodStart: '01',
            periodEnd: '12',
            taxYear,
            grossIncome: result.grossIncome || 0,
            positionCosts: result.positionCosts || 0,
            pensionContribution: result.pensionContribution || 0,
            netIncome: result.netIncome || 0,
            ptkpAmount: PTKP_RATES[ptkpStatus as PTKPStatus],
            taxableIncome: result.taxableIncome || 0,
            taxDue: result.taxDue || 0,
            taxWithheld: result.calculatedTax || 0,
          });
        }
      }
    }

    // Also accept provided income sources from request body
    if (body.incomeSources && body.incomeSources.length > 0) {
      incomeSources = body.incomeSources;
    }

    if (incomeSources.length === 0) {
      return NextResponse.json(
        { error: 'No income data found. Please upload bukti potong or provide income data.' },
        { status: 400 }
      );
    }

    // Determine additional info from PTKP status
    const status = ptkpStatus as PTKPStatus;
    const isMarried = status.startsWith('K');
    const dependents = parseInt(status.split('/').pop() || '0');
    const spouseHasIncome = status.startsWith('K/I');

    const totalPositionCosts = incomeSources.reduce((s, i) => s + i.positionCosts, 0);
    const totalPension = incomeSources.reduce((s, i) => s + i.pensionContribution, 0);

    const input: TaxSavingsInput = {
      ptkpStatus: status,
      taxYear,
      isMarried,
      dependents,
      spouseHasIncome,
      incomeSources,
      deductions: {
        positionCosts: totalPositionCosts,
        pensionContribution: totalPension,
      },
      hasBusinessIncome: body.hasBusinessIncome || false,
      businessRevenue: body.businessRevenue,
    };

    const result = await analyzeTaxSavings(input);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Tax savings advice error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze tax savings', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin
  )(request as RequestWithSession, handleSavingsAdvice);
}
