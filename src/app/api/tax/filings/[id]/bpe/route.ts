/**
 * BPE (Bukti Penerimaan Elektronik) Download API
 *
 * GET /api/tax/filings/[id]/bpe
 *
 * Generates and returns the BPE PDF document for a tax filing.
 * The BPE is the official electronic receipt issued by DJP when a tax
 * filing is accepted.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { renderToBuffer } from '@react-pdf/renderer';
import { BPEPDF } from '@/lib/tax/bpe/pdf-generator';
import { BPEData, TaxType, FilingType } from '@/lib/tax/bpe/types';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { requireRole } from '@/middleware/rbac';
import { withAudit } from '@/middleware/audit';
import type { RequestWithSession, UserRole } from '@/types/auth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface TaxFilingWithRelations {
  id: string;
  bpe_number: string | null;
  filed_at: string | null;
  tax_type: string;
  tax_period: string;
  tax_data: Record<string, unknown>;
  status: string;
  customer_id: string;
  consultant_id: string;
  customer: {
    id: string;
    full_name: string;
    company_name: string | null;
    npwp: string | null;
    address: string | null;
  } | null;
  consultant: {
    id: string;
    full_name: string;
    tax_partner_id: string;
    tax_partner: {
      id: string;
      name: string;
      npwp: string;
      tax_license_number: string;
    } | null;
  } | null;
}

async function handleGetBPE(
  req: RequestWithSession,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await context.params;

  try {
    // Fetch the filing with customer and consultant info
    const { data: filing, error } = await supabaseAdmin
      .from('tax_filing')
      .select(`
        id,
        bpe_number,
        filed_at,
        tax_type,
        tax_period,
        tax_data,
        status,
        customer_id,
        consultant_id,
        customer:customer_id (
          id,
          full_name,
          company_name,
          npwp,
          address
        ),
        consultant:consultant_id (
          id,
          full_name,
          tax_partner_id,
          tax_partner:tax_partner_id (
            id,
            name,
            npwp,
            tax_license_number
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error || !filing) {
      return NextResponse.json(
        { success: false, error: 'Filing not found' },
        { status: 404 }
      );
    }

    const typedFiling = filing as unknown as TaxFilingWithRelations;

    // Check if BPE is available
    if (!typedFiling.bpe_number || !typedFiling.filed_at) {
      return NextResponse.json(
        { success: false, error: 'BPE not yet available. Filing must be submitted first.' },
        { status: 400 }
      );
    }

    // Check if status is acceptable for BPE
    if (typedFiling.status !== 'FILED') {
      return NextResponse.json(
        { success: false, error: 'BPE is only available for filed tax returns' },
        { status: 400 }
      );
    }

    // Role-based access check
    const { role, userId } = req.session;

    if (role === 'CUSTOMER') {
      const { data: customer } = await supabaseAdmin
        .from('customer')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (!customer || customer.id !== typedFiling.customer_id) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        );
      }
    } else if (role === 'CONSULTANT_JTC' || role === 'TAX_ADVISOR_JTC') {
      const { data: consultant } = await supabaseAdmin
        .from('consultant')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (!consultant || consultant.id !== typedFiling.consultant_id) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        );
      }
    }

    // Prepare BPE data
    const taxData = typedFiling.tax_data || {};
    const customer = typedFiling.customer;
    const consultant = typedFiling.consultant;
    const taxPartner = consultant?.tax_partner;

    // Parse tax year from tax_period (format: YYYY-MM or YYYY)
    const taxYear = parseInt(typedFiling.tax_period.split('-')[0], 10);

    const bpeData: BPEData = {
      filingId: typedFiling.id,
      bpeNumber: typedFiling.bpe_number,
      filedAt: new Date(typedFiling.filed_at),
      taxpayer: {
        name: customer?.full_name || 'Unknown',
        npwp: customer?.npwp || '-',
        address: customer?.address || undefined,
        companyName: customer?.company_name || undefined,
      },
      taxType: typedFiling.tax_type as TaxType,
      taxPeriod: typedFiling.tax_period,
      taxYear,
      taxSummary: {
        totalIncome: (taxData.totalIncome as number) || (taxData.total_income as number) || 0,
        totalDeductions: (taxData.totalDeductions as number) || (taxData.total_deductions as number) || 0,
        taxableIncome: (taxData.taxableIncome as number) || (taxData.taxable_income as number) || 0,
        taxDue: (taxData.taxDue as number) || (taxData.tax_due as number) || 0,
        taxPaid: (taxData.taxPaid as number) || (taxData.tax_paid as number) || 0,
        taxRefund: (taxData.taxRefund as number) || (taxData.tax_refund as number) || undefined,
        taxPayable: (taxData.taxPayable as number) || (taxData.tax_payable as number) || undefined,
      },
      submissionDetails: {
        submittedAt: new Date(typedFiling.filed_at),
        acceptedAt: new Date(typedFiling.filed_at),
        submissionChannel: 'AI Pajak - e-Filing',
        filingType: ((taxData.correctionNumber as number) || 0) > 0 ? 'CORRECTION' : 'REGULAR' as FilingType,
        correctionNumber: (taxData.correctionNumber as number) || 0,
      },
      taxPartner: taxPartner ? {
        name: taxPartner.name,
        npwp: taxPartner.npwp,
        licenseNumber: taxPartner.tax_license_number,
      } : undefined,
    };

    // Generate PDF
    const pdfElement = BPEPDF({ data: bpeData });
    const pdfBuffer = await renderToBuffer(pdfElement);

    // Convert Buffer to Uint8Array for Response compatibility
    const pdfBytes = new Uint8Array(pdfBuffer);

    // Return PDF as response
    const filename = `BPE_${typedFiling.bpe_number.replace(/[/\\:*?"<>|]/g, '_')}.pdf`;

    return new Response(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBytes.length.toString(),
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('[BPE API] Error generating BPE:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate BPE document' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Import blockPlatformAdmin middleware
  const { blockPlatformAdmin } = await import('@/middleware/blockPlatformAdmin');

  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin, // Block platform admin from accessing tax documents
    requireRole(
      'CUSTOMER' as UserRole,
      'CONSULTANT_JTC' as UserRole,
      'TAX_ADVISOR_JTC' as UserRole
    ),
    withAudit('BPE_DOWNLOAD')
  )(request as RequestWithSession, (req: RequestWithSession) => handleGetBPE(req, context));
}
