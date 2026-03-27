/**
 * WhatsApp Integration Service
 *
 * Sends tax notifications via WhatsApp using the WhatsApp Business API.
 * Provider: Fonnte (https://fonnte.com) - Indonesian WhatsApp API provider
 *
 * Notifications:
 * - Tax filing deadline reminders
 * - Payment due alerts
 * - Filing status updates
 * - SPT completion notifications
 */

const FONNTE_API_URL = 'https://api.fonnte.com/send';
const FONNTE_TOKEN = process.env.FONNTE_API_TOKEN || '';

export interface WhatsAppMessage {
  to: string; // Phone number (62xxx format)
  text: string;
  type?: 'text' | 'image' | 'document';
  url?: string; // For image/document
  filename?: string;
}

export interface WhatsAppResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send a WhatsApp message
 */
export async function sendWhatsApp(message: WhatsAppMessage): Promise<WhatsAppResult> {
  if (!FONNTE_TOKEN) {
    console.warn('[WhatsApp] FONNTE_API_TOKEN not configured');
    return { success: false, error: 'WhatsApp not configured' };
  }

  try {
    const body: Record<string, string> = {
      target: formatPhoneNumber(message.to),
      message: message.text,
    };

    if (message.url) {
      body.url = message.url;
      if (message.filename) body.filename = message.filename;
    }

    const response = await fetch(FONNTE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': FONNTE_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    return {
      success: data.status === true,
      messageId: data.id,
      error: data.reason,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Send failed',
    };
  }
}

/**
 * Send tax deadline reminder via WhatsApp
 */
export async function sendDeadlineReminder(
  phone: string,
  customerName: string,
  taxType: string,
  deadline: string,
  daysLeft: number
): Promise<WhatsAppResult> {
  const emoji = daysLeft <= 3 ? '🚨' : daysLeft <= 7 ? '⚠️' : '📋';
  const text = `${emoji} *Pengingat Pajak - AI Pajak*

Halo ${customerName},

Batas waktu pelaporan *${taxType}* tinggal *${daysLeft} hari lagi* (${deadline}).

${daysLeft <= 3 ? '⏰ Segera laporkan untuk menghindari denda Rp 100.000!' : 'Pastikan dokumen sudah lengkap.'}

Lapor sekarang di: ${process.env.NEXT_PUBLIC_APP_URL || 'https://aipajak.com'}

_Pesan otomatis dari AI Pajak_`;

  return sendWhatsApp({ to: phone, text });
}

/**
 * Send filing completion notification
 */
export async function sendFilingComplete(
  phone: string,
  customerName: string,
  taxType: string,
  bpeNumber?: string
): Promise<WhatsAppResult> {
  const text = `✅ *SPT Berhasil Dilaporkan - AI Pajak*

Halo ${customerName},

*${taxType}* Anda telah berhasil dilaporkan ke DJP.
${bpeNumber ? `\nNomor BPE: *${bpeNumber}*` : ''}

Simpan nomor BPE sebagai bukti pelaporan.

_Pesan otomatis dari AI Pajak_`;

  return sendWhatsApp({ to: phone, text });
}

/**
 * Send payment reminder
 */
export async function sendPaymentReminder(
  phone: string,
  customerName: string,
  amount: number,
  dueDate: string
): Promise<WhatsAppResult> {
  const text = `💰 *Pengingat Pembayaran - AI Pajak*

Halo ${customerName},

Tagihan pajak Anda sebesar *Rp ${amount.toLocaleString('id-ID')}* jatuh tempo pada *${dueDate}*.

Bayar sekarang untuk menghindari bunga keterlambatan.

_Pesan otomatis dari AI Pajak_`;

  return sendWhatsApp({ to: phone, text });
}

/**
 * Format phone number to 62xxx
 */
function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  }
  if (!cleaned.startsWith('62')) {
    cleaned = '62' + cleaned;
  }
  return cleaned;
}
