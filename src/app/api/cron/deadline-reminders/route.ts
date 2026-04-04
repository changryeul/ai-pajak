/**
 * Deadline Reminders Cron Endpoint
 *
 * This endpoint should be called daily by a cron job (e.g., Vercel Cron)
 * to check for upcoming tax deadlines and send notifications.
 *
 * POST /api/cron/deadline-reminders
 *
 * Security:
 * - Requires CRON_SECRET header for authentication
 * - Should only be accessible via internal cron job
 */

import { NextRequest, NextResponse } from 'next/server';
import { runDeadlineReminders } from '@/lib/notifications/deadline-reminder';
import { isCronEnabled, logCronResult } from '@/lib/cron/cron-guard';
import { loggers } from '@/lib/logger';

const CRON_SECRET = process.env.CRON_SECRET;
const CRON_ID = 'deadline-reminders';

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = authHeader?.replace('Bearer ', '');

  if (!CRON_SECRET) {
    loggers.api.warn('CRON_SECRET not configured');
    return NextResponse.json(
      { error: 'Cron not configured' },
      { status: 503 }
    );
  }

  if (cronSecret !== CRON_SECRET) {
    loggers.api.warn('Unauthorized cron request');
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const enabled = await isCronEnabled(CRON_ID);
    if (!enabled) {
      await logCronResult(CRON_ID, 'skipped', 0, { reason: 'disabled' });
      return NextResponse.json({ success: true, skipped: true, reason: 'Cron job is disabled' });
    }

    loggers.api.info('Starting deadline reminders job');
    const startTime = Date.now();

    const { success, result } = await runDeadlineReminders();

    const duration = Date.now() - startTime;

    loggers.api.info({
      success,
      duration: `${duration}ms`,
      processed: result.processed,
      sent: result.notificationsSent,
      errors: result.errors.length,
    }, 'Deadline reminders completed');

    return NextResponse.json({
      success,
      duration: `${duration}ms`,
      processed: result.processed,
      notificationsSent: result.notificationsSent,
      errors: result.errors,
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Deadline reminders failed');
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for health check / manual trigger (requires admin)
 */
export async function GET(_request: NextRequest) {
  // For health check, just return status
  return NextResponse.json({
    status: 'ok',
    endpoint: 'deadline-reminders',
    configured: !!CRON_SECRET,
    message: 'Use POST with CRON_SECRET to trigger reminders',
  });
}
