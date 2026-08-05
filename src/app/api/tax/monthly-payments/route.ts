import { NextRequest, NextResponse } from 'next/server';
import { loggers } from '@/lib/logger';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import type { RequestWithSession } from '@/types/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { ensureQueueForActivity } from '@/lib/operator/ensure-queue-item';

/**
 * GET /api/tax/monthly-payments?customerId=xxx&year=2025
 * Get monthly payment status for all tax types
 *
 * POST /api/tax/monthly-payments
 * Actions: create, update-payment, generate-schedule, calculate-pph25
 */
async function handleGet(req: RequestWithSession): Promise<Response> {
  const url = new URL(req.url);
  const customerId = url.searchParams.get('customerId');
  const year = parseInt(url.searchParams.get('year') || new Date().getFullYear().toString());
  const { role, userId } = req.session;

  let cid = customerId;
  if (!cid && role === 'CUSTOMER') {
    const { data: c } = await getSupabaseAdmin().from('customer').select('id').eq('user_id', userId).single();
    cid = c?.id;
  }
  if (!cid) return NextResponse.json({ error: 'customerId required' }, { status: 400 });

  const { data: payments, error: queryError } = await getSupabaseAdmin()
    .from('tax_monthly_payment')
    .select('*')
    .eq('customer_id', cid)
    .eq('tax_year', year)
    .order('tax_period', { ascending: true });

  // Table might not exist yet on remote
  if (queryError) {
    loggers.tax.error({ err: queryError }, 'Monthly payment query error');
    return NextResponse.json({
      success: true,
      data: { year, summary: [], totalOutstanding: 0, allPayments: [] },
    });
  }

  // Group by tax type
  const taxTypes = ['PPh21', 'PPh23', 'PPh25', 'PPN', 'PPh_FINAL'];
  const summary = taxTypes.map(type => {
    const typePayments = (payments || []).filter(p => p.tax_type === type);
    const paid = typePayments.filter(p => p.status === 'PAID');
    const overdue = typePayments.filter(p => p.status === 'OVERDUE');
    const totalDue = typePayments.reduce((s, p) => s + (Number(p.amount_due) || 0), 0);
    const totalPaid = typePayments.reduce((s, p) => s + (Number(p.amount_paid) || 0), 0);

    return {
      taxType: type,
      totalMonths: typePayments.length,
      paidMonths: paid.length,
      overdueMonths: overdue.length,
      totalDue,
      totalPaid,
      outstanding: totalDue - totalPaid,
      payments: typePayments,
    };
  });

  const totalOutstanding = summary.reduce((s, t) => s + t.outstanding, 0);

  return NextResponse.json({
    success: true,
    data: { year, summary, totalOutstanding, allPayments: payments || [] },
  });
}

