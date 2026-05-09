import { NextRequest } from 'next/server';
import { customerOperation } from '@/middleware/compose';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import type { RequestWithSession } from '@/types/auth';

/**
 * GET /api/tax/closing-filings
 *
 * Returns the customer's annual closing history (UMKM / PPh25).
 * Each row joins tax_closing_session + closing_submission + closing_id_billing
 * so /reports + /filings can show the closing alongside monthly SPT history.
 *
 * For consultants, we accept ?customerId= and scope by their assigned partner.
 * For customers, we ignore customerId and use the auth user's customer row.
 */
interface SessionRow {
  id: string;
  fiscal_year: number;
  closing_type: 'UMKM' | 'PPH25';
  status: 'IN_PROGRESS' | 'COMPLETED' | 'ARCHIVED';
  current_step: string;
  created_at: string;
  updated_at: string;
}

interface SubmissionRow {
  session_id: string;
  status: string;
  channel: string;
  bpe_number: string | null;
  bpe_uploaded_at: string | null;
  ntpn: string | null;
  submitted_at: string;
  completed_at: string | null;
  failure_reason: string | null;
}

interface IdBillingRow {
  session_id: string;
  billing_code: string;
  amount: number;
  status: string;
  ntpn: string | null;
  billing_date: string;
}

async function handleGet(req: RequestWithSession): Promise<Response> {
  try {
    const url = new URL(req.url);
    const customerIdParam = url.searchParams.get('customerId');
    const admin = getSupabaseAdmin();

    let customerId = customerIdParam;
    if (req.session.role === 'CUSTOMER') {
      const { data: customer } = await admin
        .from('customer')
        .select('id')
        .eq('user_id', req.session.userId)
        .single();
      if (!customer) {
        return Response.json({ success: true, data: [] });
      }
      customerId = customer.id;
    }

    if (!customerId) {
      return Response.json({ error: 'customerId required' }, { status: 400 });
    }

    const { data: sessions } = await admin
      .from('tax_closing_session')
      .select('id, fiscal_year, closing_type, status, current_step, created_at, updated_at')
      .eq('customer_id', customerId)
      .order('fiscal_year', { ascending: false });

    const sessionRows = (sessions ?? []) as SessionRow[];
    if (sessionRows.length === 0) {
      return Response.json({ success: true, data: [] });
    }

    const ids = sessionRows.map((s) => s.id);

    const [{ data: subs }, { data: bills }] = await Promise.all([
      admin
        .from('closing_submission')
        .select('session_id, status, channel, bpe_number, bpe_uploaded_at, ntpn, submitted_at, completed_at, failure_reason')
        .in('session_id', ids),
      admin
        .from('closing_id_billing')
        .select('session_id, billing_code, amount, status, ntpn, billing_date')
        .in('session_id', ids),
    ]);

    const subBySession = new Map<string, SubmissionRow>();
    for (const s of (subs ?? []) as SubmissionRow[]) subBySession.set(s.session_id, s);
    const billBySession = new Map<string, IdBillingRow>();
    for (const b of (bills ?? []) as IdBillingRow[]) billBySession.set(b.session_id, b);

    const data = sessionRows.map((s) => {
      const sub = subBySession.get(s.id) ?? null;
      const bill = billBySession.get(s.id) ?? null;
      return {
        kind: 'CLOSING' as const,
        sessionId: s.id,
        fiscalYear: s.fiscal_year,
        closingType: s.closing_type, // 'UMKM' | 'PPH25'
        sessionStatus: s.status, // wizard 진행 상태
        wizardStep: s.current_step,
        // submission(운영팀 큐 동기화) 상태
        submission: sub
          ? {
              status: sub.status, // SUBMITTED / OPERATOR_REVIEW / PROCESSING / BPE_UPLOADED / COMPLETED / FAILED
              channel: sub.channel,
              bpeNumber: sub.bpe_number,
              bpeUploadedAt: sub.bpe_uploaded_at,
              ntpn: sub.ntpn,
              submittedAt: sub.submitted_at,
              completedAt: sub.completed_at,
              failureReason: sub.failure_reason,
            }
          : null,
        // ID Billing(납부 코드)
        idBilling: bill
          ? {
              billingCode: bill.billing_code,
              amount: Number(bill.amount),
              status: bill.status, // PENDING / PAID / EXPIRED / CANCELLED
              ntpn: bill.ntpn,
              billingDate: bill.billing_date,
            }
          : null,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
      };
    });

    return Response.json({ success: true, data });
  } catch (error) {
    loggers.api.error({ err: error }, 'closing-filings fetch failed');
    return Response.json({ error: 'Failed to fetch closing filings' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return customerOperation()(request as RequestWithSession, handleGet);
}
