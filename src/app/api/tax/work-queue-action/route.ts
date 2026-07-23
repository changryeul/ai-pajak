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
        // Customer-facing copy is in Indonesian (target audience). When customer
        // table grows a locale column we can branch on it.
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ai-pajak.vercel.app';
        const message = `📋 *Permintaan Dokumen - AI Pajak*\n\nHalo ${customerName},\n\nUntuk pelaporan pajak bulan ini kami memerlukan dokumen berikut:\n\n• Mutasi rekening bank\n• Faktur pajak masukan\n• Data penggajian\n\nSilakan unggah melalui tautan berikut:\n${appUrl}/documents\n\n_AI Pajak_`;

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

        // In-app notification — Indonesian copy (customer-facing).
        try {
          await admin.from('notification').insert({
            user_id: cust.user_id,
            type: 'SYSTEM_ANNOUNCEMENT',
            title: 'Permintaan dokumen',
            message: 'Beberapa dokumen masih kurang untuk pelaporan pajak bulan ini. Mohon unggah melalui halaman dokumen.',
            priority: 'HIGH',
            data: { action: 'document-request' },
          });
          inAppSent++;
        } catch { /* */ }
      }

      loggers.api.info({ waSent, inAppSent, userId: user.id }, 'Document request sent');

      return NextResponse.json({
        success: true,
        messageKey: 'actionResult.requestDocsDone',
        messageParams: { customers: customers.length, wa: waSent, inApp: inAppSent },
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
        messageKey: 'actionResult.reviewListed',
        messageParams: { count: (calcs || []).length },
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
          messageKey: 'actionResult.billingNothing',
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
        messageKey: 'actionResult.billingCreated',
        messageParams: { count: created },
        data: { created, results },
      });
    }

    // Coretax era (2026-07): 납부 = 신고. 'submit-filing' 일괄 액션은 구방식
    // (PAYMENT_VERIFIED → DJP_SUBMITTED) 이므로 제거됐다.

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    loggers.api.error({ err: error }, 'Work queue action error');
    return NextResponse.json({ error: 'Failed to execute action' }, { status: 500 });
  }
}
