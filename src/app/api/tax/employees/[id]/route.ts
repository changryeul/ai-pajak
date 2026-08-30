import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import type { RequestWithSession } from '@/types/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Single Employee detail endpoint.
 * GET /api/tax/employees/:id  — full row including JSONB sub-records.
 */
async function handleGet(req: RequestWithSession, ctx: RouteContext): Promise<Response> {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { data, error } = await getSupabaseAdmin()
    .from('employee_payroll')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ success: true, data });
}

export async function GET(request: NextRequest, ctx: RouteContext) {
  return composeMiddleware(requireAuth, blockPlatformAdmin)(
    request as RequestWithSession,
    (req) => handleGet(req, ctx),
  );
}

/**
 * PATCH /api/tax/employees/:id — partial update of a single employee master row.
 *
 * Unlike POST (full upsert that nulls unspecified fields), PATCH only touches
 * the whitelisted fields the caller actually sends, so inline edits from the
 * payslip detail (고용형태 / 사번 / NIK / 직책 / 부서 …) can't wipe siblings.
 * Field-level changes are written to employee_change_log for the HR audit trail.
 */
const PATCH_FIELD_MAP: Record<string, string> = {
  employmentStatus: 'employment_status',
  workerType: 'worker_type',
  employeeNumber: 'employee_number',
  employeeNik: 'employee_nik',
  employeeNpwp: 'employee_npwp',
  ptkpCategory: 'ptkp_category',
  position: 'position',
  department: 'department',
  hireDate: 'hire_date',
  resignDate: 'resign_date',
  employeeName: 'employee_name',
};

async function handlePatch(req: RequestWithSession, ctx: RouteContext): Promise<Response> {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  for (const [camel, snake] of Object.entries(PATCH_FIELD_MAP)) {
    if (body[camel] !== undefined) {
      const v = body[camel];
      // date fields: empty string → null
      patch[snake] = (v === '' && (snake === 'hire_date' || snake === 'resign_date')) ? null : v;
    }
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'no editable fields provided' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // Read previous for change-log diff + customer scoping.
  const { data: previous } = await admin
    .from('employee_payroll')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (!previous) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data, error } = await admin
    .from('employee_payroll')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Best-effort HR change log — never blocks the edit.
  try {
    const prev = previous as Record<string, unknown>;
    const rows = Object.entries(patch)
      .filter(([k, v]) => String(prev[k] ?? '') !== String(v ?? ''))
      .map(([k, v]) => ({
        employee_id: id,
        customer_id: prev.customer_id,
        section: 'MASTER',
        field: k,
        old_value: prev[k] == null ? null : String(prev[k]),
        new_value: v == null ? null : String(v),
        changed_by_user_id: req.session?.userId ?? null,
        changed_by_label: req.session?.email ?? 'system',
      }));
    if (rows.length > 0) await admin.from('employee_change_log').insert(rows);
  } catch { /* audit is best-effort */ }

  return NextResponse.json({ success: true, data });
}

export async function PATCH(request: NextRequest, ctx: RouteContext) {
  return composeMiddleware(requireAuth, blockPlatformAdmin)(
    request as RequestWithSession,
    (req) => handlePatch(req, ctx),
  );
}