async function handlePost(req: RequestWithSession): Promise<Response> {
  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'generate-schedule': {
        const { customerId, year, taxTypes } = body;
        if (!customerId || !year) return NextResponse.json({ error: 'customerId and year required' }, { status: 400 });

        const schedule = [];
        const types = taxTypes || ['PPh21', 'PPh23', 'PPN'];

        for (const type of types) {
          for (let month = 1; month <= 12; month++) {
            const period = `${year}-${String(month).padStart(2, '0')}`;
            const paymentDeadline = getPaymentDeadline(type, year, month);
            const reportingDeadline = getReportingDeadline(type, year, month);

            schedule.push({
              customer_id: customerId,
              tax_type: type,
              tax_period: period,
              tax_year: year,
              amount_due: 0,
              status: 'UNPAID',
              payment_deadline: paymentDeadline,
              reporting_deadline: reportingDeadline,
            });
          }
        }

        // Upsert (ignore conflicts)
        const { error } = await getSupabaseAdmin()
          .from('tax_monthly_payment')
          .upsert(schedule, { onConflict: 'customer_id,tax_type,tax_period', ignoreDuplicates: true });

        if (error) loggers.tax.error({ err: error }, 'Schedule generation error');

        return NextResponse.json({ success: true, data: { created: schedule.length } });
      }

      case 'record-monthly-tax': {
        // /tax/umkm 마법사 제출 — 고객이 입력한 월 매출/세액을 서버에 기록하고
        // 담당 상담원 워크큐(선납법인세 뷰)로 전달. (2026-08-05 수정요청 25번:
        // 기존 제출 버튼이 alert 스텁이라 고객 입력이 어디에도 저장되지 않았음)
        const { taxType, taxPeriod, amountDue, revenue } = body;
        let customerId = body.customerId as string | undefined;
        if (req.session.role === 'CUSTOMER') {
          // 고객은 항상 본인 customer 로 강제 (임의 customerId 차단)
          const { data: own } = await getSupabaseAdmin()
            .from('customer').select('id').eq('user_id', req.session.userId).maybeSingle();
          customerId = own?.id;
        }
        if (!customerId) return NextResponse.json({ error: 'customerId required' }, { status: 400 });
        if (taxType !== 'PPh_FINAL' && taxType !== 'PPh25') {
          return NextResponse.json({ error: 'taxType must be PPh_FINAL or PPh25' }, { status: 400 });
        }
        if (typeof taxPeriod !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(taxPeriod)) {
          return NextResponse.json({ error: 'taxPeriod must be YYYY-MM' }, { status: 400 });
        }
        const due = Number(amountDue);
        if (!Number.isFinite(due) || due < 0) {
          return NextResponse.json({ error: 'amountDue must be a non-negative number' }, { status: 400 });
        }

        const [yStr, mStr] = taxPeriod.split('-');
        const py = Number(yStr); const pm = Number(mStr);
        const note = revenue != null
          ? `[고객입력] 매출 Rp ${Number(revenue).toLocaleString('id-ID')} → 세액 Rp ${due.toLocaleString('id-ID')}`
          : `[고객입력] 세액 Rp ${due.toLocaleString('id-ID')}`;

        const admin = getSupabaseAdmin();
        const { data: existing } = await admin
          .from('tax_monthly_payment')
          .select('id, status')
          .eq('customer_id', customerId).eq('tax_type', taxType).eq('tax_period', taxPeriod)
          .maybeSingle();

        let rowId: string;
        if (existing) {
          // 납부 상태/NTPN 은 건드리지 않고 고객 입력값만 갱신
          const { error } = await admin.from('tax_monthly_payment')
            .update({ amount_due: due, notes: note })
            .eq('id', existing.id);
          if (error) return NextResponse.json({ error: error.message }, { status: 500 });
          rowId = existing.id;
        } else {
          const { data: inserted, error } = await admin.from('tax_monthly_payment')
            .insert({
              customer_id: customerId,
              tax_type: taxType,
              tax_period: taxPeriod,
              tax_year: py,
              amount_due: due,
              status: 'UNPAID',
              notes: note,
              payment_deadline: getPaymentDeadline(taxType, py, pm),
              reporting_deadline: getReportingDeadline(taxType, py, pm),
            })
            .select('id').single();
          if (error || !inserted) return NextResponse.json({ error: error?.message ?? 'insert failed' }, { status: 500 });
          rowId = inserted.id;
        }

        // 자료 write → 선납법인세 큐 자동 생성/배정 (best-effort, PPh25 도 앵커는 PPh_FINAL)
        await ensureQueueForActivity(admin, customerId, 'PPh_FINAL', taxPeriod);

        return NextResponse.json({ success: true, data: { id: rowId } });
      }

      case 'update-payment': {
        const { paymentId, ntpn, amountPaid, paymentDate, paymentMethod, kodeBilling } = body;
        if (!paymentId) return NextResponse.json({ error: 'paymentId required' }, { status: 400 });

        const updateData: Record<string, unknown> = { status: 'PAID' };
        if (ntpn) updateData.ntpn = ntpn;
        if (amountPaid) updateData.amount_paid = amountPaid;
        if (paymentDate) updateData.payment_date = paymentDate;
        if (paymentMethod) updateData.payment_method = paymentMethod;
        if (kodeBilling) updateData.kode_billing = kodeBilling;

        const { error } = await getSupabaseAdmin()
          .from('tax_monthly_payment')
          .update(updateData)
          .eq('id', paymentId);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // 선납법인세(PPh Final/25) 납부 기록 → 담당 상담원 업무함에 자동 노출 (best-effort).
        const { data: paidRow } = await getSupabaseAdmin()
          .from('tax_monthly_payment')
          .select('customer_id, tax_type, tax_period')
          .eq('id', paymentId).maybeSingle();
        if (paidRow && (paidRow.tax_type === 'PPh_FINAL' || paidRow.tax_type === 'PPh25')) {
          await ensureQueueForActivity(getSupabaseAdmin(), paidRow.customer_id, 'PPh_FINAL', paidRow.tax_period);
        }

        return NextResponse.json({ success: true, message: 'Payment updated' });
      }

      case 'update-filing': {
        const { paymentId: pid, bpeNumber } = body;
        if (!pid) return NextResponse.json({ error: 'paymentId required' }, { status: 400 });

        const { error } = await getSupabaseAdmin()
          .from('tax_monthly_payment')
          .update({
            spt_masa_filed: true,
            spt_masa_filed_at: new Date().toISOString(),
            bpe_number: bpeNumber || null,
          })
          .eq('id', pid);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, message: 'Filing status updated' });
      }

      case 'calculate-pph25': {
        const { customerId: cid, taxYear, annualTaxDue } = body;
        if (!cid || !annualTaxDue) return NextResponse.json({ error: 'customerId and annualTaxDue required' }, { status: 400 });

        const monthlyInstallment = Math.round(annualTaxDue / 12);
        const yr = taxYear || new Date().getFullYear();

        const installments = Array.from({ length: 12 }, (_, i) => ({
          customer_id: cid,
          tax_type: 'PPh25',
          tax_period: `${yr}-${String(i + 1).padStart(2, '0')}`,
          tax_year: yr,
          amount_due: monthlyInstallment,
          status: 'UNPAID',
          payment_deadline: `${yr}-${String(i + 1).padStart(2, '0')}-15`,
          reporting_deadline: `${yr}-${String(i + 1).padStart(2, '0')}-20`,
        }));

        const { error } = await getSupabaseAdmin()
          .from('tax_monthly_payment')
          .upsert(installments, { onConflict: 'customer_id,tax_type,tax_period', ignoreDuplicates: false });

        if (error) loggers.tax.error({ err: error }, 'PPh25 installment upsert error');

        return NextResponse.json({
          success: true,
          data: {
            annualTaxDue,
            monthlyInstallment,
            installments: installments.map(i => ({
              period: i.tax_period,
              amount: i.amount_due,
              deadline: i.payment_deadline,
            })),
          },
        });
      }

      case 'check-overdue': {
        const { customerId: cid2 } = body;
        if (!cid2) return NextResponse.json({ error: 'customerId required' }, { status: 400 });

        const today = new Date().toISOString().slice(0, 10);

        // Mark overdue payments
        await getSupabaseAdmin()
          .from('tax_monthly_payment')
          .update({ status: 'OVERDUE' })
          .eq('customer_id', cid2)
          .eq('status', 'UNPAID')
          .lt('payment_deadline', today);

        // Get overdue items with penalty
        const { data: overdue } = await getSupabaseAdmin()
          .from('tax_monthly_payment')
          .select('*')
          .eq('customer_id', cid2)
          .eq('status', 'OVERDUE');

        const overdueWithPenalty = (overdue || []).map(p => {
          const deadline = new Date(p.payment_deadline);
          const now = new Date();
          const monthsLate = Math.max(1, Math.ceil((now.getTime() - deadline.getTime()) / (30 * 24 * 60 * 60 * 1000)));
          const penalty = Math.round(Number(p.amount_due) * 0.02 * monthsLate); // 2%/month
          return { ...p, monthsLate, penaltyAmount: penalty };
        });

        return NextResponse.json({ success: true, data: { overdue: overdueWithPenalty } });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

function getPaymentDeadline(taxType: string, year: number, month: number): string {
  // Payment deadlines (setor)
  switch (taxType) {
    case 'PPh21': case 'PPh23': return `${year}-${String(month + 1 > 12 ? 1 : month + 1).padStart(2, '0')}-10`;
    case 'PPh25': case 'PPh_FINAL': return `${year}-${String(month + 1 > 12 ? 1 : month + 1).padStart(2, '0')}-15`;
    case 'PPN': {
      const nextMonth = month + 1 > 12 ? 1 : month + 1;
      const nextYear = month + 1 > 12 ? year + 1 : year;
      const lastDay = new Date(nextYear, nextMonth, 0).getDate();
      return `${nextYear}-${String(nextMonth).padStart(2, '0')}-${lastDay}`;
    }
    default: return `${year}-${String(month + 1 > 12 ? 1 : month + 1).padStart(2, '0')}-15`;
  }
}

function getReportingDeadline(taxType: string, year: number, month: number): string {
  switch (taxType) {
    case 'PPh21': case 'PPh23': case 'PPh25': return `${year}-${String(month + 1 > 12 ? 1 : month + 1).padStart(2, '0')}-20`;
    case 'PPN': {
      const nextMonth = month + 1 > 12 ? 1 : month + 1;
      const nextYear = month + 1 > 12 ? year + 1 : year;
      const lastDay = new Date(nextYear, nextMonth, 0).getDate();
      return `${nextYear}-${String(nextMonth).padStart(2, '0')}-${lastDay}`;
    }
    default: return `${year}-${String(month + 1 > 12 ? 1 : month + 1).padStart(2, '0')}-20`;
  }
}

export async function GET(request: NextRequest) {
  return composeMiddleware(requireAuth, blockPlatformAdmin)(request as RequestWithSession, handleGet);
}

export async function POST(request: NextRequest) {
  return composeMiddleware(requireAuth, blockPlatformAdmin)(request as RequestWithSession, handlePost);
}
