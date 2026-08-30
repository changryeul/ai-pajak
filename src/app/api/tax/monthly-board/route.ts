// GET /api/tax/monthly-board?period=YYYY-MM[&customerId=]
//
// 이번 달 신고 보드 (2026-08-30): 월신고 4세목(PPh21/원천세/선납법인세/PPN)의
// 자료 유무 + 신고 큐 단계를 한 번에 반환한다. 신규 테이블 0 — 기존
// 세목 자료 테이블 count + djp_submission_queue 상태 매핑.
import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import type { RequestWithSession } from '@/types/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

// 큐 status → 보드 단계(1~5) 진행도.
//   1 자료입력 / 2 검토 / 3 승인 / 4 ID Billing / 5 납부
// currentStep = 지금 진행중인 단계, doneThrough = 완료된 마지막 단계.
function mapQueue(status: string | null): { doneThrough: number; currentStep: number | null } {
  switch (status) {
    case 'PENDING':
    case 'PENDING_DOCS': return { doneThrough: 1, currentStep: 2 };
    case 'DATA_REVIEW': return { doneThrough: 1, currentStep: 2 };
    case 'PENDING_APPROVAL': return { doneThrough: 2, currentStep: 3 };
    case 'APPROVED': return { doneThrough: 3, currentStep: 4 };
    case 'EBILLING_GENERATED': return { doneThrough: 4, currentStep: 5 };
    case 'PAYMENT_PENDING': return { doneThrough: 4, currentStep: 5 };
    case 'COMPLETED': return { doneThrough: 5, currentStep: null };
    case 'FAILED': return { doneThrough: 0, currentStep: 1 };
    default: return { doneThrough: 0, currentStep: 1 }; // 큐 없음 = 자료입력 단계
  }
}

async function handleGet(req: RequestWithSession): Promise<Response> {
  const url = new URL(req.url);
  const period = url.searchParams.get('period') ?? '';
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
    return NextResponse.json({ error: 'period must be YYYY-MM' }, { status: 400 });
  }
  const admin = getSupabaseAdmin();

  let customerId = url.searchParams.get('customerId') ?? undefined;
  if (req.session.role === 'CUSTOMER') {
    const { data: own } = await admin.from('customer').select('id').eq('user_id', req.session.userId).maybeSingle();
    customerId = own?.id;
  }
  if (!customerId) return NextResponse.json({ error: 'customerId required' }, { status: 400 });

  const [y, m] = period.split('-').map(Number);

  const [profile, payslips, wht, prepaid, ppn, queues] = await Promise.all([
    admin.from('customer').select('is_pkp, is_umkm, npwp_pph25_elected').eq('id', customerId).maybeSingle(),
    admin.from('monthly_payslip').select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId).eq('period', period),
    admin.from('pph23_transaction').select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId).eq('tax_period', period),
    admin.from('tax_monthly_payment').select('id, tax_type, amount_due, status')
      .eq('customer_id', customerId).eq('tax_period', period).in('tax_type', ['PPh_FINAL', 'PPh25']),
    admin.from('ppn_faktur_monthly').select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId).eq('tax_period', period),
    admin.from('djp_submission_queue').select('tax_type, status, amount')
      .eq('customer_id', customerId).eq('tax_period_month', m).eq('tax_period_year', y),
  ]);

  const queueByType: Record<string, { status: string; amount: number }> = {};
  for (const q of queues.data ?? []) {
    // 같은 세목 복수 행이면 가장 진행된 행 기준
    const prev = queueByType[q.tax_type];
    if (!prev || mapQueue(q.status).doneThrough > mapQueue(prev.status).doneThrough) {
      queueByType[q.tax_type] = { status: q.status, amount: Number(q.amount ?? 0) };
    }
  }

  const prepaidRows = prepaid.data ?? [];
  const prepaidAmount = prepaidRows.reduce((s, r) => s + Number(r.amount_due ?? 0), 0);

  const build = (key: string, dataCount: number, queueType: string, applicable: boolean, amount?: number) => {
    const q = queueByType[queueType];
    const steps = q ? mapQueue(q.status) : mapQueue(null);
    // 자료가 있으면 1단계 완료로 승격 (큐 생성 전이라도)
    if (dataCount > 0 && steps.doneThrough < 1) { steps.doneThrough = 1; steps.currentStep = 2; }
    return {
      key,
      applicable,
      dataCount,
      queueStatus: q?.status ?? null,
      amount: amount ?? q?.amount ?? 0,
      doneThrough: applicable ? steps.doneThrough : 0,
      currentStep: applicable ? steps.currentStep : null,
    };
  };

  return NextResponse.json({
    success: true,
    data: {
      period,
      profile: {
        isPkp: profile.data?.is_pkp ?? false,
        isUmkm: profile.data?.is_umkm ?? false,
        pph25Elected: profile.data?.npwp_pph25_elected ?? false,
      },
      taxes: [
        build('pph21', payslips.count ?? 0, 'PPh21', true),
        build('withholding', wht.count ?? 0, 'PPh23', true),
        build('prepaid', prepaidRows.length, 'PPh_FINAL', true, prepaidAmount),
        build('ppn', ppn.count ?? 0, 'PPN', profile.data?.is_pkp ?? false),
      ],
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(request: NextRequest) {
  return composeMiddleware(requireAuth, blockPlatformAdmin)(request as RequestWithSession, handleGet);
}
