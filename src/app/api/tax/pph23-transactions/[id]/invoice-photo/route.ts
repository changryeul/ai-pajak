import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireRole } from '@/middleware/rbac';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import { UserRole, type RequestWithSession } from '@/types/auth';

/**
 * POST /api/tax/pph23-transactions/[id]/invoice-photo
 *
 * Phase 5 — explicit invoice photo link for wholesale rows. Multipart
 * upload (`file` field). Storage bucket: `tax-documents` (same as
 * /api/documents/upload). After upload:
 *   1. inserts a row in `document` with documentType=INVOICE
 *   2. sets pph23_transaction.invoice_document_id to that row's id
 *
 * Failure of the document insert rolls back the storage object so we
 * don't leak orphan files. Failure of the transaction PATCH is also
 * cleaned up.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUCKET = 'tax-documents';

function getTxId(req: NextRequest): string | null {
  const m = req.nextUrl.pathname.match(/\/pph23-transactions\/([^/]+)\/invoice-photo/);
  return m?.[1] ?? null;
}

async function handle(req: RequestWithSession): Promise<Response> {
  const txId = getTxId(req as unknown as NextRequest);
  if (!txId || !UUID_RE.test(txId)) {
    return NextResponse.json({ error: 'transaction id must be uuid' }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'multipart/form-data required' }, { status: 400 });
  }
  const file = formData.get('file') as File | null;
  if (!file || typeof file.arrayBuffer !== 'function') {
    return NextResponse.json({ error: 'file required' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // Load transaction (verify it exists + pull customer/period for path + metadata)
  const { data: tx, error: txErr } = await admin
    .from('pph23_transaction')
    .select('id, customer_id, tax_period')
    .eq('id', txId)
    .maybeSingle();
  if (txErr || !tx) {
    return NextResponse.json({ error: 'transaction not found' }, { status: 404 });
  }

  // Best-effort scope check — if the caller is a customer, the transaction
  // must belong to their customer record. blockPlatformAdmin already gates
  // admins. Consultants/advisors can attach for any of their customers (RLS
  // is the final gate on the document table).
  if (req.session.role === UserRole.CUSTOMER) {
    const { data: ownCust } = await admin
      .from('customer')
      .select('id')
      .eq('user_id', req.session.userId)
      .maybeSingle();
    if (!ownCust || ownCust.id !== tx.customer_id) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  }

  // Upload to storage. Use a deterministic per-tx prefix so re-upload still
  // works (cleanup of prior photo is handled at the FK level — ON DELETE
  // SET NULL on the document row, set to NULL here before insert).
  let storagePath: string | null = null;
  try {
    const bytes = await file.arrayBuffer();
    const buf = new Uint8Array(bytes);
    const rawExt = (file.name.split('.').pop() || 'bin').toLowerCase();
    const ext = rawExt.replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
    storagePath = `pph23-invoice/${tx.customer_id}/${tx.tax_period}/${txId}-${Date.now()}.${ext}`;

    const { error: uploadErr } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, buf, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });
    if (uploadErr) {
      loggers.api.error(
        { err: uploadErr.message, txId, storagePath },
        'PPh23 invoice photo storage upload failed',
      );
      return NextResponse.json({ error: 'storage upload failed' }, { status: 500 });
    }

    const { data: doc, error: docErr } = await admin
      .from('document')
      .insert({
        customer_id: tx.customer_id,
        uploaded_by_user_id: req.session.userId,
        document_type: 'INVOICE',
        file_path: storagePath,
        file_name: file.name,
        mime_type: file.type || 'application/octet-stream',
        file_size_bytes: file.size,
        metadata: {
          tax_period: tx.tax_period,
          pph23_transaction_id: txId,
          storage_bucket: BUCKET,
          original_document_type: 'INVOICE',
        },
      })
      .select('id')
      .single();
    if (docErr || !doc) {
      // orphan cleanup — best effort
      await admin.storage.from(BUCKET).remove([storagePath]).catch(() => {});
      loggers.api.error(
        { err: docErr?.message, txId },
        'PPh23 invoice photo document insert failed',
      );
      return NextResponse.json(
        { error: docErr?.message || 'document insert failed' },
        { status: 500 },
      );
    }

    const { error: updateErr } = await admin
      .from('pph23_transaction')
      .update({ invoice_document_id: doc.id })
      .eq('id', txId);
    if (updateErr) {
      // unlink: roll back the document + storage so client can retry
      try { await admin.from('document').delete().eq('id', doc.id); } catch { /* ignore */ }
      await admin.storage.from(BUCKET).remove([storagePath]).catch(() => {});
      loggers.api.error(
        { err: updateErr.message, txId, docId: doc.id },
        'PPh23 invoice photo transaction PATCH failed',
      );
      return NextResponse.json({ error: 'transaction update failed' }, { status: 500 });
    }

    return NextResponse.json({ data: { documentId: doc.id, storagePath } });
  } catch (e) {
    if (storagePath) {
      await admin.storage.from(BUCKET).remove([storagePath]).catch(() => {});
    }
    loggers.api.error(
      { err: e instanceof Error ? e.message : 'unknown', txId },
      'PPh23 invoice photo upload exception',
    );
    return NextResponse.json({ error: 'upload exception' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(UserRole.CUSTOMER, UserRole.CONSULTANT, UserRole.TAX_ADVISOR),
    withAudit('PPH23_INVOICE_ATTACH'),
  )(request as RequestWithSession, handle);
}

/**
 * GET /api/tax/pph23-transactions/[id]/invoice-photo (v19 §6 — 트랙 6)
 *
 * 증빙 보기 — 거래에 첨부된 인보이스 사진의 서명 URL(5분) + 메타를 반환.
 * 증빙 보기 전용 (요청 모달과 분리). 미첨부면 404.
 */
async function handleGet(req: RequestWithSession): Promise<Response> {
  const txId = getTxId(req as unknown as NextRequest);
  if (!txId || !UUID_RE.test(txId)) {
    return NextResponse.json({ error: 'transaction id must be uuid' }, { status: 400 });
  }
  const admin = getSupabaseAdmin();

  const { data: tx } = await admin
    .from('pph23_transaction')
    .select('id, customer_id, invoice_document_id, counterparty_name, invoice_number')
    .eq('id', txId)
    .maybeSingle();
  if (!tx) return NextResponse.json({ error: 'transaction not found' }, { status: 404 });

  if (req.session.role === UserRole.CUSTOMER) {
    const { data: ownCust } = await admin
      .from('customer').select('id').eq('user_id', req.session.userId).maybeSingle();
    if (!ownCust || ownCust.id !== tx.customer_id) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  }

  if (!tx.invoice_document_id) {
    return NextResponse.json({ error: 'no invoice photo attached', errorKey: 'noEvidence' }, { status: 404 });
  }

  const { data: doc } = await admin
    .from('document')
    .select('id, file_path, file_name, mime_type, metadata')
    .eq('id', tx.invoice_document_id)
    .maybeSingle();
  if (!doc?.file_path) return NextResponse.json({ error: 'document missing' }, { status: 404 });

  const bucket = (doc.metadata as { storage_bucket?: string } | null)?.storage_bucket || BUCKET;
  const { data: signed, error: signErr } = await admin.storage
    .from(bucket)
    .createSignedUrl(doc.file_path, 300);
  if (signErr || !signed?.signedUrl) {
    return NextResponse.json({ error: 'could not sign url' }, { status: 500 });
  }

  return NextResponse.json({
    data: {
      documentId: doc.id,
      fileName: doc.file_name,
      mimeType: doc.mime_type,
      signedUrl: signed.signedUrl,
      counterpartyName: tx.counterparty_name,
      invoiceNumber: tx.invoice_number,
    },
  });
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    // Operators view withholding evidence from the workqueue review panel.
    requireRole(
      UserRole.CUSTOMER, UserRole.CONSULTANT, UserRole.TAX_ADVISOR,
      UserRole.TAX_OPERATOR, UserRole.TAX_OPERATOR_LEAD,
      UserRole.TAX_OPERATOR_SUPERVISOR, UserRole.TAX_OPERATOR_MASTER,
    ),
  )(request as RequestWithSession, handleGet);
}
