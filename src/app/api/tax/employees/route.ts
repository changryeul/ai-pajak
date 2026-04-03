import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import type { RequestWithSession } from '@/types/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * Employee Payroll CRUD
 * GET  ?customerId=xxx — List employees
 * POST — Create/update employee
 * DELETE ?id=xxx — Deactivate employee
 */
async function handleGet(req: RequestWithSession): Promise<Response> {
  const url = new URL(req.url);
  const customerId = url.searchParams.get('customerId');
  if (!customerId) return NextResponse.json({ error: 'customerId required' }, { status: 400 });

  const { data } = await getSupabaseAdmin()
    .from('employee_payroll')
    .select('*')
    .eq('customer_id', customerId)
    .eq('is_active', true)
    .order('employee_name');

  const employees = data || [];
  const summary = {
    totalEmployees: employees.length,
    totalGrossSalary: employees.reduce((s, e) => s + Number(e.gross_salary), 0),
  };

  return NextResponse.json({ success: true, data: { employees, summary } });
}

async function handlePost(req: RequestWithSession): Promise<Response> {
  const body = await req.json();
  const { id, customerId, employeeName, employeeNpwp, employeeNik, ptkpCategory,
    grossSalary, jhtEmployee, jpEmployee, positionAllowance, otherAllowances, otherDeductions, hireDate } = body;

  if (!customerId || !employeeName || !grossSalary) {
    return NextResponse.json({ error: 'customerId, employeeName, grossSalary required' }, { status: 400 });
  }

  const record = {
    customer_id: customerId,
    employee_name: employeeName,
    employee_npwp: employeeNpwp || null,
    employee_nik: employeeNik || null,
    ptkp_category: ptkpCategory || 'TK0',
    gross_salary: grossSalary,
    jht_employee: jhtEmployee || 0,
    jp_employee: jpEmployee || 0,
    position_allowance: positionAllowance || 0,
    other_allowances: otherAllowances || 0,
    other_deductions: otherDeductions || 0,
    hire_date: hireDate || null,
  };

  if (id) {
    // Update
    const { error } = await getSupabaseAdmin().from('employee_payroll').update(record).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, message: 'Updated' });
  } else {
    // Create
    const { data, error } = await getSupabaseAdmin().from('employee_payroll').insert(record).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data });
  }
}

async function handleDelete(req: RequestWithSession): Promise<Response> {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await getSupabaseAdmin().from('employee_payroll').update({ is_active: false }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function GET(request: NextRequest) { return composeMiddleware(requireAuth, blockPlatformAdmin)(request as RequestWithSession, handleGet); }
export async function POST(request: NextRequest) { return composeMiddleware(requireAuth, blockPlatformAdmin)(request as RequestWithSession, handlePost); }
export async function DELETE(request: NextRequest) { return composeMiddleware(requireAuth, blockPlatformAdmin)(request as RequestWithSession, handleDelete); }
