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
    const taxPeriodRaw = formData.get('taxPeriod') as string | null;
    // Validate YYYY-MM
    const taxPeriod = taxPeriodRaw && /^\d{4}-\d{2}$/.test(taxPeriodRaw) ? taxPeriodRaw : null;

    if (!file || !customerId) {
      return NextResponse.json({ error: 'file and customerId required' }, { status: 400 });
    }

    // Read CSV content
    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim());

    if (lines.length < 2) {
      return NextResponse.json({ error: 'No data (header + at least 1 row required).' }, { status: 400 });
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
    let payslipsUpserted = 0;
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      const name = getVal(cols, 'employee_name');
      if (!name) { skipped++; continue; }

      const grossSalary = getNum(cols, 'gross_salary');
      if (grossSalary <= 0) { errors.push(`Row ${i + 1}: ${name} — missing gross_salary`); skipped++; continue; }

      const ptkp = getVal(cols, 'ptkp_category') || 'TK0';
      const workerType = getVal(cols, 'worker_type') || 'REGULAR';

      const positionAllowance = getNum(cols, 'position_allowance');
      const overtimePay = getNum(cols, 'overtime_pay');
      const mealAllowance = getNum(cols, 'meal_allowance');
      const transportAllowance = getNum(cols, 'transport_allowance');
      const otherAllowances = getNum(cols, 'other_allowances');
      const bonus = getNum(cols, 'bonus');
      const thr = getNum(cols, 'thr');
      const jhtEmployee = getNum(cols, 'jht_employee');
      const jpEmployee = getNum(cols, 'jp_employee');
      const bpjsKesehatan = getNum(cols, 'bpjs_kesehatan');
      const otherDeductions = getNum(cols, 'other_deductions');

      // Check duplicate by name + customer
      const { data: existing } = await admin
        .from('employee_payroll')
        .select('id')
        .eq('customer_id', customerId)
        .eq('employee_name', name)
        .eq('is_active', true)
        .maybeSingle();

      let employeeId: string | null = null;

      if (existing) {
        // Update master (HR record): identity fields only — keep monthly amounts on payslip side.
        // gross_salary is also kept fresh as the latest base for new payslips.
        await admin.from('employee_payroll').update({
          employee_npwp: getVal(cols, 'employee_npwp') || null,
          employee_nik: getVal(cols, 'employee_nik') || null,
          ptkp_category: ptkp,
          gross_salary: grossSalary,
          worker_type: workerType,
        }).eq('id', existing.id);
        employeeId = existing.id;
        imported++;
      } else {
        const { data: inserted, error: insertErr } = await admin.from('employee_payroll').insert({
          customer_id: customerId,
          employee_name: name,
          employee_npwp: getVal(cols, 'employee_npwp') || null,
          employee_nik: getVal(cols, 'employee_nik') || null,
          ptkp_category: ptkp,
          gross_salary: grossSalary,
          position_allowance: positionAllowance,
          other_allowances: otherAllowances,
          jht_employee: jhtEmployee,
          jp_employee: jpEmployee,
          other_deductions: otherDeductions,
          worker_type: workerType,
          is_active: true,
        }).select('id').single();
        if (insertErr) {
          errors.push(`Row ${i + 1}: ${name} — ${insertErr.message}`);
          skipped++;
          continue;
        }
        employeeId = inserted?.id ?? null;
        imported++;
      }

      // If a tax period was supplied, mirror this row into monthly_payslip.
      // employee_payroll holds the HR record; monthly_payslip holds the per-month salary detail.
      if (taxPeriod && employeeId) {
        const totalGross = grossSalary + overtimePay + mealAllowance + transportAllowance
          + positionAllowance + otherAllowances + bonus + thr;
        const totalDeduction = bpjsKesehatan + jhtEmployee + jpEmployee + otherDeductions;

        const { error: payslipErr } = await admin
          .from('monthly_payslip')
          .upsert({
            customer_id: customerId,
            employee_id: employeeId,
            period: taxPeriod,
            base_salary: grossSalary,
            overtime_pay: overtimePay,
            meal_allowance: mealAllowance,
            transport_allowance: transportAllowance,
            position_allowance: positionAllowance,
            other_allowances: otherAllowances,
            bonus,
            thr,
            jht_employee: jhtEmployee,
            jp_employee: jpEmployee,
            bpjs_kesehatan: bpjsKesehatan,
            other_deductions: otherDeductions,
            total_gross: totalGross,
            total_deduction: totalDeduction,
            status: 'DRAFT',
          }, { onConflict: 'employee_id,period' });

        if (payslipErr) {
          errors.push(`Row ${i + 1}: ${name} — payslip: ${payslipErr.message}`);
        } else {
          payslipsUpserted++;
        }
      }
    }

    loggers.api.info(
      { customerId, taxPeriod, imported, skipped, payslipsUpserted, errors: errors.length },
      'Employee import completed'
    );

    const periodMsg = taxPeriod ? ` (${payslipsUpserted} payslip rows for ${taxPeriod})` : '';
    return NextResponse.json({
      success: true,
      data: { imported, skipped, errors, totalRows: lines.length - 1, payslipsUpserted, taxPeriod },
      message: `${imported} imported${skipped > 0 ? `, ${skipped} skipped` : ''}${periodMsg}`,
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Employee import error');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 }
    );
  }
}
