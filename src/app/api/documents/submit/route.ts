import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import { sendWhatsApp } from '@/lib/notifications/whatsapp-service';
import { sendDocRequestTelegram } from '@/lib/notifications/telegram-service';

/**
 * POST /api/documents/submit
 * body: { customerId, period }
 *
 * 1. Creates/updates document_submission record
 * 2. AI reviews completeness of uploaded documents
 * 3. If incomplete → creates document_request + sends WhatsApp
 * 4. If complete → moves to OPERATOR_REVIEWING
 */

// Required documents per customer profile
function getRequiredDocTypes(customerProfile: {
  has_employees?: boolean;
  is_pkp?: boolean;
  pays_service_fees?: boolean;
  has_import_export?: boolean;
  has_rental_business?: boolean;
}): Array<{ type: string; description: string; condition: string }> {
  const required: Array<{ type: string; description: string; condition: string }> = [];

  // Base requirement — always needed. Description in English; the UI may
  // later localize by `condition` if needed.
  required.push({ type: 'BANK_STATEMENT', description: 'Bank statement (monthly)', condition: 'ALWAYS' });

  if (customerProfile.has_employees) {
    required.push({ type: 'SALARY_SLIP', description: 'Salary slips or employee payroll data', condition: 'PPh21' });
  }

  if (customerProfile.is_pkp) {
    required.push({ type: 'FAKTUR_PAJAK', description: 'Sales Faktur Pajak (Keluaran)', condition: 'PPN' });
    required.push({ type: 'FAKTUR_PAJAK', description: 'Purchase Faktur Pajak (Masukan)', condition: 'PPN' });
  }

  if (customerProfile.pays_service_fees) {
    required.push({ type: 'INVOICE', description: 'Service-fee invoices (subject to PPh 23 withholding)', condition: 'PPh23' });
  }

  if (customerProfile.has_import_export) {
    required.push({ type: 'INVOICE', description: 'Import/export invoices and customs documents', condition: 'PPh22/PPN' });
  }

  if (customerProfile.has_rental_business) {
    required.push({ type: 'RECEIPT', description: 'Rental income receipts and contracts', condition: 'PPh4(2)' });
  }

  return required;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { customerId, period } = body;

    if (!customerId || !period) {
      return NextResponse.json({ error: 'customerId and period required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Get customer profile for requirement determination
    const { data: customer } = await admin
      .from('customer')
      .select('*, user_id')
      .eq('id', customerId)
      .single();

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Get ALL uploaded documents for this customer (not date-filtered — customer selects period on UI)
    const { data: docs } = await admin
      .from('document')
      .select('document_type, ocr_status, form_type, metadata')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(200);

    // Check both document_type and metadata.original_document_type (enum fallback stores 'OTHER')
    const uploadedTypes = new Set<string>();
    for (const d of docs || []) {
      uploadedTypes.add(d.document_type);
      const originalType = (d.metadata as Record<string, unknown>)?.original_document_type;
      if (typeof originalType === 'string') {
        uploadedTypes.add(originalType);
      }
    }

    // Determine required documents
    const required = getRequiredDocTypes({
      has_employees: customer.has_employees,
      is_pkp: customer.is_pkp,
      pays_service_fees: customer.pays_service_fees,
      has_import_export: customer.has_import_export,
      has_rental_business: customer.has_rental_business,
    });

    // Check completeness
    const missing = required.filter(r => !uploadedTypes.has(r.type));
    const complete = missing.length === 0;

    // Suggestions
    const suggestions: string[] = [];
    if (!uploadedTypes.has('BANK_STATEMENT')) {
      suggestions.push('A monthly bank statement is mandatory. You can download a PDF from mobile banking.');
    }
    if (customer.is_pkp && !uploadedTypes.has('FAKTUR_PAJAK')) {
      suggestions.push('PKP-registered businesses must submit Faktur Pajak (Keluaran + Masukan) every month.');
    }

    const aiResult = { complete, missing, suggestions };

    // Upsert submission
    const { data: submission } = await admin
      .from('document_submission')
      .upsert({
        customer_id: customerId,
        period,
        status: complete ? 'OPERATOR_REVIEWING' : 'NEEDS_MORE',
        submitted_at: new Date().toISOString(),
        ai_reviewed_at: new Date().toISOString(),
        ai_result: aiResult,
      }, { onConflict: 'customer_id,period' })
      .select()
      .single();

    // If incomplete → create document_request + send notification
    if (!complete && missing.length > 0) {
      // Customer-facing copy in Bahasa Indonesia.
      const reqTitle = `Permintaan dokumen tambahan ${period}`;
      const reqMessage = `Halo, untuk pelaporan pajak ${period} kami memerlukan dokumen berikut:`;

      await admin.from('document_request').insert({
        customer_id: customerId,
        submission_id: submission?.id,
        period,
        requester_type: 'AI',
        title: reqTitle,
        message: reqMessage,
        required_documents: missing.map(m => ({
          type: m.type,
          description: m.description,
          priority: m.condition === 'ALWAYS' ? 'HIGH' : 'MEDIUM',
        })),
        sent_via_web: true,
        sent_via_whatsapp: false,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

      // In-app notification
      await admin.from('notification').insert({
        user_id: customer.user_id,
        type: 'SYSTEM_ANNOUNCEMENT',
        title: reqTitle,
        message: `${missing.length} dokumen tambahan diperlukan. Mohon unggah melalui halaman dokumen.`,
        priority: 'HIGH',
        data: { action: 'document-request', period },
      });

      // WhatsApp notification
      if (customer.phone_number) {
        const { data: prefs } = await admin
          .from('notification_preferences')
          .select('whatsapp_enabled')
          .eq('user_id', customer.user_id)
          .maybeSingle();

        if (prefs?.whatsapp_enabled) {
          const missingList = missing.map(m => `• ${m.description}`).join('\n');
          try {
            await sendWhatsApp({
              to: customer.phone_number,
              text: `📋 *Permintaan dokumen tambahan ${period}*\n\n${reqMessage}\n\n${missingList}\n\nSilakan unggah di:\n${process.env.NEXT_PUBLIC_APP_URL || 'https://ai-pajak.vercel.app'}/documents/upload\n\n_AI Pajak_`,
            });
            await admin.from('document_request')
              .update({ sent_via_whatsapp: true, whatsapp_sent_at: new Date().toISOString() })
              .eq('submission_id', submission?.id)
              .eq('requester_type', 'AI')
              .is('whatsapp_sent_at', null);
          } catch { /* */ }
        }
      }
    }

    // Telegram (AI auto-request)
    if (!complete && missing.length > 0) {
      const { data: telePrefs } = await admin
        .from('notification_preferences')
        .select('telegram_enabled, telegram_chat_id')
        .eq('user_id', customer.user_id)
        .maybeSingle();

      if (telePrefs?.telegram_enabled && telePrefs?.telegram_chat_id) {
        const customerName = customer.company_name || customer.full_name;
        try {
          await sendDocRequestTelegram(
            telePrefs.telegram_chat_id,
            customerName,
            `Permintaan dokumen tambahan ${period}`,
            missing.map(m => ({ description: m.description }))
          );
        } catch { /* */ }
      }
    }

    loggers.api.info(
      { customerId, period, complete, missingCount: missing.length },
      'Document submission reviewed'
    );

    return NextResponse.json({
      success: true,
      data: {
        aiResult,
        submissionId: submission?.id,
        status: complete ? 'OPERATOR_REVIEWING' : 'NEEDS_MORE',
      },
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'Document submit error');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    );
  }
}

