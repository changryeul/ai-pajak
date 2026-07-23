/**
 * POST /api/id-billing/send
 *
 * 발행된 ID Billing 을 고객에게 전송 (v19 §4 — 미전송/전송완료).
 * body: { issuanceIds: string[] }
 *
 * 이메일은 best-effort (Resend 미설정/실패해도 전송 마크는 남기지 않고
 * 에러 반환 대신 skipped 로 보고) — 고객 이메일이 없으면 해당 건 skip.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireBillingIssuer } from '@/middleware/requireBillingIssuer';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { resolveIssuerScope } from '@/lib/id-billing/board-data';
import { sendEmail } from '@/lib/notifications/email-service';
import { loggers } from '@/lib/logger';
import type { RequestWithSession } from '@/types/auth';

const bodySchema = z.object({
  issuanceIds: z.array(z.string().uuid()).min(1).max(100),
});

function fmtRp(n: number): string {
  return `Rp ${Number(n).toLocaleString('id-ID')}`;
}

async function handlePost(req: RequestWithSession): Promise<Response> {
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', details: parsed.error.flatten() }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const scope = await resolveIssuerScope(admin, req.session.userId, req.session.role);
  if (!scope) {
    return NextResponse.json({ error: 'No active tax partner scope for this account' }, { status: 404 });
  }

  const { data: rows, error } = await admin
    .from('id_billing_issuance')
    .select('id, serial_no, tax_type, tax_period, amount, billing_code, status, customer_email, customer_id')
    .in('id', parsed.data.issuanceIds)
    .eq('tax_partner_id', scope.taxPartnerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rows || rows.length === 0) {
    return NextResponse.json({ error: 'No issuance rows found in your scope' }, { status: 404 });
  }

  let sent = 0;
  const skipped: Array<{ id: string; reason: string }> = [];

  for (const row of rows) {
    if (row.status === 'CANCELLED') { skipped.push({ id: row.id, reason: 'cancelled' }); continue; }
    if (!row.customer_email) { skipped.push({ id: row.id, reason: 'no-email' }); continue; }

    // 고객 본문은 인니어 (서버 응답 언어 정책).
    let emailed = false;
    try {
      emailed = await sendEmail({
        to: row.customer_email,
        subject: `[AI Pajak] ID Billing ${row.tax_type} ${row.tax_period} — ${fmtRp(Number(row.amount))}`,
        html: [
          `<p>ID Billing untuk pajak <strong>${row.tax_type}</strong> masa <strong>${row.tax_period}</strong> telah diterbitkan.</p>`,
          `<ul>`,
          `<li>Nomor referensi: <strong>${row.serial_no}</strong></li>`,
          row.billing_code ? `<li>Kode Billing (Coretax): <strong>${row.billing_code}</strong></li>` : '',
          `<li>Jumlah: <strong>${fmtRp(Number(row.amount))}</strong></li>`,
          `</ul>`,
          `<p>Silakan lakukan pembayaran melalui bank/ATM/internet banking. Setelah pembayaran, NTPN dibuat otomatis di Coretax dan pelaporan dianggap selesai.</p>`,
        ].join(''),
      });
    } catch (err) {
      loggers.api.warn({ err, issuanceId: row.id }, 'ID Billing email send failed');
    }

    // 이메일 실패해도 전송 시도로 상태는 SENT 로 마크하지 않고 skip 처리 —
    // 미전송 상태가 남아 있어야 재시도 버튼이 유효하다.
    if (!emailed) { skipped.push({ id: row.id, reason: 'email-failed' }); continue; }

    await admin
      .from('id_billing_issuance')
      .update({ status: 'SENT', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', row.id);
    sent++;
  }

  return NextResponse.json({ success: true, data: { sent, skipped } });
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireBillingIssuer,
    withAudit('ID_BILLING_SEND'),
  )(request as RequestWithSession, handlePost);
}
