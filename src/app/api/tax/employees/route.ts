import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import type { RequestWithSession } from '@/types/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { diffEmployee } from '@/lib/payroll/employee-diff';

/**
 * Employee Payroll / HR Record CRUD
 * GET  ?customerId=xxx                                — list active employees
 * GET  ?customerId=xxx&searchBy=ID|NAME&keyword=...   — filtered search (HR Master)
 * POST                                                — create/update employee (handles HR fields + JSONB sub-records)
 * DELETE ?id=xxx                                      — soft-deactivate employee
 */
async function handleGet(req: RequestWithSession): Promise<Response> {
  const url = new URL(req.url);
  const customerId = url.searchParams.get('customerId');
  const searchBy = url.searchParams.get('searchBy'); // 'ID' | 'NAME' | null
  const keyword = (url.searchParams.get('keyword') || '').trim();
  if (!customerId) return NextResponse.json({ error: 'customerId required' }, { status: 400 });

  let query = getSupabaseAdmin()
    .from('employee_payroll')
    .select('*')
    .eq('customer_id', customerId)
    .eq('is_active', true);

  if (keyword) {
    if (searchBy === 'ID') {
      query = query.ilike('employee_number', `%${keyword}%`);
    } else if (searchBy === 'NAME') {
      query = query.or(`employee_name.ilike.%${keyword}%,preferred_name.ilike.%${keyword}%`);
    } else {
      query = query.or(
        `employee_number.ilike.%${keyword}%,employee_name.ilike.%${keyword}%,preferred_name.ilike.%${keyword}%`
      );
    }
  }

  const { data, error } = await query.order('employee_name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const employees = data || [];
  const summary = {
    totalEmployees: employees.length,
    totalGrossSalary: employees.reduce((s, e) => s + Number(e.gross_salary || 0), 0),
  };

  return NextResponse.json({ success: true, data: { employees, summary } });
}

async function handlePost(req: RequestWithSession): Promise<Response> {
  const body = await req.json();
  const {
    id, customerId,
    // Identity
    employeeName, preferredName, employeeNumber,
    employeeNpwp, employeeNik, ptkpCategory,
    // Personal
    nationality, gender, birthDate, placeOfBirth, bloodType, maritalStatus,
    email, phone, address,
    emergencyContactName, emergencyContactPhone,
    // Job
    position, department, workLocation, supervisor,
    hireDate, resignDate, employmentStatus, contractStatus, probationEnd,
    workerType,
    // Family / PTKP
    spouseName, dependents,
    // Payroll components
    basicSalary, transportAllowance, mealAllowance, positionAllowance, otherAllowance,
    grossSalary, jhtEmployee, jpEmployee, otherDeductions,
    pph21Method,
    // BPJS / insurance
    bpjsKesehatan, bpjsKesehatanNo, bpjsTk, bpjsTkNo, privateInsurance,
    // Bank
    bankName, bankAccountNo, bankAccountName,
    // Contract
    contractType, contractStartDate, contractEndDate,
    // Expat
    passportNo, kitasNo, workPermitExpiry, taxResidency,
    // Storage
    photoUrl,
    // Sub-records
    family, education, career, promotions, movements, rewards,
    // Notes
    notes,
  } = body;

  if (!customerId || !employeeName) {
    return NextResponse.json({ error: 'customerId and employeeName are required' }, { status: 400 });
  }

  // Calculate gross_salary from components if not explicitly provided.
  // Existing PPh21 callers pass grossSalary directly; the HR Master form sends components instead.
  const computedGross = grossSalary != null
    ? Number(grossSalary)
    : Number(basicSalary || 0) + Number(transportAllowance || 0) + Number(mealAllowance || 0)
      + Number(positionAllowance || 0) + Number(otherAllowance || 0);

  const record = {
    customer_id: customerId,
    // Identity
    employee_name: employeeName,
    preferred_name: preferredName ?? null,
    employee_number: employeeNumber ?? null,
    employee_npwp: employeeNpwp ?? null,
    employee_nik: employeeNik ?? null,
    ptkp_category: ptkpCategory ?? 'TK0',
    // Personal
    nationality: nationality ?? null,
    gender: gender ?? null,
    birth_date: birthDate || null,
    place_of_birth: placeOfBirth ?? null,
    blood_type: bloodType ?? null,
    marital_status: maritalStatus ?? null,
    email: email ?? null,
    phone: phone ?? null,
    address: address ?? null,
    emergency_contact_name: emergencyContactName ?? null,
    emergency_contact_phone: emergencyContactPhone ?? null,
    // Job
    position: position ?? null,
    department: department ?? null,
    work_location: workLocation ?? null,
    supervisor: supervisor ?? null,
    hire_date: hireDate || null,
    resign_date: resignDate || null,
    employment_status: employmentStatus ?? null,
    contract_status: contractStatus ?? null,
    probation_end: probationEnd || null,
    worker_type: workerType ?? 'REGULAR',
    // Family / PTKP
    spouse_name: spouseName ?? null,
    dependents: dependents ?? null,
    // Payroll components
    basic_salary: basicSalary != null ? Number(basicSalary) : null,
    transport_allowance: transportAllowance != null ? Number(transportAllowance) : null,
    meal_allowance: mealAllowance != null ? Number(mealAllowance) : null,
    position_allowance: positionAllowance != null ? Number(positionAllowance) : 0,
    other_allowance: otherAllowance != null ? Number(otherAllowance) : null,
    gross_salary: computedGross,
    jht_employee: jhtEmployee != null ? Number(jhtEmployee) : 0,
    jp_employee: jpEmployee != null ? Number(jpEmployee) : 0,
    other_deductions: otherDeductions != null ? Number(otherDeductions) : 0,
    pph21_method: pph21Method ?? null,
    // BPJS / insurance
    bpjs_kesehatan: bpjsKesehatan ?? null,
    bpjs_kesehatan_no: bpjsKesehatanNo ?? null,
    bpjs_tk: bpjsTk ?? null,
    bpjs_tk_no: bpjsTkNo ?? null,
    private_insurance: privateInsurance ?? null,
    // Bank
    bank_name: bankName ?? null,
    bank_account_no: bankAccountNo ?? null,
    bank_account_name: bankAccountName ?? null,
    // Contract
    contract_type: contractType ?? null,
    contract_start_date: contractStartDate || null,
    contract_end_date: contractEndDate || null,
    // Expat
    passport_no: passportNo ?? null,
    kitas_no: kitasNo ?? null,
    work_permit_expiry: workPermitExpiry || null,
    tax_residency: taxResidency ?? null,
    // Storage — only set when caller supplied a value; otherwise leave whatever
    // the dedicated /photo endpoint stored.
    ...(photoUrl !== undefined ? { photo_url: photoUrl } : {}),
    // Sub-records (only set if caller actually included them)
    ...(family !== undefined ? { family: Array.isArray(family) ? family : [] } : {}),
    ...(education !== undefined ? { education: Array.isArray(education) ? education : [] } : {}),
    ...(career !== undefined ? { career: Array.isArray(career) ? career : [] } : {}),
    ...(promotions !== undefined ? { promotions: Array.isArray(promotions) ? promotions : [] } : {}),
    ...(movements !== undefined ? { movements: Array.isArray(movements) ? movements : [] } : {}),
    ...(rewards !== undefined ? { rewards: Array.isArray(rewards) ? rewards : [] } : {}),
    notes: notes ?? null,
  };

  const admin = getSupabaseAdmin();
  const userId = req.session?.userId ?? null;
  const userLabel = req.session?.email ?? 'system';

  if (id) {
    // Read the previous row so we can write a field-level diff into employee_change_log.
    const { data: previous } = await admin
      .from('employee_payroll')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    const { data, error } = await admin
      .from('employee_payroll')
      .update(record)
      .eq('id', id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const changes = diffEmployee(previous as Record<string, unknown> | null, record);
    if (changes.length > 0) {
      await admin.from('employee_change_log').insert(
        changes.map((c) => ({
          employee_id: id,
          customer_id: customerId,
          section: c.section,
          field: c.field,
          old_value: c.old_value,
          new_value: c.new_value,
          changed_by_user_id: userId,
          changed_by_label: userLabel,
        })),
      );
    }
    return NextResponse.json({ success: true, data });
  } else {
    const { data, error } = await admin
      .from('employee_payroll')
      .insert(record)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (data?.id) {
      const initial = diffEmployee(null, record);
      if (initial.length > 0) {
        await admin.from('employee_change_log').insert(
          initial.map((c) => ({
            employee_id: data.id,
            customer_id: customerId,
            section: c.section,
            field: c.field,
            old_value: c.old_value,
            new_value: c.new_value,
            changed_by_user_id: userId,
            changed_by_label: userLabel,
          })),
        );
      }
    }
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
