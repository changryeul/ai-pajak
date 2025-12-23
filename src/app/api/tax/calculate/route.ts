import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { RequestWithSession } from '@/types/auth';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireRole } from '@/middleware/rbac';
import { withAudit } from '@/middleware/audit';
import { UserRole } from '@/types/auth';
import { PPhFinalCalculator, EntityType, IncomeType } from '@/lib/tax';

/**
 * Tax Calculation Endpoint
 *
 * HARD RULES ENFORCED:
 * 1. CONSULTANT_JTC and TAX_ADVISOR_JTC can calculate taxes
 * 2. PLATFORM_ADMIN is blocked from accessing tax data
 * 3. All calculations are audit logged
 * 4. Calculation does NOT submit to DJP (read-only operation)
 *
 * This endpoint performs tax calculations for customers.
 * It does NOT submit filings - only TAX_ADVISOR_JTC can submit via /api/tax/file.
 *
 * CACHING POLICY:
 * - Calculation results are DRAFT data (임시 데이터)
 * - Saved to database for consultant reference
 * - NOT audit trail material (제출 아님)
 * - Can be recalculated/updated freely before filing submission
 * - Only tax FILING submission triggers audit log
 * - Calculations are lightweight audit (activity tracking only)
 *
 * @route POST /api/tax/calculate
 */

interface TaxCalculationRequest {
  customerId: string;
  taxType: 'PPh21' | 'PPh23' | 'PPh_FINAL' | 'PPN' | 'SPT_MASA' | 'SPT_TAHUNAN';
  taxPeriod: string;
  taxYear: number;
  incomeData: {
    grossIncome: number;
    otherIncome?: number;
    totalIncome?: number;
  };
  deductions?: {
    personalDeduction?: number;
    dependentDeduction?: number;
    otherDeductions?: number;
    totalDeductions?: number;
  };
  credits?: {
    withholdingTax?: number;
    foreignTaxCredit?: number;
    otherCredits?: number;
    totalCredits?: number;
  };
  // PPh Final specific params
  pphFinalParams?: {
    scheme: 'UMKM' | 'PASAL42';
    // UMKM params
    businessStartDate?: string;
    entityType?: EntityType;
    kluCode?: string;
    // Pasal 4(2) params
    incomeType?: IncomeType;
  };
}

interface TaxCalculationResponse {
  success: boolean;
  calculationId: string;
  customer: {
    customerId: string;
    customerName: string;
    npwp: string;
  };
  tax: {
    taxType: string;
    taxPeriod: string;
    taxYear: number;
  };
  calculation: {
    grossIncome: number;
    totalDeductions: number;
    taxableIncome: number;
    calculatedTax: number;
    totalCredits: number;
    netTaxDue: number;
    effectiveRate: number;
  };
  breakdown: {
    incomeBreakdown: any;
    deductionBreakdown: any;
    creditBreakdown: any;
    taxBrackets?: any[];
  };
  calculatedAt: string;
  calculatedBy: {
    userId: string;
    consultantId: string;
    consultantName: string;
  };
}

