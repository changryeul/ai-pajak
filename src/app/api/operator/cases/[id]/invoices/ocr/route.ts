import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { InvoiceClassifier } from '@/lib/ai/invoice-classifier';
import { TaxResolutionEngine } from '@/lib/tax/tax-resolution-engine';
import { DJP_TAX_CODES } from '@/config/constants';
import type { ServiceCategory, ResolvedTaxType, TransactionContext } from '@/types';

const OPERATOR_ROLES = ['TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];

interface ReviewItem {
  state?: string;
  invoice?: string;
  vendor?: string;
  taxKind?: string;
  taxCode?: string;
  tax?: number;
  dpp?: number;
  reason?: string;
  finalTaxKind?: string;
  finalTaxCode?: string;
  finalTax?: number;
  finalDpp?: number;
  vendorOverride?: string;
  note?: string | null;
  checkedAt?: string;
  requestedAt?: string;
  // OCR 메타.
  source?: 'manual' | 'ocr';
  ocrConfidence?: number;
  ocrDocUrl?: string;
  ocrInvoiceNumber?: string;
  ocrInvoiceDate?: string;
}

interface ReviewSummary {
  items?: ReviewItem[];
  reviewRequired?: number;
  generatedAt?: string;
  finalReviewedAt?: string | null;
}

/** ResolvedTaxType → 사람이 읽는 라벨 + DJP KAP 코드 + JENIS_SETORAN. */
function mapTaxType(taxType: ResolvedTaxType): { taxKind: string; taxCode: string } {
  switch (taxType) {
    case 'PPh23':  return { taxKind: 'PPh23',   taxCode: `${DJP_TAX_CODES.PPH23.JENIS_PAJAK}-${DJP_TAX_CODES.PPH23.JENIS_SETORAN.MONTHLY}` };
    case 'PPh4_2': return { taxKind: 'PPh4(2)', taxCode: `${DJP_TAX_CODES.PPH4_2.JENIS_PAJAK}-${DJP_TAX_CODES.PPH4_2.JENIS_SETORAN.FINAL}` };
    case 'PPh26':  return { taxKind: 'PPh26',   taxCode: `${DJP_TAX_CODES.PPH26.JENIS_PAJAK}-${DJP_TAX_CODES.PPH26.JENIS_SETORAN.MONTHLY}` };
    case 'PPh22':  return { taxKind: 'PPh22',   taxCode: '411122-100' };
    case 'PPh21':  return { taxKind: 'PPh21',   taxCode: `${DJP_TAX_CODES.PPH21.JENIS_PAJAK}-${DJP_TAX_CODES.PPH21.JENIS_SETORAN.MONTHLY}` };
    case 'PPh15':  return { taxKind: 'PPh15',   taxCode: '411123-100' };
    case 'PPN':    return { taxKind: 'PPN',     taxCode: `${DJP_TAX_CODES.PPN.JENIS_PAJAK}-${DJP_TAX_CODES.PPN.JENIS_SETORAN.MONTHLY}` };
    default:       return { taxKind: '미분류',  taxCode: '—' };
  }
}

/**
 * POST /api/operator/cases/:id/invoices/ocr
 *
 * 상담원이 invoice 이미지/PDF 파일을 업로드 → Claude Vision으로 분류 →
 * TaxResolutionEngine으로 PPh 자동 추정 → review_summary.items에 새 ReviewItem 추가.
 *
 * Body: { fileBase64: string, mimeType: 'image/jpeg' | 'image/png' | ..., docUrl?: string }
 *
 * 응답: { success, data: { item, reviewRequired, classification } }
 *
 * 가드:
 *   - 본인 케이스만 가능 (operator_id === me)
 *
 * 부수효과:
 *   - djp_submission_queue.review_summary.items 에 새 항목 push
 *   - case_audit_log INSTRUCTED (kind='invoice-ocr') 누적
 *   - coretax_step_log step='OCR' action='extracted' (안전한 try/catch — 테이블 없어도 무시)
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = getSupabaseAdmin();
  const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', user.id).eq('is_active', true);
  const role = roles?.map(r => r.role).find(r => OPERATOR_ROLES.includes(r));
  if (!role) return NextResponse.json({ error: 'Operator access required' }, { status: 403 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const { fileBase64, mimeType, docUrl } = body as { fileBase64?: string; mimeType?: string; docUrl?: string };
  if (!fileBase64) return NextResponse.json({ error: 'fileBase64 required' }, { status: 400 });

  const { data: caseRow } = await admin
    .from('djp_submission_queue')
    .select('id, operator_id, status, review_summary')
    .eq('id', id).maybeSingle();
  if (!caseRow) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: meOp } = await admin.from('tax_operators').select('id, employee_id, name').eq('user_id', user.id).maybeSingle();
  if (meOp?.id && caseRow.operator_id !== meOp.id) {
    return NextResponse.json({ error: 'Forbidden — not your case' }, { status: 403 });
  }
  const actorLabel = meOp ? `${meOp.name} (${meOp.employee_id})` : (user.email ?? 'system');

  // 1) Claude Vision 분류.
  let classification;
  try {
    classification = await InvoiceClassifier.classify(fileBase64, mimeType ?? 'image/jpeg');
  } catch (err) {
    return NextResponse.json({ error: `OCR 실패: ${(err as Error).message}` }, { status: 502 });
  }

  // 2) TaxResolutionEngine으로 PPh 자동 추정.
  const ctxTr: TransactionContext = {
    grossAmount: classification.grossAmount,
    transactionDate: classification.invoiceDate || new Date().toISOString().slice(0, 10),
    description: classification.description,
    serviceCategory: (classification.serviceCategory || 'SERVICE') as ServiceCategory,
    recipientType: 'RESIDENT',
    recipientNpwp: classification.counterpartyNpwp,
    recipientIsEntity: true,
  };
  const resolution = TaxResolutionEngine.resolve(ctxTr);
  const { taxKind, taxCode } = mapTaxType(resolution.taxType);

  // 3) ReviewItem 생성 + push.
  const rs = (caseRow.review_summary ?? { items: [] }) as ReviewSummary;
  const items: ReviewItem[] = rs.items ?? [];
  const seq = items.length + 1;
  const invoiceTag = `INV-W-${String(seq).padStart(3, '0')}`;
  const isHighConfidence = (classification.confidence ?? 0) >= 0.7;

  const newItem: ReviewItem = {
    invoice: invoiceTag,
    vendor: classification.counterpartyName || '미상',
    taxKind,
    taxCode,
    tax: Math.round(resolution.taxAmount),
    dpp: Math.round(classification.grossAmount),
    state: isHighConfidence ? '자동확인' : 'AI 확인필요',
    reason: isHighConfidence ? '' : `AI 신뢰도 ${Math.round((classification.confidence ?? 0) * 100)}% — 사람이 확인하세요`,
    source: 'ocr',
    ocrConfidence: classification.confidence,
    ocrDocUrl: docUrl,
    ocrInvoiceNumber: classification.invoiceNumber,
    ocrInvoiceDate: classification.invoiceDate,
  };
  items.push(newItem);
  const reviewRequired = items.filter(i => i.state !== '자동확인' && i.state !== '자료요청').length;
  const newRs: ReviewSummary = { ...rs, items, reviewRequired, generatedAt: rs.generatedAt ?? new Date().toISOString() };

  // status: PENDING이면 DATA_REVIEW로 자동 진전 (검토 시작).
  const updatePayload: Record<string, unknown> = { review_summary: newRs };
  if (caseRow.status === 'PENDING') updatePayload.status = 'DATA_REVIEW';

  const { error: upErr } = await admin.from('djp_submission_queue').update(updatePayload).eq('id', id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // 4) 감사로그 누적.
  try {
    await admin.from('case_audit_log').insert({
      case_id: id, event_type: 'INSTRUCTED',
      actor_user_id: user.id, actor_label: actorLabel,
      payload: {
        kind: 'invoice-ocr',
        invoice: invoiceTag,
        vendor: newItem.vendor,
        taxKind: newItem.taxKind,
        taxCode: newItem.taxCode,
        confidence: classification.confidence,
        reason: resolution.reason,
      },
    });
  } catch { /* non-blocking */ }

  // coretax_step_log은 step='OCR'로도 누적해두면 history 화면에 한 줄 노출 가능.
  try {
    await admin.from('coretax_step_log').insert({
      case_id: id, step: 'OCR', action: 'extracted',
      value: { invoice: invoiceTag, taxKind, taxCode, confidence: classification.confidence },
      actor_user_id: user.id, actor_label: actorLabel,
    });
  } catch { /* table missing in some envs, ignore */ }

  return NextResponse.json({
    success: true,
    data: {
      item: newItem,
      reviewRequired,
      classification: {
        confidence: classification.confidence,
        reasoning: classification.reasoning,
        resolution: { taxType: resolution.taxType, rate: resolution.rate, reason: resolution.reason, legalBasis: resolution.legalBasis },
      },
    },
  });
}
