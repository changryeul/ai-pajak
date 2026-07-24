import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { resolveUserRole } from '@/lib/auth/resolve-role';
import { loggers } from '@/lib/logger';
import { computePayslipTotals } from '@/app/api/tax/monthly-payslip/route';
import { normalizePtkpCategory } from '@/config/pph21-ter-rates';
import { loadRateOverrides } from '@/lib/tax/rate-provider';

/**
 * POST /api/tax/employees/import
 *
 * Import employee payroll data from CSV/Excel.
 * Accepts FormData with 'file' (CSV) and 'customerId'.
 *
 * CSV columns (matching template):
 * Required: employee_name, gross_salary
 * Payroll-style: employee_npwp, employee_nik, ptkp_category, position_allowance,
 *   overtime_pay, meal_allowance, transport_allowance, other_allowances, bonus,
 *   thr, jht_employee, jp_employee, bpjs_kesehatan, other_deductions, worker_type
 * HR record: employee_number, position, department, hire_date, resign_date,
 *   birth_date, gender, marital_status, email, phone, address, bank_name,
 *   bank_account_no, bank_account_name, emergency_contact_name,
 *   emergency_contact_phone, notes
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = await resolveUserRole(supabase, user.id);
    if (!['CUSTOMER', 'CONSULTANT', 'TAX_ADVISOR'].includes(role || '')) {
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

    // 2026-06-21: 미래월 차단
    if (taxPeriod) {
      const now = new Date();
      const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      if (taxPeriod > currentYm) {
        return NextResponse.json({ error: `미래월(${taxPeriod}) 자료는 업로드할 수 없습니다 (최대 ${currentYm})` }, { status: 400 });
      }
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
    // Warm DB rate overrides once before the row loop (PTKP/bracket/surcharge).
    await loadRateOverrides();
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

      // 정규화: 양식에 'K/1', 'TK 2' 등 다양한 표기가 들어와도 canonical
      // PTKP 키로 저장 → TER 카테고리 판정이 어긋나 세율 0(과세 누락)/오산되던
      // 문제 방지. (payslip 경로와 동일한 정규화를 공용 함수로 통일.)
      const ptkp = normalizePtkpCategory(getVal(cols, 'ptkp_category'));
      // 2026-06-21: 양식의 employment_status / worker_type 등 HR 필드는 사용자가 직접
      // 직원 마스터에서 입력하는 정책 (sync 가 자동 채우지 않음) → import 시 무시.

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

      // 2026-06-21 새 정책:
      //  - employee_payroll (직원 마스터) 자동 생성/업데이트 중단. sync 버튼으로만 갱신.
      //  - monthly_payslip 만 생성. 직원 식별 정보 (name/npwp/ptkp) 는 payslip 자체에 저장.
      //  - period 는 required (월별 급여 자료 라서).
      if (!taxPeriod) {
        errors.push(`Row ${i + 1}: ${name} — 월(taxPeriod) 정보가 필요합니다`);
        skipped++;
        continue;
      }

      // 같은 (customer_id, period, employee_name) 행이 있으면 update, 없으면 insert.
      // employee_id 는 sync 전엔 null.
      const { data: existingPayslip } = await admin
        .from('monthly_payslip')
        .select('id')
        .eq('customer_id', customerId)
        .eq('period', taxPeriod)
        .eq('employee_name', name)
        .maybeSingle();

      // 2026-06-24: PUT 과 동일한 helper 로 net_salary/pph21_tax/BPJS company
      // 등 파생값 계산 후 함께 insert. 안 그러면 실수령 합계가 0 으로 표시됨.
      const baseFields = {
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
      };
      const computed = computePayslipTotals({
        ...baseFields,
        period: taxPeriod,
        ptkp_category: ptkp,
        employee_npwp: getVal(cols, 'employee_npwp') || null,
      });

      const payload = {
        customer_id: customerId,
        employee_id: null as string | null,
        period: taxPeriod,
        employee_name: name,
        employee_npwp: getVal(cols, 'employee_npwp') || null,
        ptkp_category: ptkp,
        ...baseFields,
        ...computed,
        status: 'DRAFT',
      };

      if (existingPayslip) {
        const { error: updErr } = await admin
          .from('monthly_payslip')
          .update(payload)
          .eq('id', existingPayslip.id);
        if (updErr) {
          errors.push(`Row ${i + 1}: ${name} — payslip update: ${updErr.message}`);
          skipped++;
          continue;
        }
      } else {
        const { error: insErr } = await admin
          .from('monthly_payslip')
          .insert(payload);
        if (insErr) {
          errors.push(`Row ${i + 1}: ${name} — payslip insert: ${insErr.message}`);
          skipped++;
          continue;
        }
      }
      payslipsUpserted++;
      imported++;
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
