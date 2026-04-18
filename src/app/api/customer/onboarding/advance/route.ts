/**
 * POST /api/customer/onboarding/advance
 *
 * Advances customer.onboarding_step for INDIVIDUAL customers. Called after
 * each of the three onboarding screens (terms → mandate → done).
 *
 * Body: { toStep: 1 | 2 | 3 }
 *
 * Security:
 *   - requireAuth + requireRole(CUSTOMER) + withAudit (via customerOperation)
 *   - only allows monotonic advance (toStep > current) so a user cannot
 *     revert or skip forward.
 *   - onboarding_step lives on the `customer` row so the middleware redirect
 *     cannot be bypassed by editing JWT metadata (see TODOS.md T-003 rationale).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { requireRole } from '@/middleware/rbac';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import { UserRole, type RequestWithSession } from '@/types/auth';

const bodySchema = z.object({
  toStep: z.number().int().min(1).max(3),
});

async function handleAdvance(req: RequestWithSession): Promise<Response> {
  try {
    const body = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'invalid_body' }, { status: 400 });
    }
    const { toStep } = parsed.data;

    const { userId } = req.session;
    const admin = getSupabaseAdmin();

    const { data: customer, error: fetchErr } = await admin
      .from('customer')
      .select('id, customer_type, onboarding_step')
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchErr || !customer) {
      return NextResponse.json(
        { success: false, error: 'customer_not_found' },
        { status: 404 }
      );
    }

    if (customer.customer_type !== 'INDIVIDUAL') {
      return NextResponse.json(
        { success: false, error: 'not_individual_customer' },
        { status: 400 }
      );
    }

    const current = customer.onboarding_step ?? 1;
    if (toStep <= current) {
      return NextResponse.json(
        { success: false, error: 'cannot_revert' },
        { status: 409 }
      );
    }

    const { error: updErr } = await admin
      .from('customer')
      .update({ onboarding_step: toStep })
      .eq('id', customer.id);

    if (updErr) {
      loggers.api.error({ err: updErr, customerId: customer.id }, 'onboarding advance failed');
      return NextResponse.json(
        { success: false, error: 'update_failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: { onboardingStep: toStep } });
  } catch (err) {
    loggers.api.error({ err }, 'onboarding advance exception');
    return NextResponse.json({ success: false, error: 'server_error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    requireRole(UserRole.CUSTOMER),
    withAudit('ONBOARDING_ADVANCE'),
  )(request as RequestWithSession, handleAdvance);
}
