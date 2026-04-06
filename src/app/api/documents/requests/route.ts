import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { resolveUserRole } from '@/lib/auth/resolve-role';
import { loggers } from '@/lib/logger';
import { sendWhatsApp } from '@/lib/notifications/whatsapp-service';

/**
 * GET /api/documents/requests?customerId=...&period=...
 *   → List document requests for customer/period (pending first)
 *
 * POST /api/documents/requests
 *   body: { customerId, period, title, message, requiredDocuments, sendWhatsapp? }
 *   → Operator creates a document request (shown as AI to customer)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const params = new URL(request.url).searchParams;
    const customerId = params.get('customerId');
    const period = params.get('period');

    if (!customerId) return NextResponse.json({ error: 'customerId required' }, { status: 400 });

    const admin = getSupabaseAdmin();
    let query = admin
      .from('document_request')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (period) query = query.eq('period', period);

    const { data } = await query;
    return NextResponse.json({ success: true, data: data || [] });
  } catch (error) {
    loggers.api.error({ err: error }, 'List doc requests error');
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

/**
 * POST /api/documents/requests — Operator (or admin) creates request
 * IMPORTANT: requester_type is set to 'AI' so customer sees it as automated.
 * The actual requested_by (operator user_id) is stored for audit trail.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = await resolveUserRole(supabase, user.id);
    if (!['CONSULTANT_JTC', 'TAX_ADVISOR_JTC', 'TAX_OPERATOR', 'TAX_OPERATOR_SUPERVISOR'].includes(role || '')) {
      return NextResponse.json({ error: 'Only staff can create document requests' }, { status: 403 });
    }

    const body = await request.json();
    const {
      customerId,
      period,
      title,
      message: reqMessage,
      requiredDocuments, // [{ type, description, priority }]
      sendWhatsapp = false,
      sendTelegram = false,
    } = body;

    if (!customerId || !period || !title || !requiredDocuments?.length) {
      return NextResponse.json(
        { error: 'customerId, period, title, requiredDocuments required' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // Get customer info
    const { data: customer } = await admin
      .from('customer')
      .select('user_id, full_name, company_name, phone_number')
      .eq('id', customerId)
      .single();

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Insert request (shown as AI to customer — key design decision)
    const { data: req, error: insertError } = await admin
      .from('document_request')
      .insert({
        customer_id: customerId,
        period,
        requester_type: 'AI',        // ← Always AI-branded to customer
        requested_by: user.id,        // ← Audit: actual operator who requested
        title,
        message: reqMessage || '추가 자료가 필요합니다.',
        required_documents: requiredDocuments,
        sent_via_web: true,
        sent_via_whatsapp: sendWhatsapp,
        sent_via_telegram: sendTelegram,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // In-app notification (always)
    await admin.from('notification').insert({
      user_id: customer.user_id,
      type: 'SYSTEM_ANNOUNCEMENT',
      title,
      message: `${requiredDocuments.length}개의 추가 자료가 필요합니다.`,
      priority: 'HIGH',
      data: { action: 'document-request', period, requestId: req.id },
    });

    // WhatsApp
    if (sendWhatsapp && customer.phone_number) {
      const customerName = customer.company_name || customer.full_name;
      const docList = requiredDocuments.map((d: { description: string }) => `• ${d.description}`).join('\n');
      try {
        await sendWhatsApp({
          to: customer.phone_number,
          text: `📋 *${title}*\n\n안녕하세요, ${customerName}님.\n\n${reqMessage || '다음 자료가 필요합니다:'}\n\n${docList}\n\n아래 링크에서 업로드:\n${process.env.NEXT_PUBLIC_APP_URL || 'https://ai-pajak.vercel.app'}/documents/upload\n\n_AI Pajak_`,
        });
        await admin.from('document_request')
          .update({ whatsapp_sent_at: new Date().toISOString() })
          .eq('id', req.id);
      } catch { /* */ }
    }

    loggers.api.info(
      { customerId, period, operatorId: user.id, docsRequested: requiredDocuments.length },
      'Operator document request created (displayed as AI)'
    );

    return NextResponse.json({
      success: true,
      data: req,
      message: `자료 요청이 발송되었습니다 (고객에게는 AI 요청으로 표시)`,
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Create doc request error');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    );
  }
}
