import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createClient } from '@supabase/supabase-js';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import type { RequestWithSession } from '@/types/auth';
import {
  TaxpayerData,
  IncomeSource1721A1,
  PTKPStatus,
  PTKP_RATES,
} from '@/lib/tax/spt-1770ss/types';
import {
  calculateSPT1770SS,
  validateSPT1770SS,
  convertOCRToIncomeSource,
} from '@/lib/tax/spt-1770ss/calculator';
import { SPT1770SSPDF } from '@/lib/tax/spt-1770ss/pdf-generator';
import { Form1721A1Data } from '@/lib/ocr/form-1721-a1';
import React from 'react';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/tax/spt/1770ss
 *
 * Generate SPT 1770 SS from customer data
 *
 * Request body:
 * - customerId: string
 * - taxYear: number
 * - ptkpStatus: PTKPStatus
 * - incomeSources?: IncomeSource1721A1[] (optional, will fetch from documents if not provided)
 * - format: 'json' | 'pdf' (default: json)
 */
async function handleGenerateSPT(req: RequestWithSession): Promise<Response> {
  try {
    const body = await req.json();
    const {
      customerId,
      taxYear,
      ptkpStatus,
      incomeSources: providedIncomeSources,
      format = 'json',
      correctionNumber = 0,
    } = body;

    // Validate required fields
    if (!customerId) {
      return NextResponse.json(
        { error: 'customerId is required' },
        { status: 400 }
      );
    }

    if (!taxYear) {
      return NextResponse.json(
        { error: 'taxYear is required' },
        { status: 400 }
      );
    }

    if (!ptkpStatus || !PTKP_RATES[ptkpStatus as PTKPStatus]) {
      return NextResponse.json(
        {
          error: 'Invalid ptkpStatus',
          validValues: Object.keys(PTKP_RATES),
        },
        { status: 400 }
      );
    }

    // Fetch customer data
    const { data: customer, error: customerError } = await supabaseAdmin
      .from('customer')
      .select('id, user_id, full_name, npwp, nik, address, phone, email')
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Build taxpayer data
    const taxpayer: TaxpayerData = {
      npwp: customer.npwp || '',
      nik: customer.nik || '',
      name: customer.full_name || '',
      address: customer.address || '',
      phone: customer.phone || '',
      email: customer.email || '',
      occupation: 'Karyawan',
    };

    // Get income sources
    let incomeSources: IncomeSource1721A1[] = [];

    if (providedIncomeSources && providedIncomeSources.length > 0) {
      // Use provided income sources
      incomeSources = providedIncomeSources;
    } else {
      // Fetch from OCR-processed documents
      const { data: documents, error: docError } = await supabaseAdmin
        .from('document')
        .select('id, ocr_result, form_type, created_at')
        .eq('customer_id', customerId)
        .eq('form_type', 'FORM_1721_A1')
        .eq('ocr_status', 'COMPLETED')
        .order('created_at', { ascending: false });

      if (docError) {
        console.error('Error fetching documents:', docError);
      }

      if (documents && documents.length > 0) {
        // Filter documents for the tax year
        for (const doc of documents) {
          const ocrResult = doc.ocr_result as { extractedData?: Form1721A1Data };
          if (ocrResult?.extractedData) {
            const extractedData = ocrResult.extractedData as Form1721A1Data;
            if (extractedData.tahunPajak === taxYear) {
              incomeSources.push(convertOCRToIncomeSource(extractedData, taxYear));
            }
          }
        }
      }

      // If no documents found, check tax_calculation table
      if (incomeSources.length === 0) {
        const { data: calculations, error: calcError } = await supabaseAdmin
          .from('tax_calculation')
          .select('*')
          .eq('customer_id', customerId)
          .eq('tax_type', 'PPh21')
          .eq('tax_year', taxYear)
          .order('created_at', { ascending: false });

        if (!calcError && calculations && calculations.length > 0) {
          // Aggregate calculations by employer (if available)
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
              positionCosts: result.positionCosts || result.biayaJabatan || 0,
              pensionContribution: result.pensionContribution || result.iuranPensiun || 0,
              netIncome: result.netIncome || result.penghasilanNeto || 0,
              ptkpAmount: result.ptkp || PTKP_RATES[ptkpStatus as PTKPStatus],
              taxableIncome: result.taxableIncome || result.pkp || 0,
              taxDue: result.taxDue || result.pphTerutang || 0,
              taxWithheld: result.calculatedTax || result.pphDipotong || 0,
            });
          }
        }
      }
    }

    if (incomeSources.length === 0) {
      return NextResponse.json(
        {
          error: 'No income sources found',
          message: 'Please upload Form 1721-A1 documents or provide income data',
        },
        { status: 400 }
      );
    }

    // Calculate SPT 1770 SS
    const sptData = calculateSPT1770SS({
      taxpayer,
      ptkpStatus: ptkpStatus as PTKPStatus,
      taxYear,
      incomeSources,
      correctionNumber,
    });

    // Validate
    const validation = validateSPT1770SS(sptData);

    if (format === 'pdf') {
      // Generate PDF
      try {
        const pdfElement = React.createElement(SPT1770SSPDF, {
          data: sptData,
          showWatermark: correctionNumber === 0,
        });
        // @ts-expect-error - renderToBuffer types are not fully compatible
        const pdfBuffer = await renderToBuffer(pdfElement);

        // Convert Buffer to Uint8Array for Response compatibility
        const pdfBytes = new Uint8Array(pdfBuffer);

        return new Response(pdfBytes, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="SPT-1770SS-${taxYear}-${customer.npwp?.replace(/\./g, '')}.pdf"`,
          },
        });
      } catch (pdfError) {
        console.error('PDF generation error:', pdfError);
        return NextResponse.json(
          {
            error: 'PDF generation failed',
            message: pdfError instanceof Error ? pdfError.message : 'Unknown error',
          },
          { status: 500 }
        );
      }
    }

    // Return JSON
    return NextResponse.json({
      success: true,
      data: sptData,
      validation,
      meta: {
        generatedAt: new Date().toISOString(),
        format: 'json',
      },
    });
  } catch (error) {
    console.error('SPT generation error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/tax/spt/1770ss?customerId=xxx&taxYear=2024
 *
 * Get existing SPT 1770 SS data (if saved) or calculate from available data
 */
async function handleGetSPT(req: RequestWithSession): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const customerId = searchParams.get('customerId');
  const taxYear = searchParams.get('taxYear');

  if (!customerId || !taxYear) {
    return NextResponse.json(
      { error: 'customerId and taxYear are required' },
      { status: 400 }
    );
  }

  // Check for existing saved SPT
  const { data: existingSPT, error: sptError } = await supabaseAdmin
    .from('tax_filing')
    .select('*')
    .eq('customer_id', customerId)
    .eq('tax_type', 'SPT_1770SS')
    .eq('tax_year', parseInt(taxYear))
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!sptError && existingSPT) {
    return NextResponse.json({
      success: true,
      data: existingSPT.tax_data,
      filing: {
        id: existingSPT.id,
        status: existingSPT.status,
        filingNumber: existingSPT.filing_number,
        filedAt: existingSPT.filed_at,
      },
    });
  }

  // No existing SPT, return empty response
  return NextResponse.json({
    success: true,
    data: null,
    message: 'No existing SPT found. Use POST to generate a new one.',
  });
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin
  )(request as RequestWithSession, handleGenerateSPT);
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin
  )(request as RequestWithSession, handleGetSPT);
}
