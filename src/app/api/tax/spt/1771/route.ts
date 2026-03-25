import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import type { RequestWithSession } from '@/types/auth';
import type {
  CorporateIdentity,
  RelatedPartyTransaction,
} from '@/lib/tax/shared/types';
import type {
  FiscalYearPeriod,
  CorporateIncomeStatement,
  CorporateBalanceSheet,
  SPT1771LossCarryforward,
  SPT1771TaxCredits,
  SPT1771Attachments,
} from '@/lib/tax/spt-1771/types';
import type { FiscalAdjustmentInput } from '@/lib/tax/spt-1771/fiscal-adjustment';
import {
  calculateSPT1771,
  validateSPT1771,
  calculateIncomeStatementTotals,
  generateSPT1771PDFBuffer,
} from '@/lib/tax/spt-1771';

/**
 * Request body for SPT 1771 generation
 */
interface SPT1771Request {
  customerId: string;
  taxYear: number;
  fiscalYear: FiscalYearPeriod;
  correctionNumber?: number;
  format?: 'json' | 'pdf';

  // Company identity (optional - will be fetched from customer if not provided)
  company?: Partial<CorporateIdentity>;

  // Financial statements
  incomeStatement: Partial<CorporateIncomeStatement>;
  balanceSheet: CorporateBalanceSheet;

  // Fiscal adjustments (optional - auto-calculated if not provided)
  fiscalAdjustments?: FiscalAdjustmentInput;

  // Loss carryforward
  lossCarryforward?: SPT1771LossCarryforward[];

  // Tax credits
  taxCredits?: Partial<SPT1771TaxCredits>;

  // Related party transactions
  relatedPartyTransactions?: RelatedPartyTransaction[];

  // Attachments
  attachments?: SPT1771Attachments;
}

/**
 * POST /api/tax/spt/1771
 *
 * Generate SPT 1771 for corporate taxpayers
 *
 * For:
 * - PT (Perseroan Terbatas)
 * - CV (Commanditaire Vennootschap)
 * - Firma
 * - Koperasi
 * - Yayasan
 * - Other corporate entities
 */
