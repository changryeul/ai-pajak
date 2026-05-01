import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import type { RequestWithSession } from '@/types/auth';

const CreateSchema = z.object({
  fiscalYear: z.number().int().min(2000).max(2100),
  closingType: z.enum(['UMKM', 'PPH25']),
  data: z.record(z.string(), z.unknown()).optional(),
});

async function handleList(req: RequestWithSession): Promise<Response> {
  const customerId = req.session?.customerId;
  if (!customerId) {
    return NextResponse.json({ success: false, error: 'No customer' }, { status: 400 });
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('tax_closing_session')
    .select('id, fiscal_year, closing_type, current_step, status, signed_statements_uploaded, data, updated_at')
    .eq('customer_id', customerId)
    .order('fiscal_year', { ascending: false });
  if (error) {
    loggers.api.error({ err: error }, 'closing-session list failed');
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, data });
}

async function handleCreate(req: RequestWithSession): Promise<Response> {
  const customerId = req.session?.customerId;
  if (!customerId) {
    return NextResponse.json({ success: false, error: 'No customer' }, { status: 400 });
  }
  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 });
  }
  const sb = getSupabaseAdmin();
  // Upsert: same (customer, fiscal_year) returns the existing row.
  const { data, error } = await sb
    .from('tax_closing_session')
    .upsert(
      {
        customer_id: customerId,
        fiscal_year: parsed.data.fiscalYear,
        closing_type: parsed.data.closingType,
        data: parsed.data.data ?? {},
      },
      { onConflict: 'customer_id,fiscal_year' }
    )
    .select()
    .single();
  if (error) {
    loggers.api.error({ err: error }, 'closing-session upsert failed');
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, data });
}

export async function GET(request: NextRequest) {
  return composeMiddleware(requireAuth)(request as RequestWithSession, handleList);
}

export async function POST(request: NextRequest) {
  return composeMiddleware(requireAuth, withAudit('CLOSING_SESSION_UPSERT'))(
    request as RequestWithSession,
    handleCreate
  );
}
