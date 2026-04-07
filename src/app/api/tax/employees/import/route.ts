import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { resolveUserRole } from '@/lib/auth/resolve-role';
import { loggers } from '@/lib/logger';

/**
 * POST /api/tax/employees/import
 *
 * Import employee payroll data from CSV/Excel.
 * Accepts FormData with 'file' (CSV) and 'customerId'.
 *
 * CSV columns (matching template):
 * employee_name, employee_npwp, employee_nik, ptkp_category, gross_salary,
 * position_allowance, overtime_pay, meal_allowance, transport_allowance,
 * other_allowances, bonus, thr, jht_employee, jp_employee, bpjs_kesehatan,
 * other_deductions, worker_type
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = await resolveUserRole(supabase, user.id);
    if (!['CUSTOMER', 'CONSULTANT_JTC', 'TAX_ADVISOR_JTC'].includes(role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const customerId = formData.get('customerId') as string;

    if (!file || !customerId) {
      return NextResponse.json({ error: 'file and customerId required' }, { status: 400 });
    }

    // Read CSV content
    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim());

    if (lines.length < 2) {
      return NextResponse.json({ error: '데이터가 없습니다. 헤더 + 최소 1행 필요.' }, { status: 400 });
    }

    // Parse header
    const headerRaw = lines[0].replace(/\uFEFF/, ''); // Remove BOM
    const headers = headerRaw.split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));

    // Map column indices
    const colMap: Record<string, number> = {};
    headers.forEach((h, i) => { colMap[h] = i; });

    const getVal = (row: string[], col: string): string => {
      const idx = colMap[col];
      if (idx === undefined) return '';
      return (row[idx] || '').replace(/['"]/g, '').trim();
    };
    const getNum = (row: string[], col: string): number => {
      const v = getVal(row, col).replace(/[,\.]/g, '');
      return Number(v) || 0;
    };

    const admin = getSupabaseAdmin();
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      const name = getVal(cols, 'employee_name');
      if (!name) { skipped++; continue; }

      const grossSalary = getNum(cols, 'gross_salary');
      if (grossSalary <= 0) { errors.push(`Row ${i + 1}: ${name} — gross_salary 없음`); skipped++; continue; }

      const ptkp = getVal(cols, 'ptkp_category') || 'TK0';
      const workerType = getVal(cols, 'worker_type') || 'REGULAR';

      // Check duplicate by name + customer
      const { data: existing } = await admin
        .from('employee_payroll')
        .select('id')
        .eq('customer_id', customerId)
        .eq('employee_name', name)
        .eq('is_active', true)
        .maybeSingle();

      if (existing) {
        // Update existing
        await admin.from('employee_payroll').update({
          employee_npwp: getVal(cols, 'employee_npwp') || null,
          employee_nik: getVal(cols, 'employee_nik') || null,
          ptkp_category: ptkp,
          gross_salary: grossSalary,
          position_allowance: getNum(cols, 'position_allowance'),
          other_allowances: getNum(cols, 'other_allowances'),
          jht_employee: getNum(cols, 'jht_employee'),
          jp_employee: getNum(cols, 'jp_employee'),
          other_deductions: getNum(cols, 'other_deductions'),
          worker_type: workerType,
        }).eq('id', existing.id);
        imported++;
      } else {
        // Insert new
        const { error: insertErr } = await admin.from('employee_payroll').insert({
          customer_id: customerId,
          employee_name: name,
          employee_npwp: getVal(cols, 'employee_npwp') || null,
          employee_nik: getVal(cols, 'employee_nik') || null,
          ptkp_category: ptkp,
          gross_salary: grossSalary,
          position_allowance: getNum(cols, 'position_allowance'),
          other_allowances: getNum(cols, 'other_allowances'),
          jht_employee: getNum(cols, 'jht_employee'),
          jp_employee: getNum(cols, 'jp_employee'),
          other_deductions: getNum(cols, 'other_deductions'),
          worker_type: workerType,
          is_active: true,
        });
        if (insertErr) {
          errors.push(`Row ${i + 1}: ${name} — ${insertErr.message}`);
          skipped++;
        } else {
          imported++;
        }
      }
    }

    loggers.api.info({ customerId, imported, skipped, errors: errors.length }, 'Employee import completed');

    return NextResponse.json({
      success: true,
      data: { imported, skipped, errors, totalRows: lines.length - 1 },
      message: `${imported}명 임포트 완료${skipped > 0 ? `, ${skipped}명 스킵` : ''}`,
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Employee import error');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 }
    );
  }
}