async function handleGenerateSPT(req: RequestWithSession): Promise<Response> {
  try {
    const body: SPT1771Request = await req.json();
    const {
      customerId,
      taxYear,
      fiscalYear,
      correctionNumber = 0,
      format = 'json',
      company: companyInput,
      incomeStatement: incomeStatementInput,
      balanceSheet,
      fiscalAdjustments,
      lossCarryforward = [],
      taxCredits,
      relatedPartyTransactions = [],
      attachments,
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

    if (!fiscalYear || !fiscalYear.startDate || !fiscalYear.endDate) {
      return NextResponse.json(
        {
          error: 'fiscalYear is required',
          expected: {
            startDate: 'YYYY-MM-DD',
            endDate: 'YYYY-MM-DD',
            isCalendarYear: true,
          },
        },
        { status: 400 }
      );
    }

    if (!incomeStatementInput) {
      return NextResponse.json(
        { error: 'incomeStatement is required' },
        { status: 400 }
      );
    }

    if (!balanceSheet) {
      return NextResponse.json(
        { error: 'balanceSheet is required' },
        { status: 400 }
      );
    }

    // Fetch customer data
    const { data: customer, error: customerError } = await getSupabaseAdmin()
      .from('customer')
      .select(
        'id, user_id, full_name, company_name, npwp, address, phone, email, customer_type'
      )
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      console.error('Customer fetch error:', customerError);
      return NextResponse.json(
        { error: 'Customer not found', details: customerError?.message },
        { status: 404 }
      );
    }

    // Validate customer is corporate (COMPANY type in DB)
    if (customer.customer_type !== 'COMPANY') {
      return NextResponse.json(
        {
          error: 'Customer is not a corporate entity',
          message:
            'SPT 1771 is for corporate taxpayers. Use /api/tax/spt/1770 for individual with business income.',
        },
        { status: 400 }
      );
    }

    // Build company identity
    const company: CorporateIdentity = {
      npwp: customer.npwp || '',
      companyName: customer.company_name || customer.full_name || '',
      legalName: companyInput?.legalName || customer.company_name || '',
      entityType: companyInput?.entityType || 'PT',
      registrationNumber: companyInput?.registrationNumber || '',
      address: customer.address || '',
      city: companyInput?.city || '',
      kluCode: companyInput?.kluCode || '',
      businessDescription: companyInput?.businessDescription || '',
      fiscalYearEnd: companyInput?.fiscalYearEnd || '12-31',
      isAuditRequired: companyInput?.isAuditRequired || false,
      auditorName: companyInput?.auditorName,
      auditorLicense: companyInput?.auditorLicense,
    };

    // Calculate totals for income statement
    const incomeStatement = calculateIncomeStatementTotals(incomeStatementInput);

    // Get loss carryforward from previous years if not provided
    const effectiveLossCarryforward = lossCarryforward;

    if (effectiveLossCarryforward.length === 0) {
      const { data: previousFilings } = await getSupabaseAdmin()
        .from('tax_filing')
        .select('tax_year, tax_data')
        .eq('customer_id', customerId)
        .eq('tax_type', 'SPT_1771')
        .lt('tax_year', taxYear)
        .gte('tax_year', taxYear - 10) // 10 year carryforward for corporate
        .order('tax_year', { ascending: true });

      if (previousFilings) {
        for (const filing of previousFilings) {
          const taxData = filing.tax_data as {
            summary?: { currentYearLoss?: number };
          };
          if (
            taxData?.summary?.currentYearLoss &&
            taxData.summary.currentYearLoss > 0
          ) {
            // Check if this loss has extended carryforward period
            const baseExpiryYear = filing.tax_year + 5;
            const extendedExpiryYear = filing.tax_year + 10;

            effectiveLossCarryforward.push({
              taxYear: filing.tax_year,
              originalLoss: taxData.summary.currentYearLoss,
              previouslyCompensated: 0,
              compensatedThisYear: 0,
              remainingLoss: taxData.summary.currentYearLoss,
              expiryYear: baseExpiryYear,
              isExpired: taxYear > baseExpiryYear,
              hasExtendedPeriod: false,
              extendedExpiryYear: extendedExpiryYear,
            });
          }
        }
      }
    }

    // Calculate SPT 1771
    const sptData = calculateSPT1771({
      company,
      taxYear,
      fiscalYear,
      correctionNumber,
      submissionDate: new Date(),
      incomeStatement,
      balanceSheet,
      fiscalAdjustments,
      lossCarryforward: effectiveLossCarryforward,
      taxCredits,
      relatedPartyTransactions,
      attachments,
    });

    // Validate
    const validation = validateSPT1771(sptData);

    if (format === 'pdf') {
      try {
        const showWatermark = validation.errors.length > 0;
        const pdfBuffer = await generateSPT1771PDFBuffer(sptData, showWatermark);

        // Convert Buffer to Uint8Array for NextResponse compatibility
        const uint8Array = new Uint8Array(pdfBuffer);

        return new NextResponse(uint8Array, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="SPT-1771-${company.npwp}-${taxYear}.pdf"`,
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
        formType: 'SPT_1771',
        grossRevenue: incomeStatement.grossRevenue,
        qualifiesForSME: incomeStatement.grossRevenue < 50_000_000_000,
        canUseUMKMFinalTax: incomeStatement.grossRevenue < 4_800_000_000,
      },
    });
  } catch (error) {
    console.error('SPT 1771 generation error:', error);
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
 * GET /api/tax/spt/1771?customerId=xxx&taxYear=2024
 *
 * Get existing SPT 1771 data
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

  // Validate customer is corporate
  const { data: customer, error: customerError } = await getSupabaseAdmin()
    .from('customer')
    .select('id, customer_type')
    .eq('id', customerId)
    .single();

  if (customerError || !customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  if (customer.customer_type !== 'COMPANY') {
    return NextResponse.json(
      {
        error: 'Customer is not a corporate entity',
        message: 'SPT 1771 is for corporate taxpayers.',
      },
      { status: 400 }
    );
  }

  // Check for existing saved SPT
  const { data: existingSPT, error: sptError } = await getSupabaseAdmin()
    .from('tax_filing')
    .select('*')
    .eq('customer_id', customerId)
    .eq('tax_type', 'SPT_1771')
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

  // Check for loss carryforward from previous years (10 year period)
  const { data: previousLosses } = await getSupabaseAdmin()
    .from('tax_filing')
    .select('tax_year, tax_data')
    .eq('customer_id', customerId)
    .eq('tax_type', 'SPT_1771')
    .lt('tax_year', parseInt(taxYear))
    .gte('tax_year', parseInt(taxYear) - 10)
    .order('tax_year', { ascending: true });

  const availableLossCarryforward: SPT1771LossCarryforward[] = [];

  if (previousLosses) {
    for (const filing of previousLosses) {
      const taxData = filing.tax_data as {
        summary?: { currentYearLoss?: number };
      };
      if (
        taxData?.summary?.currentYearLoss &&
        taxData.summary.currentYearLoss > 0
      ) {
        const baseExpiryYear = filing.tax_year + 5;
        availableLossCarryforward.push({
          taxYear: filing.tax_year,
          originalLoss: taxData.summary.currentYearLoss,
          previouslyCompensated: 0,
          compensatedThisYear: 0,
          remainingLoss: taxData.summary.currentYearLoss,
          expiryYear: baseExpiryYear,
          isExpired: parseInt(taxYear) > baseExpiryYear,
          hasExtendedPeriod: false,
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
