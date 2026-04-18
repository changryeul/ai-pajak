/**
 * PATCH /api/customer/profile
 *
 * Autosave endpoint for the /settings page. Accepts a partial profile patch
 * and upserts the allowed fields on the customer row. Idempotent: same
 * payload can be re-sent safely.
 *
 * Allowed fields (whitelist — never accept arbitrary shape from the client):
 *   - full_name
 *   - email
 *   - phone
 *   - npwp
 *   - nik
 *   - spouse_name / spouse_npwp / spouse_annual_income / spouse_withheld_tax
 *   - ptkp_status
 *
 * Returns the recomputed completion score so the client stays in sync.
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
import { calculateCompletion } from '@/lib/profile/completion';

const patchSchema = z.object({
  full_name: z.string().trim().min(1).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().trim().max(30).optional(),
  npwp: z.string().regex(/^\d{15}$/).optional(),
  nik: z.string().regex(/^\d{16}$/).optional(),
  spouse_name: z.string().trim().max(100).nullable().optional(),
  spouse_npwp: z.string().trim().max(20).nullable().optional(),
  spouse_annual_income: z.number().nonnegative().nullable().optional(),
  spouse_withheld_tax: z.number().nonnegative().nullable().optional(),
  ptkp_status: z.enum([
    'TK/0', 'TK/1', 'TK/2', 'TK/3',
    'K/0', 'K/1', 'K/2', 'K/3',
    'K/I/0', 'K/I/1', 'K/I/2', 'K/I/3',
  ]).nullable().optional(),
  coretax_id: z.string().trim().max(100).nullable().optional(),
  djp_password_hint: z.string().trim().max(100).nullable().optional(),
  efin: z.string().trim().max(20).nullable().optional(),
  // Cross-border profile (PR3 Batch 3 / T-005). ISO 3166-1 alpha-2.
  // The DB CHECK constraint enforces the supported subset.
  nationality: z.enum(['ID', 'KR', 'US', 'JP']).nullable().optional(),
  tax_residence_country: z.enum(['ID', 'KR', 'US', 'JP']).nullable().optional(),
});

async function handlePatch(req: RequestWithSession): Promise<Response> {
  try {
    const body = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'invalid_body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { userId } = req.session;
    const admin = getSupabaseAdmin();

    const { data: before, error: fetchErr } = await admin
      .from('customer')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchErr || !before) {
      return NextResponse.json(
        { success: false, error: 'customer_not_found' },
        { status: 404 }
      );
    }

    // Only write keys that were actually provided (so partial saves stay partial)
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value !== undefined) patch[key] = value;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ success: true, data: { noop: true } });
    }

    const { data: after, error: updErr } = await admin
      .from('customer')
      .update(patch)
      .eq('id', before.id)
      .select('*')
      .single();

    if (updErr || !after) {
      loggers.api.error({ err: updErr, customerId: before.id }, 'profile update failed');
      return NextResponse.json(
        { success: false, error: 'update_failed' },
        { status: 500 }
      );
    }

    const completion = calculateCompletion({
      name: after.full_name,
      idType: after.npwp ? 'npwp' : 'nik',
      npwp: after.npwp,
      nik: after.nik,
      email: after.email,
      phone: after.phone,
      coretaxId: after.coretax_id,
      djpPassword: after.djp_password_hint,
      efin: after.efin,
    });

    return NextResponse.json({
      success: true,
      data: {
        completion,
      },
    });
  } catch (err) {
    loggers.api.error({ err }, 'profile PATCH exception');
    return NextResponse.json({ success: false, error: 'server_error' }, { status: 500 });
  }
}

interface CustomerProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  npwp: string | null;
  nik: string | null;
  customer_type: 'INDIVIDUAL' | 'COMPANY';
  ptkp_status: string | null;
  spouse_name: string | null;
  spouse_npwp: string | null;
  spouse_annual_income: number | null;
  spouse_withheld_tax: number | null;
  coretax_id: string | null;
  djp_password_hint: string | null;
  efin: string | null;
  onboarding_step: number | null;
  nationality: 'ID' | 'KR' | 'US' | 'JP' | null;
  tax_residence_country: 'ID' | 'KR' | 'US' | 'JP' | null;
}

async function handleGet(req: RequestWithSession): Promise<Response> {
  try {
    const { userId } = req.session;
    const admin = getSupabaseAdmin();

    const { data, error: fetchErr } = await admin
      .from('customer')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchErr || !data) {
      return NextResponse.json(
        { success: false, error: 'customer_not_found' },
        { status: 404 }
      );
    }

    const customer = data as unknown as CustomerProfileRow;

    const completion = calculateCompletion({
      name: customer.full_name,
      idType: customer.npwp ? 'npwp' : 'nik',
      npwp: customer.npwp,
      nik: customer.nik,
      email: customer.email,
      phone: customer.phone,
      coretaxId: customer.coretax_id,
      djpPassword: customer.djp_password_hint,
      efin: customer.efin,
    });

    return NextResponse.json({
      success: true,
      data: { customer, completion },
    });
  } catch (err) {
    loggers.api.error({ err }, 'profile GET exception');
    return NextResponse.json({ success: false, error: 'server_error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    requireRole(UserRole.CUSTOMER),
  )(request as RequestWithSession, handleGet);
}

export async function PATCH(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    requireRole(UserRole.CUSTOMER),
    withAudit('CUSTOMER_PROFILE_PATCH'),
  )(request as RequestWithSession, handlePatch);
}
