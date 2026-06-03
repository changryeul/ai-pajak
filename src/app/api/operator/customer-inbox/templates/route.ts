/**
 * GET /api/operator/customer-inbox/templates
 *
 * Returns active customer_ai_template rows for the operator inbox dropdown
 * (Phase 2.4 reply snippets). Open to all operator-tier roles
 * (TAX_OPERATOR / LEAD / SUPERVISOR / MASTER) — the admin endpoint at
 * /api/admin/master/customer-ai-templates restricts read to SUPERVISOR+,
 * but every operator needs the snippets in the inbox UI.
 */

import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireRole } from '@/middleware/rbac';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import { UserRole, type RequestWithSession } from '@/types/auth';
import type { CustomerAiTemplateDTO } from '@/types/customer-ai-template';

const ROUTE = '/api/operator/customer-inbox/templates';

async function handleGet(_req: RequestWithSession): Promise<Response> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('customer_ai_template')
    .select('id, title, body, category, display_order')
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('title', { ascending: true });

  const headers = { 'Cache-Control': 'no-store' };
  if (error) {
    loggers.api.error(
      { err: error.message, route: ROUTE, code: error.code },
      'customer_ai_template (operator read) select failed',
    );
    return NextResponse.json(
      { error: 'Failed to load templates' },
      { status: 500, headers },
    );
  }

  type Row = {
    id: string;
    title: string;
    body: string;
    category: string | null;
    display_order: number;
  };
  const out: CustomerAiTemplateDTO[] = ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    category: r.category,
    displayOrder: r.display_order,
  }));

  return NextResponse.json({ data: out }, { headers });
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(
      UserRole.TAX_OPERATOR,
      UserRole.TAX_OPERATOR_LEAD,
      UserRole.TAX_OPERATOR_SUPERVISOR,
      UserRole.TAX_OPERATOR_MASTER,
    ),
  )(request as RequestWithSession, handleGet);
}
