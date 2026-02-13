import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import type { RequestWithSession } from '@/types/auth';
import type {
  TaxpayerData,
  PTKPStatus,
  IncomeSource1721A1,
  AssetDeclaration,
  LiabilityDeclaration,
} from '@/lib/tax/shared/types';
import { PTKP_RATES } from '@/lib/tax/shared/constants';
import type {
  SPT1770SOtherIncome,
  SPT1770STaxCredits,
  SPT1770SFinalTaxIncome,
  SpouseIncomeData,
} from '@/lib/tax/spt-1770s/types';
import {
  calculateSPT1770S,
  validateSPT1770S,
  checkSPT1770SEligibility,
} from '@/lib/tax/spt-1770s/calculator';
import { convertOCRToIncomeSource } from '@/lib/tax/spt-1770ss/calculator';
import { Form1721A1Data } from '@/lib/ocr/form-1721-a1';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Request body for SPT 1770 S generation
 */
interface SPT1770SRequest {
  customerId: string;
  taxYear: number;
  ptkpStatus: PTKPStatus;
  correctionNumber?: number;
  format?: 'json' | 'pdf';

  // Income data
  employmentIncome?: IncomeSource1721A1[];
  otherIncome?: Partial<SPT1770SOtherIncome>;
  finalTaxIncome?: Partial<SPT1770SFinalTaxIncome>;

  // Tax credits
  taxCredits?: Partial<SPT1770STaxCredits>;

  // Spouse income (for K/I status)
  spouseIncome?: SpouseIncomeData;

  // Asset and liability declarations
  assets?: AssetDeclaration[];
  liabilities?: LiabilityDeclaration[];
}

/**
 * POST /api/tax/spt/1770s
 *
 * Generate SPT 1770 S from customer data
 *
 * For individuals with:
 * - Annual gross income >= Rp 60 million, OR
 * - Multiple sources of employment income
 */
