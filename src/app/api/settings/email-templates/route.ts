import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/settings/email-templates - List templates
 * POST /api/settings/email-templates - Create/update template
 *
 * Customizable email templates for consultants to send to clients.
 */
const DEFAULT_TEMPLATES = [
  {
    id: 'deadline-reminder',
    name: 'Pengingat Deadline',
    subject: 'Pengingat: Batas Lapor {{taxType}} - {{deadline}}',
    body: `Yth. {{customerName}},

Kami mengingatkan bahwa batas waktu pelaporan {{taxType}} untuk tahun pajak {{taxYear}} adalah {{deadline}}.

Mohon segera menyiapkan dokumen yang diperlukan:
{{documentList}}

Jika memerlukan bantuan, silakan hubungi kami.

Hormat kami,
{{consultantName}}
{{firmName}}`,
    variables: ['customerName', 'taxType', 'taxYear', 'deadline', 'documentList', 'consultantName', 'firmName'],
  },
  {
    id: 'filing-complete',
    name: 'SPT Selesai',
    subject: 'SPT {{taxType}} Tahun {{taxYear}} Telah Dilaporkan',
    body: `Yth. {{customerName}},

SPT {{taxType}} untuk tahun pajak {{taxYear}} telah berhasil dilaporkan.

Nomor BPE: {{bpeNumber}}
Tanggal Lapor: {{filingDate}}
Status: {{status}}

Simpan email ini sebagai bukti pelaporan.

Hormat kami,
{{consultantName}}`,
    variables: ['customerName', 'taxType', 'taxYear', 'bpeNumber', 'filingDate', 'status', 'consultantName'],
  },
  {
    id: 'document-request',
    name: 'Permintaan Dokumen',
    subject: 'Permintaan Dokumen untuk {{taxType}}',
    body: `Yth. {{customerName}},

Untuk proses pelaporan {{taxType}} tahun {{taxYear}}, kami memerlukan dokumen berikut:

{{documentList}}

Mohon upload melalui portal AI Pajak atau kirim via email ini.

Batas pengumpulan: {{deadline}}

Hormat kami,
{{consultantName}}`,
    variables: ['customerName', 'taxType', 'taxYear', 'documentList', 'deadline', 'consultantName'],
  },
];

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    return NextResponse.json({ success: true, data: { templates: DEFAULT_TEMPLATES } });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { templateId, subject, bodyText } = body;

    // In production, save to database
    return NextResponse.json({
      success: true,
      message: `Template ${templateId} saved`,
      data: { id: templateId, subject, body: bodyText },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to save template' }, { status: 500 });
  }
}
