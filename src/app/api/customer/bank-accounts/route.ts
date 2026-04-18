/**
 * /api/customer/bank-accounts
 *
 * GET    — list bank accounts for the authenticated customer.
 * POST   — upsert (if body.id → update, else insert).
 * DELETE — { id } removes one row.
 *
 * Storage rule: account_last4 only. Never post the full account number.
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

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  bank_name: z.string().min(1).max(100),
  label: z.string().max(100).nullable().optional(),
  account_last4: z.string().regex(/^[0-9]{4}$/),
  currency: z.string().regex(/^[A-Z]{3}$/).default('IDR'),
  is_foreign: z.boolean().default(false),
  country: z.string().regex(/^[A-Z]{2}$/).nullable().optional(),
  is_primary: z.boolean().default(false),
});

const deleteSchema = z.object({ id: z.string().uuid() });

async function resolveCustomerId(userId: string): Promise<string | null> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from('customer')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

async function handleGet(req: RequestWithSession): Promise<Response> {
  try {
    const { userId } = req.session;
    const customerId = await resolveCustomerId(userId);
    if (!customerId) {
      return NextResponse.json({ success: false, error: 'customer_not_found' }, { status: 404 });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('customer_bank_account')
      .select('*')
      .eq('customer_id', customerId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      loggers.api.error({ err: error, customerId }, 'bank_account fetch failed');
      return NextResponse.json({ success: false, error: 'fetch_failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: { accounts: data ?? [] } });
  } catch (err) {
    loggers.api.error({ err }, 'bank_accounts GET exception');
    return NextResponse.json({ success: false, error: 'server_error' }, { status: 500 });
  }
}

async function handlePost(req: RequestWithSession): Promise<Response> {
  try {
    const body = await req.json().catch(() => null);
    const parsed = upsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'invalid_body', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { userId } = req.session;
    const customerId = await resolveCustomerId(userId);
    if (!customerId) {
      return NextResponse.json({ success: false, error: 'customer_not_found' }, { status: 404 });
    }

    const admin = getSupabaseAdmin();
    const { id, ...rest } = parsed.data;
    const row = { ...rest, customer_id: customerId };

    // If setting is_primary=true, clear existing primaries first (UNIQUE index).
    if (row.is_primary) {
      await admin
        .from('customer_bank_account')
        .update({ is_primary: false })
        .eq('customer_id', customerId)
        .eq('is_primary', true);
    }

    let result;
    if (id) {
      result = await admin
        .from('customer_bank_account')
        .update(row)
        .eq('id', id)
        .eq('customer_id', customerId)
        .select('*')
        .single();
    } else {
      result = await admin
        .from('customer_bank_account')
        .insert(row)
        .select('*')
        .single();
    }

    if (result.error || !result.data) {
      loggers.api.error({ err: result.error, customerId }, 'bank_account upsert failed');
      return NextResponse.json({ success: false, error: 'upsert_failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (err) {
    loggers.api.error({ err }, 'bank_accounts POST exception');
    return NextResponse.json({ success: false, error: 'server_error' }, { status: 500 });
  }
}

async function handleDelete(req: RequestWithSession): Promise<Response> {
  try {
    const body = await req.json().catch(() => null);
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'invalid_body' }, { status: 400 });
    }

    const { userId } = req.session;
    const customerId = await resolveCustomerId(userId);
    if (!customerId) {
      return NextResponse.json({ success: false, error: 'customer_not_found' }, { status: 404 });
    }

    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from('customer_bank_account')
      .delete()
      .eq('id', parsed.data.id)
      .eq('customer_id', customerId);

    if (error) {
      loggers.api.error({ err: error, customerId }, 'bank_account delete failed');
      return NextResponse.json({ success: false, error: 'delete_failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    loggers.api.error({ err }, 'bank_accounts DELETE exception');
    return NextResponse.json({ success: false, error: 'server_error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    requireRole(UserRole.CUSTOMER),
  )(request as RequestWithSession, handleGet);
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    requireRole(UserRole.CUSTOMER),
    withAudit('BANK_ACCOUNT_UPSERT'),
  )(request as RequestWithSession, handlePost);
}

export async function DELETE(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    requireRole(UserRole.CUSTOMER),
    withAudit('BANK_ACCOUNT_DELETE'),
  )(request as RequestWithSession, handleDelete);
}
