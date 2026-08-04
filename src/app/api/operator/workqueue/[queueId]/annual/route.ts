import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { evaluateAnnualFlags } from '@/lib/operator/annual-review-flags';

const OPERATOR_ROLES = ['TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];

/**
 * GET /api/operator/workqueue/[queueId]/annual
 *
 * 연 신고(SPT Tahunan) 워크큐 상세 — queue 행의 closing_session_id 로
 * 결산 wizard 세션 + 증빙 문서 + DJP 제출/BPE 상태를 묶어 반환한다.
 * closing_session_id 가 없는 수동 케이스도 flags(red) 로 정상 응답.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ queueId: string }> }) {
  const { queueId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: roleRow } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).eq('is_active', true).maybeSingle();
  if (!roleRow || !OPERATOR_ROLES.includes(roleRow.role)) {
    return NextResponse.json({ error: 'Operator access required' }, { status: 403 });
  }

  const admin = getSupabaseAdmin();

  const { data: q } = await admin
    .from('djp_submission_queue')
    .select('id, customer_id, tax_type, tax_period_year, status, closing_session_id, service_label')
    .eq('id', queueId).maybeSingle();
  if (!q) return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });

  let session: {
    closing_type: string; fiscal_year: number; current_step: string;
    status: string; signed_statements_uploaded: boolean;
  } | null = null;
  let documents: Array<{ id: string; doc_type: string; file_name: string; uploaded_at: string; size_bytes: number | null }> = [];
  let submission: {
    status: string; channel: string; submitted_at: string | null; completed_at: string | null;
    bpe_number: string | null; ntpn: string | null; failure_reason: string | null;
  } | null = null;

  if (q.closing_session_id) {
    const [{ data: s }, { data: docs }, { data: sub }] = await Promise.all([
      admin.from('tax_closing_session')
        .select('closing_type, fiscal_year, current_step, status, signed_statements_uploaded')
        .eq('id', q.closing_session_id).maybeSingle(),
      admin.from('closing_document')
        .select('id, doc_type, file_name, uploaded_at, size_bytes')
        .eq('session_id', q.closing_session_id).order('uploaded_at', { ascending: true }),
      admin.from('closing_submission')
        .select('status, channel, submitted_at, completed_at, bpe_number, ntpn, failure_reason')
        .eq('session_id', q.closing_session_id).maybeSingle(),
    ]);
    session = s ?? null;
    documents = docs ?? [];
    submission = sub ?? null;
  }

  const flags = evaluateAnnualFlags({
    hasSession: !!session,
    sessionStatus: session?.status ?? null,
    signedStatementsUploaded: session?.signed_statements_uploaded ?? false,
    documentCount: documents.length,
    submissionStatus: submission?.status ?? null,
    bpeNumber: submission?.bpe_number ?? null,
    failureReason: submission?.failure_reason ?? null,
  });

  const rows = documents.map(d => ({
    id: d.id,
    docType: d.doc_type,
    fileName: d.file_name,
    uploadedAt: d.uploaded_at,
    sizeBytes: d.size_bytes === null ? null : Number(d.size_bytes),
  }));

  const summary = {
    closingType: session?.closing_type ?? null,        // 'UMKM' | 'PPH25' | null
    serviceLabel: q.service_label ?? null,
    fiscalYear: q.tax_period_year,
    currentStep: session?.current_step ?? null,
    sessionStatus: session?.status ?? null,
    signedStatementsUploaded: session?.signed_statements_uploaded ?? false,
    documentCount: rows.length,
    submissionStatus: submission?.status ?? null,
    submissionChannel: submission?.channel ?? null,
    submittedAt: submission?.submitted_at ?? null,
    bpeNumber: submission?.bpe_number ?? null,
    ntpn: submission?.ntpn ?? null,
  };

  return NextResponse.json({
    success: true,
    data: {
      queueId: q.id,
      customerId: q.customer_id,
      fiscalYear: q.tax_period_year,
      status: q.status,
      summary,
      flags,
      rows,
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