async function handler(request: RequestWithSession): Promise<Response> {
  const { session } = request;

  // Parse request body
  const body = (await request.json()) as TaxCalculationRequest;

  const {
    customerId,
    taxType,
    taxPeriod,
    taxYear,
    incomeData,
    deductions = {},
    credits = {},
    pphFinalParams,
  } = body;

  // Validation
  if (!customerId || !taxType || !taxPeriod || !taxYear || !incomeData) {
    return NextResponse.json(
      {
        error: 'Missing required fields',
        requiredFields: [
          'customerId',
          'taxType',
          'taxPeriod',
          'taxYear',
          'incomeData',
        ],
      },
      { status: 400 }
    );
  }

  if (!incomeData.grossIncome || incomeData.grossIncome < 0) {
    return NextResponse.json(
      {
        error: 'Invalid income data',
        message: 'grossIncome must be a positive number',
      },
      { status: 400 }
    );
  }

  // Get Supabase client
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  // Get consultant information
  const { data: consultant, error: consultantError } = await supabase
    .from('consultant')
    .select(
      `
      id,
      user_id,
      full_name,
      tax_partner_id
    `
    )
    .eq('user_id', session.userId)
    .eq('is_active', true)
    .single();

  if (consultantError || !consultant) {
    return NextResponse.json(
      {
        error: 'Consultant not found',
        message: 'Active consultant record not found for this user',
      },
      { status: 404 }
    );
  }

  // Verify consultant can access this customer
  const { data: assignment, error: assignmentError } = await supabase
    .from('customer_consultant')
    .select('id')
    .eq('customer_id', customerId)
    .eq('consultant_id', consultant.id)
    .eq('is_active', true)
    .single();

  if (assignmentError || !assignment) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
        message: 'You are not assigned to this customer',
        customerId,
      },
      { status: 403 }
    );
  }

  // Get customer information
  const { data: customer, error: customerError } = await supabase
    .from('customer')
    .select('id, full_name, company_name, npwp, customer_type')
    .eq('id', customerId)
    .single();

  if (customerError || !customer) {
    return NextResponse.json(
      {
        error: 'Customer not found',
        customerId,
      },
      { status: 404 }
    );
  }

  // Calculate total income
  const totalIncome =
    incomeData.grossIncome + (incomeData.otherIncome || 0);

  // Calculate total deductions
  const totalDeductions =
    (deductions.personalDeduction || 0) +
    (deductions.dependentDeduction || 0) +
    (deductions.otherDeductions || 0);

  // Calculate taxable income
  const taxableIncome = Math.max(0, totalIncome - totalDeductions);

  // Calculate tax based on type
  let calculatedTax = 0;
  let taxBrackets: any[] = [];

  if (taxType === 'PPh21') {
    // Progressive tax brackets for PPh21 (Indonesian personal income tax)
    // Simplified calculation - production should use actual DJP brackets
    if (taxableIncome <= 60_000_000) {
      calculatedTax = taxableIncome * 0.05;
      taxBrackets.push({
        bracket: '0 - 60M',
        rate: 0.05,
        amount: taxableIncome,
        tax: calculatedTax,
      });
    } else if (taxableIncome <= 250_000_000) {
      const bracket1 = 60_000_000 * 0.05;
      const bracket2 = (taxableIncome - 60_000_000) * 0.15;
      calculatedTax = bracket1 + bracket2;
      taxBrackets = [
        { bracket: '0 - 60M', rate: 0.05, amount: 60_000_000, tax: bracket1 },
        {
          bracket: '60M - 250M',
          rate: 0.15,
          amount: taxableIncome - 60_000_000,
          tax: bracket2,
        },
      ];
    } else if (taxableIncome <= 500_000_000) {
      const bracket1 = 60_000_000 * 0.05;
      const bracket2 = 190_000_000 * 0.15;
      const bracket3 = (taxableIncome - 250_000_000) * 0.25;
      calculatedTax = bracket1 + bracket2 + bracket3;
      taxBrackets = [
        { bracket: '0 - 60M', rate: 0.05, amount: 60_000_000, tax: bracket1 },
        {
          bracket: '60M - 250M',
          rate: 0.15,
          amount: 190_000_000,
          tax: bracket2,
        },
        {
          bracket: '250M - 500M',
          rate: 0.25,
          amount: taxableIncome - 250_000_000,
          tax: bracket3,
        },
      ];
    } else {
      const bracket1 = 60_000_000 * 0.05;
      const bracket2 = 190_000_000 * 0.15;
      const bracket3 = 250_000_000 * 0.25;
      const bracket4 = (taxableIncome - 500_000_000) * 0.3;
      calculatedTax = bracket1 + bracket2 + bracket3 + bracket4;
      taxBrackets = [
        { bracket: '0 - 60M', rate: 0.05, amount: 60_000_000, tax: bracket1 },
        {
          bracket: '60M - 250M',
          rate: 0.15,
          amount: 190_000_000,
          tax: bracket2,
        },
        {
          bracket: '250M - 500M',
          rate: 0.25,
          amount: 250_000_000,
          tax: bracket3,
        },
        {
          bracket: '> 500M',
          rate: 0.3,
          amount: taxableIncome - 500_000_000,
          tax: bracket4,
        },
      ];
    }
  } else if (taxType === 'PPh23') {
    // Flat rate for PPh23 (withholding tax on services)
    calculatedTax = taxableIncome * 0.02;
    taxBrackets.push({
      bracket: 'All income',
      rate: 0.02,
      amount: taxableIncome,
      tax: calculatedTax,
    });
  } else if (taxType === 'PPN') {
    // VAT rate
    calculatedTax = taxableIncome * 0.11;
    taxBrackets.push({
      bracket: 'All income',
      rate: 0.11,
      amount: taxableIncome,
      tax: calculatedTax,
    });
  } else if (taxType === 'PPh_FINAL') {
    // PPh Final calculation (PP 23/2018 UMKM or Pasal 4(2))
    if (!pphFinalParams || !pphFinalParams.scheme) {
      return NextResponse.json(
        {
          error: 'Missing PPh Final parameters',
          message: 'pphFinalParams.scheme is required (UMKM or PASAL42)',
        },
        { status: 400 }
      );
    }

    try {
      if (pphFinalParams.scheme === 'UMKM') {
        // Validate UMKM params
        if (!pphFinalParams.businessStartDate || !pphFinalParams.entityType || !pphFinalParams.kluCode) {
          return NextResponse.json(
            {
              error: 'Missing UMKM parameters',
              message: 'businessStartDate, entityType, and kluCode are required for UMKM scheme',
            },
            { status: 400 }
          );
        }

        const umkmResult = await PPhFinalCalculator.calculateUMKM({
          revenue: incomeData.grossIncome,
          businessStartDate: new Date(pphFinalParams.businessStartDate),
          entityType: pphFinalParams.entityType,
          kluCode: pphFinalParams.kluCode,
        });

        calculatedTax = umkmResult.tax_amount;
        taxBrackets.push({
          bracket: umkmResult.is_tax_exempt ? 'Exempt (< Rp 500M)' : 'UMKM 0.5%',
          rate: umkmResult.tax_rate,
          amount: umkmResult.base_amount,
          tax: umkmResult.tax_amount,
          legal_basis: umkmResult.legal_basis,
          details: umkmResult.details,
        });
      } else if (pphFinalParams.scheme === 'PASAL42') {
        // Validate Pasal 4(2) params
        if (!pphFinalParams.incomeType) {
          return NextResponse.json(
            {
              error: 'Missing Pasal 4(2) parameters',
              message: 'incomeType is required for PASAL42 scheme',
            },
            { status: 400 }
          );
        }

        const pasal42Result = PPhFinalCalculator.calculatePasal42({
          incomeType: pphFinalParams.incomeType,
          grossAmount: incomeData.grossIncome,
        });

        calculatedTax = pasal42Result.tax_amount;
        taxBrackets.push({
          bracket: `Pasal 4(2) - ${pphFinalParams.incomeType}`,
          rate: pasal42Result.tax_rate,
          amount: pasal42Result.base_amount,
          tax: pasal42Result.tax_amount,
          legal_basis: pasal42Result.legal_basis,
          details: pasal42Result.details,
        });
      }
    } catch (error: any) {
      return NextResponse.json(
        {
          error: 'PPh Final calculation error',
          message: error.message,
          code: error.code,
          details: error.details,
        },
        { status: 400 }
      );
    }
  } else {
    // Default calculation for other tax types
    calculatedTax = taxableIncome * 0.05;
  }

  // Calculate total credits
  const totalCredits =
    (credits.withholdingTax || 0) +
    (credits.foreignTaxCredit || 0) +
    (credits.otherCredits || 0);

  // Calculate net tax due
  const netTaxDue = Math.max(0, calculatedTax - totalCredits);

  // Calculate effective rate
  const effectiveRate = totalIncome > 0 ? (netTaxDue / totalIncome) * 100 : 0;

  // Save calculation to database
  const { data: calculation, error: calcError } = await supabase
    .from('tax_calculation')
    .insert({
      customer_id: customerId,
      consultant_id: consultant.id,
      tax_type: taxType,
      tax_period: taxPeriod,
      tax_year: taxYear,
      income_data: incomeData,
      deduction_data: deductions,
      credit_data: credits,
      calculation_result: {
        grossIncome: incomeData.grossIncome,
        totalIncome,
        totalDeductions,
        taxableIncome,
        calculatedTax,
        totalCredits,
        netTaxDue,
        effectiveRate,
        taxBrackets,
      },
      calculated_by_user_id: session.userId,
    })
    .select('id, created_at')
    .single();

  if (calcError) {
    console.error('[TAX_CALC] Failed to save calculation', {
      error: calcError,
      customerId,
      taxType,
    });
  }

  // Create audit log
  await supabase.from('audit_log').insert({
    customer_id: customerId,
    actor_user_id: session.userId,
    actor_organization_id: consultant.tax_partner_id,
    actor_role: session.role,
    activity_type: 'TAX_CALCULATION',
    tax_type: taxType,
    tax_period: taxPeriod,
    activity_details: {
      calculationId: calculation?.id,
      netTaxDue,
      taxableIncome,
    },
    ip_address: request.headers.get('x-forwarded-for') || 'unknown',
    user_agent: request.headers.get('user-agent') || 'unknown',
  });

  console.info('[TAX_CALC] Tax calculation completed', {
    calculationId: calculation?.id,
    customerId,
    taxType,
    netTaxDue,
    consultantId: consultant.id,
  });

  // Prepare response
  const response: TaxCalculationResponse = {
    success: true,
    calculationId: calculation?.id || '',
    customer: {
      customerId: customer.id,
      customerName:
        customer.customer_type === 'INDIVIDUAL'
          ? customer.full_name!
          : customer.company_name!,
      npwp: customer.npwp,
    },
    tax: {
      taxType,
      taxPeriod,
      taxYear,
    },
    calculation: {
      grossIncome: incomeData.grossIncome,
      totalDeductions,
      taxableIncome,
      calculatedTax,
      totalCredits,
      netTaxDue,
      effectiveRate: parseFloat(effectiveRate.toFixed(2)),
    },
    breakdown: {
      incomeBreakdown: {
        grossIncome: incomeData.grossIncome,
        otherIncome: incomeData.otherIncome || 0,
        totalIncome,
      },
      deductionBreakdown: {
        personalDeduction: deductions.personalDeduction || 0,
        dependentDeduction: deductions.dependentDeduction || 0,
        otherDeductions: deductions.otherDeductions || 0,
        totalDeductions,
      },
      creditBreakdown: {
        withholdingTax: credits.withholdingTax || 0,
        foreignTaxCredit: credits.foreignTaxCredit || 0,
        otherCredits: credits.otherCredits || 0,
        totalCredits,
      },
      taxBrackets:
        taxBrackets.length > 0 ? taxBrackets : undefined,
    },
    calculatedAt: calculation?.created_at || new Date().toISOString(),
    calculatedBy: {
      userId: session.userId,
      consultantId: consultant.id,
      consultantName: consultant.full_name,
    },
  };

  return NextResponse.json(response);
}

/**
 * POST /api/tax/calculate
 *
 * Calculate tax for customer
 *
 * MIDDLEWARE STACK (4 layers):
 * 1. requireAuth - Must be logged in
 * 2. blockPlatformAdmin - Platform admin blocked (Hard Rule #1)
 * 3. requireRole - CONSULTANT_JTC or TAX_ADVISOR_JTC allowed
 * 4. withAudit - Audit trail created (Hard Rule #5)
 *
 * Note: No POA validation required for calculation (read-only operation)
 * POA is only required for actual tax filing submission
 */
export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(UserRole.CONSULTANT_JTC, UserRole.TAX_ADVISOR_JTC),
    withAudit('TAX_CALCULATION')
  )(request as RequestWithSession, handler);
}
