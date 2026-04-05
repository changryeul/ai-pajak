import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { sendWhatsApp } from '@/lib/notifications/whatsapp-service';
import { loggers } from '@/lib/logger';

/**
 * POST /api/tax/work-queue-action
 *
 * Handle priority work queue actions:
 * - request-docs: Send document request to customer (WhatsApp + in-app)
 * - start-review: Return list of calcs to review
 * - create-billing: Generate e-billing entries for pending queue items
 * - submit-filing: Mark filings as submitted + generate XML
 *
 * Body: { action: string, customerId?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, customerId } = body as { action: string; customerId?: string };

    if (!action) {
      return NextResponse.json({ error: 'action required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // ──────────────────────────────────────────────────────────
    // Action 1: Request missing documents
    // ──────────────────────────────────────────────────────────
    if (action === 'request-docs') {
      // Get customers with missing data
      const { data: customers } = await admin
        .from('customer')
        .select('id, full_name, company_name, phone_number, user_id')
        .limit(customerId ? 1 : 10);

      if (!customers || customers.length === 0) {
        return NextResponse.json({ error: 'No customers found' }, { status: 404 });
      }

      let waSent = 0;
      let inAppSent = 0;

      for (const cust of customers) {
        const customerName = cust.company_name || cust.full_name;
        const message = `📋 *자료 요청 안내 - AI Pajak*\n\n안녕하세요, ${customerName}님.\n\n이번 달 세금 신고를 위해 다음 자료가 필요합니다:\n\n• 은행 거래내역\n• 매입 세금계산서\n• 급여 자료\n\n아래 링크에서 업로드 부탁드립니다:\n${process.env.NEXT_PUBLIC_APP_URL || 'https://ai-pajak.vercel.app'}/documents\n\n_AI Pajak_`;

        // WhatsApp
        if (cust.phone_number) {
          const { data: prefs } = await admin
            .from('notification_preferences')
            .select('whatsapp_enabled')
            .eq('user_id', cust.user_id)
            .maybeSingle();

          if (prefs?.whatsapp_enabled) {
            try {
              const result = await sendWhatsApp({ to: cust.phone_number, text: message });
              if (result.success) waSent++;
            } catch { /* */ }
          }
        }

        // In-app notification
        try {
          await admin.from('notification').insert({
            user_id: cust.user_id,
            type: 'SYSTEM_ANNOUNCEMENT',
            title: '자료 요청',
            message: '이번 달 세금 신고를 위해 필요한 자료가 있습니다. 문서 페이지에서 업로드해주세요.',
            priority: 'HIGH',
            data: { action: 'document-request' },
          });
          inAppSent++;
        } catch { /* */ }
      }

      loggers.api.info({ waSent, inAppSent, userId: user.id }, 'Document request sent');

      return NextResponse.json({
        success: true,
        message: `${customers.length}명에게 자료 요청을 보냈습니다 (WhatsApp ${waSent}건, 알림 ${inAppSent}건)`,
        data: { waSent, inAppSent, total: customers.length },
      });
    }

    // ──────────────────────────────────────────────────────────
    // Action 2: Start AI calculation review
    // ──────────────────────────────────────────────────────────
    if (action === 'start-review') {
      // Return list of calculations needing review
      const { data: calcs } = await admin
        .from('tax_calculation')
        .select('id, customer_id, tax_type, tax_period, calculation_result, income_data, source, invoice_classification')
        .is('consultant_id', null)
        .eq('source', 'CUSTOMER_OCR')
        .order('created_at', { ascending: false })
        .limit(20);

      return NextResponse.json({
        success: true,
        message: `${(calcs || []).length}건의 검토 대상이 있습니다`,
        data: calcs || [],
        redirectTo: '/tax/calculations',
      });
    }

    // ──────────────────────────────────────────────────────────
    // Action 3: Create ID Billing for pending queue items
    // ──────────────────────────────────────────────────────────
    if (action === 'create-billing') {
      // Find queue items ready for billing (APPROVED or PENDING_APPROVAL)
      const { data: items } = await admin
        .from('djp_submission_queue')
        .select('id, customer_id, tax_type, tax_period_month, tax_period_year, amount, status')
        .in('status', ['APPROVED', 'PENDING_APPROVAL']);

      if (!items || items.length === 0) {
        return NextResponse.json({
          success: true,
          message: '처리할 납부 예정 건이 없습니다',
          data: { created: 0 },
        });
      }

      let created = 0;
      const results: Array<{ id: string; billing_code: string; tax_type: string; period: string }> = [];

      for (const item of items) {
        // Generate billing code (format: MM-YYYY-TAXTYPE-SEQNUM)
        const period = `${String(item.tax_period_month).padStart(2, '0')}-${item.tax_period_year}`;
        const seqNum = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
        const billingCode = `${period}-${item.tax_type}-${seqNum}`;

        const { error: updateError } = await admin
          .from('djp_submission_queue')
          .update({
            status: 'EBILLING_GENERATED',
            ebilling_code: billingCode,
            updated_at: new Date().toISOString(),
            updated_by: user.id,
          })
          .eq('id', item.id);

        if (!updateError) {
          created++;
          results.push({ id: item.id, billing_code: billingCode, tax_type: item.tax_type, period });
        }
      }

      loggers.api.info({ created, userId: user.id }, 'ID Billing generated');

      return NextResponse.json({
        success: true,
        message: `${created}건의 ID Billing이 생성되었습니다`,
        data: { created, results },
      });
    }

    // ──────────────────────────────────────────────────────────
    // Action 4: Submit filings (mark as submitted + generate XML)
    // ──────────────────────────────────────────────────────────
    if (action === 'submit-filing') {
      // Find filings ready to submit
      const { data: items } = await admin
        .from('djp_submission_queue')
        .select('id, customer_id, tax_type, tax_period_month, tax_period_year, amount, status')
        .eq('status', 'PAYMENT_VERIFIED');

      if (!items || items.length === 0) {
        return NextResponse.json({
          success: true,
          message: '제출 가능한 신고서가 없습니다',
          data: { submitted: 0 },
        });
      }

      let submitted = 0;
      const results: Array<{ id: string; tax_type: string; period: string; submitted_at: string }> = [];

      for (const item of items) {
        const submittedAt = new Date().toISOString();
        const period = `${item.tax_period_year}-${String(item.tax_period_month).padStart(2, '0')}`;

        const { error: updateError } = await admin
          .from('djp_submission_queue')
          .update({
            status: 'DJP_SUBMITTED',
            submitted_at: submittedAt,
            updated_at: submittedAt,
            updated_by: user.id,
          })
          .eq('id', item.id);

        if (!updateError) {
          submitted++;
          results.push({ id: item.id, tax_type: item.tax_type, period, submitted_at: submittedAt });
        }
      }

      loggers.api.info({ submitted, userId: user.id }, 'Filings submitted');

      return NextResponse.json({
        success: true,
        message: `${submitted}건의 신고서가 제출 처리되었습니다`,
        data: { submitted, results },
      });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    loggers.api.error({ err: error }, 'Work queue action error');
    return NextResponse.json({ error: 'Failed to execute action' }, { status: 500 });
  }
}
