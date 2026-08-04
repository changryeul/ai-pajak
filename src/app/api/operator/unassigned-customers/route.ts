import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';

const SUPERVISOR_ROLES = ['TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];

/**
 * GET /api/operator/unassigned-customers
 *
 * Returns customers that signed up but have no active consultant assignment
 * (i.e., waiting in the JTC assignment queue). Only visible to supervisors,
 * since they are the ones who pick a consultant for each new intake.
 *
 * Filter: customer with no active assignment in EITHER customer_consultant
 * (EXTERNAL tenant staff) OR operator_client_assignments (JTC operator model,
 * 결정 ① 이후 JTC 실무 배정 테이블). External-tenant clients are excluded
 * implicitly because the sign-up flow of a self-service tax_partner creates
 * the consultant assignment inline.
 */
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const { data: roles } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('is_active', true);

    const hasSupervisorRole = roles?.some(r => SUPERVISOR_ROLES.includes(r.role));
    if (!hasSupervisorRole) {
      return NextResponse.json(
        { success: false, error: 'Supervisor access required' },
        { status: 403 },
      );
    }

    const [
      { data: assignedRows, error: assignedErr },
      { data: operatorRows, error: operatorErr },
    ] = await Promise.all([
      admin.from('customer_consultant').select('customer_id').eq('is_active', true),
      admin.from('operator_client_assignments').select('customer_id').eq('is_active', true),
    ]);

    if (assignedErr) {
      throw new Error(`Failed to load assignments: ${assignedErr.message}`);
    }
    if (operatorErr) {
      throw new Error(`Failed to load operator assignments: ${operatorErr.message}`);
    }

    const assignedIds = new Set([
      ...(assignedRows || []).map(r => r.customer_id),
      ...(operatorRows || []).map(r => r.customer_id),
    ]);

    const { data: customers, error: custErr } = await admin
      .from('customer')
      .select('id, customer_type, full_name, company_name, npwp, email, phone, created_at')
      .order('created_at', { ascending: false });

    if (custErr) {
      throw new Error(`Failed to load customers: ${custErr.message}`);
    }

    const unassigned = (customers || []).filter(c => !assignedIds.has(c.id));

    return NextResponse.json({
      success: true,
      data: {
        customers: unassigned,
        count: unassigned.length,
      },
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Unassigned customers query error');
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load unassigned customers',
      },
      { status: 500 },
    );
  }
}
