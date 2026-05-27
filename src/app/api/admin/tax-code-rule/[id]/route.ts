/**
 * PATCH /api/admin/tax-code-rule/[id]
 *   body: { tax_code?, rate_rule?, condition_text?, doc_required?, review_note? }
 *   → 200 { data: TaxCodeRule }
 *
 * TAX_OPERATOR_MASTER only. updated_by / updated_at are server-set.
 * category and sort_order cannot be changed (system keys).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireRole } from '@/middleware/rbac';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import { UserRole, type RequestWithSession } from '@/types/auth';
import type { TaxCodeRule } from '@/types/tax-code-rule';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const patchSchema = z
  .object({
    tax_code:       z.string().min(1).max(50).optional(),
    rate_rule:      z.string().min(1).max(500).optional(),
    condition_text: z.string().min(1).max(500).optional(),
    doc_required:   z.string().min(1).max(500).optional(),
    review_note:    z.string().min(1).max(500).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'at least one of tax_code, rate_rule, condition_text, doc_required, review_note is required',
  });

function getId(req: NextRequest): string | null {
  const m = req.nextUrl.pathname.match(/\/tax-code-rule\/([^/]+)/);
  return m?.[1] ?? null;
}

async function handlePatch(req: RequestWithSession): Promise<Response> {
  const id = getId(req as unknown as NextRequest);
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: 'id must be uuid' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('tax_code_rule')
    .update({
      ...parsed.data,
      updated_by: req.session.userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    // PostgREST PGRST116 = no row matched
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'rule not found' }, { status: 404 });
    }
    loggers.api.error(
      { err: error.message, route: `/api/admin/tax-code-rule/${id}`, code: error.code },
      'tax_code_rule update failed',
    );
    return NextResponse.json({ error: 'Failed to update rule' }, { status: 500 });
  }
  return NextResponse.json({ data: data as TaxCodeRule });
}

export async function PATCH(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(UserRole.TAX_OPERATOR_MASTER),
    withAudit('TAX_CODE_RULE_UPDATE'),
  )(request as RequestWithSession, handlePatch);
}
