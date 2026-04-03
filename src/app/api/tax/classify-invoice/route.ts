import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import type { RequestWithSession } from '@/types/auth';
import { InvoiceClassifier } from '@/lib/ai/invoice-classifier';
import { TaxResolutionEngine } from '@/lib/tax/tax-resolution-engine';
import type { ServiceCategory } from '@/types';

/**
 * POST /api/tax/classify-invoice
 *
 * Analyzes an invoice image using AI and returns:
 * - Extracted data (service type, amount, counterparty)
 * - Tax resolution (PPh type + rate)
 */
async function handlePost(req: RequestWithSession): Promise<Response> {
  const body = await req.json();
  const { imageBase64, mimeType } = body;

  if (!imageBase64) {
    return NextResponse.json({ error: 'imageBase64 required' }, { status: 400 });
  }

  try {
    // Step 1: AI classification
    const classification = await InvoiceClassifier.classify(
      imageBase64,
      mimeType || 'image/jpeg'
    );

    // Step 2: Tax resolution (if amount is available)
    let resolution = null;
    if (classification.grossAmount > 0) {
      resolution = TaxResolutionEngine.resolve({
        grossAmount: classification.grossAmount,
        transactionDate: classification.invoiceDate || new Date().toISOString().slice(0, 10),
        serviceCategory: (classification.serviceCategory || 'SERVICE') as ServiceCategory,
        recipientType: 'RESIDENT',
        recipientNpwp: classification.counterpartyNpwp,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        classification,
        resolution: resolution ? {
          taxType: resolution.taxType,
          rate: resolution.rate,
          taxAmount: resolution.taxAmount,
          reason: resolution.reason,
        } : null,
      },
    });
  } catch (err) {
    return NextResponse.json({
      error: 'Classification failed',
      message: err instanceof Error ? err.message : 'Unknown error',
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return composeMiddleware(requireAuth, blockPlatformAdmin)(request as RequestWithSession, handlePost);
}
