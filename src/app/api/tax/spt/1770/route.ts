import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import type { RequestWithSession } from '@/types/auth';
import { AnnualAggregator } from '@/lib/tax/annual-aggregator';
import type {
  TaxpayerData,
  PTKPStatus,
  IncomeSource1721A1,
  AssetDeclaration,
  LiabilityDeclaration,
} from '@/lib/tax/shared/types';
import { PTKP_RATES } from '@/lib/tax/shared/constants';
import type {
  SPT1770OtherIncome,
  SPT1770FinalTaxIncome,
  SPT1770NonTaxableIncome,
  SPT1770LossCarryforward,
  SPT1770TaxCredits,
  FamilyMember,
} from '@/lib/tax/spt-1770/types';
import {
  calculateSPT1770,
  validateSPT1770,
  isBookkeepingRequired,
  type BusinessIncomeInput,
} from '@/lib/tax/spt-1770';
import { generateSPT1770PDFBuffer } from '@/lib/tax/spt-1770/pdf-generator';
import { convertOCRToIncomeSource } from '@/lib/tax/spt-1770ss/calculator';
import { Form1721A1Data } from '@/lib/ocr/form-1721-a1';

/**
 * Request body for SPT 1770 generation
 */
interface SPT1770Request {
  customerId: string;
  taxYear: number;
  ptkpStatus: PTKPStatus;
  correctionNumber?: number;
  format?: 'json' | 'pdf';

  // Business income
  businessIncome?: BusinessIncomeInput[];

  // Employment income (optional)
  employmentIncome?: IncomeSource1721A1[];

  // Other income types
  otherIncome?: Partial<SPT1770OtherIncome>;
  finalTaxIncome?: Partial<SPT1770FinalTaxIncome>;
  nonTaxableIncome?: Partial<SPT1770NonTaxableIncome>;

  // Loss carryforward
  lossCarryforward?: SPT1770LossCarryforward[];

  // Tax credits
  taxCredits?: Partial<SPT1770TaxCredits>;

  // Asset and liability declarations (required)
  assets?: AssetDeclaration[];
  liabilities?: LiabilityDeclaration[];

  // Family members
  familyMembers?: FamilyMember[];
}

/**
 * POST /api/tax/spt/1770
 *
 * Generate SPT 1770 from customer data
 *
 * For individuals with:
 * - Business income (penghasilan dari usaha)
 * - Freelance/professional income (pekerjaan bebas)
 * - Combined employment and business income
 */
