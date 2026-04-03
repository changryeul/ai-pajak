/**
 * DJP Job Status API
 *
 * GET /api/djp/status/[jobId]
 *
 * Returns the status of a DJP job (e-Filing, e-Billing, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDJPJobStatus, retryDJPJob, cancelDJPJob } from '@/lib/djp/queue';
import { loggers } from '@/lib/logger';

interface RouteContext {
  params: Promise<{ jobId: string }>;
}

/**
 * GET /api/djp/status/[jobId]
 *
 * Get DJP job status
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { jobId } = await context.params;

    // Validate jobId format (UUID)
    if (!jobId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid job ID format' },
        { status: 400 }
      );
    }

    // Check authentication
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get job status
    const status = await getDJPJobStatus(jobId);

    if (!status) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        jobId: status.jobId,
        status: status.status,
        progress: status.progress,
        result: status.result,
        error: status.error,
        startedAt: status.startedAt?.toISOString(),
        completedAt: status.completedAt?.toISOString(),
      },
    });
  } catch (error) {
    loggers.djp.error({ err: error }, 'DJP status API error');
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get job status',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/djp/status/[jobId]
 *
 * Retry or cancel a DJP job
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { jobId } = await context.params;

    // Validate jobId format
    if (!jobId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid job ID format' },
        { status: 400 }
      );
    }

    // Check authentication
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get action from request body
    const body = await request.json().catch(() => ({}));
    const action = body.action as 'retry' | 'cancel' | undefined;

    if (!action || !['retry', 'cancel'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Use "retry" or "cancel"' },
        { status: 400 }
      );
    }

    let result: boolean;

    if (action === 'retry') {
      result = await retryDJPJob(jobId);
      if (!result) {
        return NextResponse.json(
          { success: false, error: 'Cannot retry job. Job must be in FAILED status.' },
          { status: 400 }
        );
      }
    } else {
      result = await cancelDJPJob(jobId);
      if (!result) {
        return NextResponse.json(
          { success: false, error: 'Cannot cancel job. Job must be in PENDING status.' },
          { status: 400 }
        );
      }
    }

    // Get updated status
    const status = await getDJPJobStatus(jobId);

    return NextResponse.json({
      success: true,
      message: action === 'retry' ? 'Job queued for retry' : 'Job cancelled',
      data: status,
    });
  } catch (error) {
    loggers.djp.error({ err: error }, 'DJP status API error');
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process action',
      },
      { status: 500 }
    );
  }
}
