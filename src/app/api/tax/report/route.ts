import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import type { RequestWithSession } from '@/types/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { generateClientReport, type ReportInput } from '@/lib/ai/report-generator';
import { convertOCRToIncomeSource } from '@/lib/tax/spt-1770ss/calculator';
import { PTKP_RATES } from '@/lib/tax/shared/constants';
import type { PTKPStatus } from '@/lib/tax/shared/types';
import type { Form1721A1Data } from '@/lib/ocr/form-1721-a1';

/**
 * POST /api/tax/report
 *
 * Generate AI-powered tax analysis report for a customer
 */
async function handleGenerateReport(req: RequestWithSession): Promise<Response> {
  try {
    const body = await req.json();
    const { customerId, taxYear, ptkpStatus, language = 'id' } = body;

    if (!customerId || !taxYear || !ptkpStatus) {
      return NextResponse.json(
        { error: 'customerId, taxYear, and ptkpStatus are required' },
        { status: 400 }
      );
    }

    if (!PTKP_RATES[ptkpStatus as PTKPStatus]) {
      return NextResponse.json({ error: 'Invalid ptkpStatus' }, { status: 400 });
    }

    // Fetch customer
    const { data: customer, error: custErr } = await getSupabaseAdmin()
      .from('customer')
      .select('id, full_name, npwp, nik, address')
      .eq('id', customerId)
      .single();

    if (custErr || !customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Fetch income sources from OCR'd documents
    const incomeSources: ReportInput['incomeSources'] = [];

    const { data: documents } = await getSupabaseAdmin()
      .from('document')
      .select('id, ocr_result, form_type')
      .eq('customer_id', customerId)
      .eq('form_type', 'FORM_1721_A1')
      .eq('ocr_status', 'COMPLETED');

    if (documents) {
      for (const doc of documents) {
        const ocrResult = doc.ocr_result as { extractedData?: Form1721A1Data };
        if (ocrResult?.extractedData && ocrResult.extractedData.tahunPajak === taxYear) {
          const d = ocrResult.extractedData;
          incomeSources.push({
            employerName: d.employerName || 'Unknown',
            employerNpwp: d.employerNpwp,
            grossIncome: d.penghasilanBruto || 0,
            netIncome: d.penghasilanNeto || 0,
            taxWithheld: d.pphDipotong || 0,
            periodStart: d.masaPajakAwal || '01',
            periodEnd: d.masaPajakAkhir || '12',
          });
        }
      }
    }

    // Fallback to tax_calculation
    if (incomeSources.length === 0) {
      const { data: calculations } = await getSupabaseAdmin()
        .from('tax_calculation')
        .select('*')
        .eq('customer_id', customerId)
        .eq('tax_type', 'PPh21')
        .eq('tax_year', taxYear);

      if (calculations) {
        for (const calc of calculations) {
          const result = calc.calculation_result || {};
          const incomeData = calc.income_data || {};
          incomeSources.push({
            employerName: incomeData.employer_name || 'Pemberi Kerja',
            employerNpwp: incomeData.employer_npwp,
            grossIncome: result.grossIncome || 0,
            netIncome: result.netIncome || 0,
            taxWithheld: result.calculatedTax || 0,
            periodStart: '01',
            periodEnd: '12',
          });
        }
      }
    }

    // Accept provided income sources
    if (body.incomeSources && body.incomeSources.length > 0) {
      incomeSources.length = 0;
      for (const src of body.incomeSources) {
        incomeSources.push(src);
      }
    }

    if (incomeSources.length === 0) {
      return NextResponse.json(
        { error: 'No income data found for this customer and tax year.' },
        { status: 400 }
      );
    }

    // Fetch filing history
    const { data: filings } = await getSupabaseAdmin()
      .from('tax_filing')
      .select('tax_type, tax_year, status, filed_at')
      .eq('customer_id', customerId)
      .order('tax_year', { ascending: false })
      .limit(10);

    const reportInput: ReportInput = {
      customer: {
        name: customer.full_name,
        npwp: customer.npwp,
        nik: customer.nik,
        address: customer.address,
      },
      taxYear,
      ptkpStatus: ptkpStatus as PTKPStatus,
      incomeSources,
      filingHistory: filings?.map((f) => ({
        taxType: f.tax_type,
        taxYear: f.tax_year,
        status: f.status,
        filedAt: f.filed_at,
      })),
      language,
    };

    const report = await generateClientReport(reportInput);

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    console.error('Report generation error:', error);
    return NextResponse.json(
      { error: 'Report generation failed', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin
  )(request as RequestWithSession, handleGenerateReport);
}
