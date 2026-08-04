import { loggers } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import type { RequestWithSession } from '@/types/auth';
import { validateFiling, type FilingValidationInput } from '@/lib/ai/filing-validator';

/**
 * POST /api/tax/validate
 *
 * Validate SPT data before submission
 */
async function handleValidate(req: RequestWithSession): Promise<Response> {
  try {
    const body = await req.json() as FilingValidationInput;

    if (!body.sptType || !body.taxYear || !body.ptkpStatus || !body.summary) {
      return NextResponse.json(
        { error: 'sptType, taxYear, ptkpStatus, and summary are required' },
        { status: 400 }
      );
    }

    const result = await validateFiling(body);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    loggers.tax.error({ err: error }, 'Validation error');
    return NextResponse.json(
      { error: 'Validation failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin
  )(request as RequestWithSession, handleValidate);
}