async function handleGenerateSPT(req: RequestWithSession): Promise<Response> {
  try {
    const body: SPT1770Request = await req.json();
    const {
      customerId,
      taxYear,
      ptkpStatus,
      correctionNumber = 0,
      format = 'json',
      businessIncome,
      employmentIncome: providedEmploymentIncome,
      otherIncome,
      finalTaxIncome,
      nonTaxableIncome,
      lossCarryforward,
      taxCredits,
      assets = [],
      liabilities = [],
      familyMembers,
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

    // Validate business income required for 1770
    if (!businessIncome || businessIncome.length === 0) {
      return NextResponse.json(
        {
          error: 'Business income is required for SPT 1770',
          message:
            'SPT 1770 is for individuals with business or professional income. ' +
            'Use /api/tax/spt/1770s for employment-only income.',
        },
        { status: 400 }
      );
    }

    // Check bookkeeping requirement
    const totalRevenue = businessIncome.reduce(
      (sum, b) => sum + b.grossRevenue,
      0
    );
    const needsBookkeeping = isBookkeepingRequired(totalRevenue);

    for (const business of businessIncome) {
      if (needsBookkeeping && business.bookkeepingMethod === 'NORMA') {
        return NextResponse.json(
          {
            error: 'Bookkeeping required',
            message: `Total revenue >= Rp 4.8 billion requires Pembukuan method. Business "${business.businessName}" uses Norma method.`,
          },
          { status: 400 }
        );
      }
    }

    // Fetch customer data
    const { data: customer, error: customerError } = await getSupabaseAdmin()
      .from('customer')
      .select(
        'id, user_id, full_name, company_name, npwp, nik, address, phone, email, customer_type'
      )
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
      occupation: 'Wiraswasta',
    };

    // Get employment income if not provided
    const employmentIncome: IncomeSource1721A1[] = providedEmploymentIncome || [];

    if (employmentIncome.length === 0) {
      // Try to fetch from documents
      const { data: documents } = await getSupabaseAdmin()
        .from('document')
        .select('id, ocr_result, form_type')
        .eq('customer_id', customerId)
        .eq('form_type', 'FORM_1721_A1')
        .eq('ocr_status', 'COMPLETED');

      if (documents && documents.length > 0) {
        for (const doc of documents) {
          const ocrResult = doc.ocr_result as { extractedData?: Form1721A1Data };
          if (ocrResult?.extractedData?.tahunPajak === taxYear) {
            employmentIncome.push(
              convertOCRToIncomeSource(ocrResult.extractedData, taxYear)
            );
          }
        }
      }
    }

    // Auto-fill tax credits from monthly filings if not provided
    let effectiveTaxCredits = taxCredits;
    if (!effectiveTaxCredits || Object.keys(effectiveTaxCredits).length === 0) {
      try {
        const annual = await AnnualAggregator.aggregate(customerId, taxYear);
        if (annual.monthsWithData > 0) {
          effectiveTaxCredits = {
            pph21Withheld: annual.pph21.totalWithheld,
            pph22Withheld: annual.pph22.totalWithheld,
            pph23Withheld: annual.pph23.totalWithheld,
            pph25Installments: annual.pph25.totalInstallments,
          };
        }
      } catch { /* fallback */ }
    }

    // Calculate SPT 1770
    const sptData = calculateSPT1770({
      taxpayer,
      ptkpStatus,
      taxYear,
      correctionNumber,
      businessIncome,
      employmentIncome,
      otherIncome,
      finalTaxIncome,
      nonTaxableIncome,
      lossCarryforward,
      taxCredits: effectiveTaxCredits,
      assets,
      liabilities,
      familyMembers,
    });

    // Validate
    const validation = validateSPT1770(sptData);

    if (format === 'pdf') {
      try {
        const showWatermark = validation.errors.length > 0;
        const pdfBuffer = await generateSPT1770PDFBuffer(sptData, showWatermark);
        const uint8Array = new Uint8Array(pdfBuffer);

        return new NextResponse(uint8Array, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="SPT-1770-${taxpayer.npwp}-${taxYear}.pdf"`,
            'Content-Length': pdfBuffer.length.toString(),
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

    // Return JSON response
    return NextResponse.json({
      success: true,
      data: sptData,
      validation,
      meta: {
        generatedAt: new Date().toISOString(),
        format: 'json',
        formType: 'SPT_1770',
        totalBusinessRevenue: totalRevenue,
        bookkeepingRequired: needsBookkeeping,
      },
    });
  } catch (error) {
    console.error('SPT 1770 generation error:', error);
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
 * GET /api/tax/spt/1770?customerId=xxx&taxYear=2024
 *
 * Get existing SPT 1770 data
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
  const { data: existingSPT, error: sptError } = await getSupabaseAdmin()
    .from('tax_filing')
    .select('*')
    .eq('customer_id', customerId)
    .eq('tax_type', 'SPT_1770')
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

  // Check for loss carryforward from previous years
  const { data: previousLosses } = await getSupabaseAdmin()
    .from('tax_filing')
    .select('tax_year, tax_data')
    .eq('customer_id', customerId)
    .eq('tax_type', 'SPT_1770')
    .lt('tax_year', parseInt(taxYear))
    .gte('tax_year', parseInt(taxYear) - 5) // 5 year carryforward
    .order('tax_year', { ascending: true });

  const availableLossCarryforward: SPT1770LossCarryforward[] = [];

  if (previousLosses) {
    for (const filing of previousLosses) {
      const taxData = filing.tax_data as { summary?: { currentYearLoss?: number } };
      if (taxData?.summary?.currentYearLoss && taxData.summary.currentYearLoss > 0) {
        availableLossCarryforward.push({
          taxYear: filing.tax_year,
          originalLoss: taxData.summary.currentYearLoss,
          previouslyUsed: 0, // Would need to track this properly
          usedThisYear: 0,
          remaining: taxData.summary.currentYearLoss,
          expiryYear: filing.tax_year + 5,
          isExpired: parseInt(taxYear) > filing.tax_year + 5,
        });
      }
    }
  }

  return NextResponse.json({
    success: true,
    data: null,
    message: 'No existing SPT found. Use POST to generate a new one.',
    availableLossCarryforward,
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
