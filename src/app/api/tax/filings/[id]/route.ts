import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { requireRole } from '@/middleware/rbac';
import { withAudit } from '@/middleware/audit';
import type { RequestWithSession, UserRole } from '@/types/auth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function handleGetFiling(
  req: RequestWithSession,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await context.params;

  try {
    // Fetch filing with customer info
    const { data: filing, error } = await supabaseAdmin
      .from('tax_filings')
      .select(`
        *,
        customer:customers(
          id,
          full_name,
          company_name,
          npwp
        )
      `)
      .eq('id', id)
      .single();

    if (error || !filing) {
      return NextResponse.json(
        { success: false, error: 'Filing not found' },
        { status: 404 }
      );
    }

    // Role-based access check
    const { role, userId } = req.session;

    if (role === 'CUSTOMER') {
      const { data: customer } = await supabaseAdmin
        .from('customers')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (!customer || customer.id !== filing.customer_id) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        );
      }
    } else if (role === 'CONSULTANT_JTC') {
      const { data: assignment } = await supabaseAdmin
        .from('customer_consultant')
        .select('id')
        .eq('customer_id', filing.customer_id)
        .eq('consultant_id', userId)
        .eq('is_active', true)
        .single();

      if (!assignment) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        );
      }
    }

    // Fetch history
    const { data: history } = await supabaseAdmin
      .from('filing_history')
      .select(`
        id,
        action,
        status,
        notes,
        created_at,
        performed_by:users(
          id,
          full_name,
          role
        )
      `)
      .eq('filing_id', id)
      .order('created_at', { ascending: false });

    // Transform data
    const customer = filing.customer as {
      id: string;
      full_name: string;
      company_name: string | null;
      npwp: string | null;
    } | null;

    return NextResponse.json({
      success: true,
      data: {
        id: filing.id,
        taxType: filing.tax_type,
        taxYear: filing.tax_year,
        taxPeriod: filing.tax_period,
        status: filing.status,
        totalIncome: filing.total_income || 0,
        totalDeductions: filing.total_deductions || 0,
        taxableIncome: filing.taxable_income || 0,
        taxDue: filing.tax_due || 0,
        taxPaid: filing.tax_paid || 0,
        incomeData: filing.income_data || {},
        deductionData: filing.deduction_data || {},
        notes: filing.notes,
        dueDate: filing.due_date,
        submittedAt: filing.submitted_at,
        bpeNumber: filing.bpe_number,
        createdAt: filing.created_at,
        updatedAt: filing.updated_at,
        customer: customer ? {
          id: customer.id,
          fullName: customer.full_name,
          companyName: customer.company_name,
          npwp: customer.npwp,
        } : null,
        history: history?.map((h) => {
          // Supabase returns single relations as objects, not arrays
          const performedByData = h.performed_by as unknown;
          const performedBy = Array.isArray(performedByData)
            ? performedByData[0] as { id: string; full_name: string; role: string; } | undefined
            : performedByData as { id: string; full_name: string; role: string; } | null;
          return {
            id: h.id,
            action: h.action,
            status: h.status,
            notes: h.notes,
            createdAt: h.created_at,
            performedBy: performedBy ? {
              id: performedBy.id,
              fullName: performedBy.full_name,
              role: performedBy.role,
            } : null,
          };
        }) || [],
      },
    });
  } catch (error) {
    console.error('Error fetching filing:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleUpdateFiling(
  req: RequestWithSession,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await context.params;
  const body = await req.json();

  try {
    // Check current status
    const { data: current, error: fetchError } = await supabaseAdmin
      .from('tax_filings')
      .select('status, customer_id')
      .eq('id', id)
      .single();

    if (fetchError || !current) {
      return NextResponse.json(
        { success: false, error: 'Filing not found' },
        { status: 404 }
      );
    }

    // Only allow updates for DRAFT status
    if (current.status !== 'DRAFT') {
      return NextResponse.json(
        { success: false, error: 'Cannot update filed tax return' },
        { status: 400 }
      );
    }

    // Role-based access check
    const { role, userId } = req.session;

    if (role === 'CUSTOMER') {
      const { data: customer } = await supabaseAdmin
        .from('customers')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (!customer || customer.id !== current.customer_id) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        );
      }
    }

    // Update filing
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.incomeData !== undefined) updateData.income_data = body.incomeData;
    if (body.deductionData !== undefined) updateData.deduction_data = body.deductionData;
    if (body.totalIncome !== undefined) updateData.total_income = body.totalIncome;
    if (body.totalDeductions !== undefined) updateData.total_deductions = body.totalDeductions;
    if (body.taxableIncome !== undefined) updateData.taxable_income = body.taxableIncome;
    if (body.taxDue !== undefined) updateData.tax_due = body.taxDue;
    if (body.notes !== undefined) updateData.notes = body.notes;

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('tax_filings')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating filing:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update filing' },
        { status: 500 }
      );
    }

    // Record history
    await supabaseAdmin.from('filing_history').insert({
      filing_id: id,
      action: 'UPDATED',
      status: updated.status,
      notes: 'Filing data updated',
      performed_by: userId,
    });

    return NextResponse.json({
      success: true,
      data: { id: updated.id },
    });
  } catch (error) {
    console.error('Error in update filing:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Import blockPlatformAdmin middleware
  const { blockPlatformAdmin } = await import('@/middleware/blockPlatformAdmin');

  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin, // CRITICAL: Block platform admin from accessing tax data
    requireRole('CUSTOMER' as UserRole, 'CONSULTANT_JTC' as UserRole, 'TAX_ADVISOR_JTC' as UserRole),
    withAudit('TAX_FILING_VIEW')
  )(request as RequestWithSession, (req: RequestWithSession) => handleGetFiling(req, context));
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return composeMiddleware(
    requireAuth,
    requireRole('CUSTOMER' as UserRole, 'CONSULTANT_JTC' as UserRole, 'TAX_ADVISOR_JTC' as UserRole),
    withAudit('TAX_FILING_UPDATE')
  )(request as RequestWithSession, (req: RequestWithSession) => handleUpdateFiling(req, context));
}
