import { NextRequest } from 'next/server';
import { customerOperation } from '@/middleware/compose';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { InvoiceClassifier } from '@/lib/ai/invoice-classifier';
import { TaxResolutionEngine } from '@/lib/tax/tax-resolution-engine';
import { loggers } from '@/lib/logger';
import { captureApiError } from '@/lib/sentry';
import type { RequestWithSession } from '@/types/auth';
import type { ServiceCategory, RecipientType } from '@/types';

/**
 * POST /api/customer/invoice-classify
 *
 * Customer uploads invoice photo → AI classifies → tax resolution → saves to tax_calculation
 */
async function handleClassify(req: RequestWithSession): Promise<Response> {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const taxPeriod = formData.get('taxPeriod') as string | null;

    if (!file) {
      return Response.json({ error: 'File is required' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return Response.json({ error: 'Unsupported file type. Use JPEG, PNG, WebP, or PDF.' }, { status: 400 });
    }

    // 10MB limit
    if (file.size > 10 * 1024 * 1024) {
      return Response.json({ error: 'File size must be under 10MB' }, { status: 400 });
    }

    const userId = req.session.userId;
    const admin = getSupabaseAdmin();

    // Get customer record
    const { data: customer } = await admin
      .from('customer')
      .select('id, full_name, npwp')
      .eq('user_id', userId)
      .single();

    if (!customer) {
      return Response.json({ error: 'Customer record not found' }, { status: 404 });
    }

    // Convert file to base64
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    // Step 1: AI Invoice Classification
    const classification = await InvoiceClassifier.classify(base64, file.type);

    // Step 2: Tax Resolution
    const serviceCategory = (classification.serviceCategory || 'SERVICE') as ServiceCategory;
    const recipientType: RecipientType = 'RESIDENT';

    const resolution = TaxResolutionEngine.resolve({
      grossAmount: classification.grossAmount,
      transactionDate: classification.invoiceDate || new Date().toISOString().split('T')[0],
      description: classification.description,
      serviceCategory,
      recipientType,
      recipientNpwp: classification.counterpartyNpwp,
    });

    // Step 3: Determine tax period
    const invoiceDate = classification.invoiceDate || new Date().toISOString().split('T')[0];
    const period = taxPeriod || invoiceDate.substring(0, 7); // YYYY-MM
    const taxYear = parseInt(period.split('-')[0]);

    // Map resolved tax type to DB enum
    const taxTypeMap: Record<string, string> = {
      PPh21: 'PPh21',
      PPh23: 'PPh23',
      PPh26: 'PPh26',
      PPh4_2: 'PPh_FINAL',
      PPh22: 'PPh22',
      PPh15: 'PPh15',
      PPN: 'PPN',
    };
    const dbTaxType = taxTypeMap[resolution.taxType] || 'PPh23';

    // Step 4: Save to tax_calculation
    const incomeData = {
      recipient_name: classification.counterpartyName,
      recipient_npwp: classification.counterpartyNpwp || null,
      gross_amount: classification.grossAmount,
      ppn_amount: classification.ppnAmount || null,
      invoice_number: classification.invoiceNumber || null,
      invoice_date: classification.invoiceDate || null,
      description: classification.description,
      service_category: classification.serviceCategory,
      service_code: classification.serviceCode || null,
    };

    const calculationResult = {
      grossIncome: classification.grossAmount,
      calculatedTax: resolution.taxAmount,
      taxRate: resolution.rate,
      taxType: resolution.taxType,
      netAmount: resolution.netAmount,
      isFinal: resolution.isFinal,
      reason: resolution.reason,
      legalBasis: resolution.legalBasis,
    };

    const { data: saved, error: insertError } = await admin
      .from('tax_calculation')
      .insert({
        customer_id: customer.id,
        consultant_id: null,
        tax_type: dbTaxType,
        tax_period: period,
        tax_year: taxYear,
        income_data: incomeData,
        calculation_result: calculationResult,
        calculated_by_user_id: userId,
        source: 'CUSTOMER_OCR',
        invoice_classification: { classification, resolution },
      })
      .select('id')
      .single();

    if (insertError) {
      loggers.api.error({ err: insertError }, 'Failed to save tax calculation');
      return Response.json({ error: 'Failed to save calculation' }, { status: 500 });
    }

    loggers.api.info({ userId, customerId: customer.id, taxType: dbTaxType, period }, 'Invoice classified and saved');

    return Response.json({
      success: true,
      data: {
        calculationId: saved.id,
        classification,
        resolution: {
          taxType: resolution.taxType,
          rate: resolution.rate,
          taxAmount: resolution.taxAmount,
          netAmount: resolution.netAmount,
          isFinal: resolution.isFinal,
          reason: resolution.reason,
          legalBasis: resolution.legalBasis,
        },
        period,
        taxYear,
      },
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Invoice classify error');
    captureApiError(error instanceof Error ? error : new Error(String(error)), { route: '/api/customer/invoice-classify', method: 'POST', userId: req.session?.userId });
    return Response.json({ error: 'Invoice classification failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return customerOperation('INVOICE_CLASSIFY')(request as RequestWithSession, handleClassify);
}