async function handleGenerateSPT(req: RequestWithSession): Promise<Response> {
  try {
    const body: SPT1770SRequest = await req.json();
    const {
      customerId,
      taxYear,
      ptkpStatus,
      correctionNumber = 0,
      format = 'json',
      employmentIncome: providedEmploymentIncome,
      otherIncome,
      finalTaxIncome,
      taxCredits,
      spouseIncome,
      assets,
      liabilities,
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

    if (!ptkpStatus || !PTKP_RATES[ptkpStatus]) {
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
      .select('id, user_id, full_name, company_name, npwp, nik, address, phone, email, customer_type')
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
      name: customer.full_name || customer.company_name || '',
      address: customer.address || '',
      phone: customer.phone || '',
      email: customer.email || '',
      occupation: 'Karyawan',
    };

    // Get employment income sources
    let employmentIncome: IncomeSource1721A1[] = [];

    if (providedEmploymentIncome && providedEmploymentIncome.length > 0) {
      // Use provided income sources
      employmentIncome = providedEmploymentIncome;
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
              employmentIncome.push(convertOCRToIncomeSource(extractedData, taxYear));
            }
          }
        }
      }

      // If no documents found, check tax_calculation table
      if (employmentIncome.length === 0) {
        const { data: calculations, error: calcError } = await supabaseAdmin
          .from('tax_calculation')
          .select('*')
          .eq('customer_id', customerId)
          .eq('tax_type', 'PPh21')
          .eq('tax_year', taxYear)
          .order('created_at', { ascending: false });

        if (!calcError && calculations && calculations.length > 0) {
          for (const calc of calculations) {
            const result = calc.calculation_result || {};
            const incomeData = calc.income_data || {};

            employmentIncome.push({
              employerNpwp: incomeData.employer_npwp || '',
              employerName: incomeData.employer_name || 'Pemberi Kerja',
              periodStart: '01',
              periodEnd: '12',
              taxYear,
              grossIncome: result.grossIncome || 0,
              positionCosts: result.positionCosts || result.biayaJabatan || 0,
              pensionContribution: result.pensionContribution || result.iuranPensiun || 0,
              netIncome: result.netIncome || result.penghasilanNeto || 0,
              ptkpAmount: result.ptkp || PTKP_RATES[ptkpStatus],
              taxableIncome: result.taxableIncome || result.pkp || 0,
              taxDue: result.taxDue || result.pphTerutang || 0,
              taxWithheld: result.calculatedTax || result.pphDipotong || 0,
            });
          }
        }
      }
    }

    // Check eligibility for 1770 S
    const eligibility = checkSPT1770SEligibility({
      employmentIncome,
      hasBusinessIncome: false,
    });

    if (!eligibility.eligible) {
      return NextResponse.json(
        {
          error: 'Form SPT 1770 S tidak sesuai',
          reason: eligibility.reason,
          suggestedForm: eligibility.suggestedForm,
          suggestion:
            eligibility.suggestedForm === '1770SS'
              ? 'Gunakan /api/tax/spt/1770ss untuk penghasilan < Rp 60 juta dengan satu pemberi kerja'
              : 'Gunakan /api/tax/spt/1770 untuk penghasilan usaha/pekerjaan bebas',
        },
        { status: 400 }
      );
    }

    // Calculate SPT 1770 S
    const sptData = calculateSPT1770S({
      taxpayer,
      ptkpStatus,
      taxYear,
      employmentIncome,
      otherIncome,
      finalTaxIncome,
      taxCredits,
      spouseIncome,
      assets,
      liabilities,
      correctionNumber,
    });

    // Validate
    const validation = validateSPT1770S(sptData);

    if (format === 'pdf') {
      // PDF generation to be implemented
      return NextResponse.json(
        {
          error: 'PDF generation not yet implemented for SPT 1770 S',
          message: 'Please use format=json',
        },
        { status: 501 }
      );
    }

    // Return JSON response
    return NextResponse.json({
      success: true,
      data: sptData,
      validation,
      eligibility,
      meta: {
        generatedAt: new Date().toISOString(),
        format: 'json',
        formType: 'SPT_1770S',
      },
    });
  } catch (error) {
    console.error('SPT 1770 S generation error:', error);
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
 * GET /api/tax/spt/1770s?customerId=xxx&taxYear=2024
 *
 * Get existing SPT 1770 S data or check eligibility
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
    .eq('tax_type', 'SPT_1770S')
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

  // Check eligibility based on existing income data
  const { data: documents } = await supabaseAdmin
    .from('document')
    .select('id, ocr_result')
    .eq('customer_id', customerId)
    .eq('form_type', 'FORM_1721_A1')
    .eq('ocr_status', 'COMPLETED');

  const employmentIncomeCount = documents?.length || 0;
  let totalGrossIncome = 0;

  if (documents) {
    for (const doc of documents) {
      const ocrResult = doc.ocr_result as { extractedData?: Form1721A1Data };
      if (ocrResult?.extractedData?.tahunPajak === parseInt(taxYear)) {
        totalGrossIncome += ocrResult.extractedData.penghasilanBruto || 0;
      }
    }
  }

  // Determine recommended form
  let recommendedForm: '1770SS' | '1770S' | '1770' = '1770S';
  let recommendation = '';

  if (employmentIncomeCount === 1 && totalGrossIncome < 60_000_000) {
    recommendedForm = '1770SS';
    recommendation = 'Penghasilan < Rp 60 juta dengan satu pemberi kerja, disarankan menggunakan 1770 SS';
  } else if (employmentIncomeCount > 1 || totalGrossIncome >= 60_000_000) {
    recommendedForm = '1770S';
    recommendation = 'Form 1770 S sesuai untuk wajib pajak dengan penghasilan >= Rp 60 juta atau lebih dari satu pemberi kerja';
  }

  return NextResponse.json({
    success: true,
    data: null,
    message: 'No existing SPT found. Use POST to generate a new one.',
    eligibility: {
      employmentIncomeCount,
      totalGrossIncome,
      recommendedForm,
      recommendation,
    },
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
