/**
 * Telegram Bot Notification Service
 *
 * Sends notifications to customers via Telegram Bot API.
 * Requires: TELEGRAM_BOT_TOKEN env variable.
 * Customer must register their Telegram chat_id via /start command.
 *
 * Usage: sendTelegram({ chatId: '123456789', text: 'Hello', parseMode: 'Markdown' })
 */

import { loggers } from '@/lib/logger';
import { getAppUrl } from '@/lib/app-url';

const TELEGRAM_API = 'https://api.telegram.org';

interface TelegramMessage {
  chatId: string;
  text: string;
  parseMode?: 'Markdown' | 'HTML';
}

interface TelegramResult {
  success: boolean;
  messageId?: number;
  error?: string;
}

function getBotToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN || null;
}

/**
 * Send a text message via Telegram Bot API
 */
export async function sendTelegram(message: TelegramMessage): Promise<TelegramResult> {
  const token = getBotToken();
  if (!token) {
    loggers.api.warn('TELEGRAM_BOT_TOKEN not configured — skipping');
    return { success: false, error: 'TELEGRAM_BOT_TOKEN not configured' };
  }

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: message.chatId,
        text: message.text,
        parse_mode: message.parseMode || 'Markdown',
        disable_web_page_preview: true,
      }),
    });

    const data = await res.json();

    if (!data.ok) {
      loggers.api.error({ err: data.description, chatId: message.chatId }, 'Telegram send failed');
      return { success: false, error: data.description || 'Send failed' };
    }

    return { success: true, messageId: data.result?.message_id };
  } catch (error) {
    loggers.api.error({ err: error }, 'Telegram API error');
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Send deadline reminder via Telegram
 */
export async function sendDeadlineReminderTelegram(
  chatId: string,
  customerName: string,
  taxType: string,
  deadline: string,
  daysLeft: number
): Promise<TelegramResult> {
  const emoji = daysLeft <= 3 ? '🚨' : daysLeft <= 7 ? '⚠️' : 'ℹ️';
  // Customer-facing Telegram messages in Bahasa Indonesia.
  const text = `${emoji} *Pengingat tenggat ${taxType}*\n\nHalo ${customerName},\n\nTenggat pelaporan *${taxType}* tinggal *${daysLeft} hari* lagi.\nTenggat: ${deadline}\n\n[Buka AI Pajak](${getAppUrl()}/tax/monthly-dashboard)\n\n_AI Pajak × JTC_`;
  return sendTelegram({ chatId, text });
}

/**
 * Send document request via Telegram
 */
export async function sendDocRequestTelegram(
  chatId: string,
  customerName: string,
  title: string,
  documents: Array<{ description: string }>
): Promise<TelegramResult> {
  const docList = documents.map(d => `• ${d.description}`).join('\n');
  const text = `📋 *${title}*\n\nHalo ${customerName},\n\nDokumen berikut diperlukan:\n\n${docList}\n\n[Unggah dokumen](${getAppUrl()}/documents/upload)\n\n_AI Pajak_`;
  return sendTelegram({ chatId, text });
}

/**
 * Send filing complete notification
 */
export async function sendFilingCompleteTelegram(
  chatId: string,
  customerName: string,
  taxType: string,
  period: string,
  bpeNumber?: string
): Promise<TelegramResult> {
  const text = `✅ *Pelaporan ${taxType} selesai*\n\nHalo ${customerName},\n\nPelaporan *${period}* ${taxType} telah selesai.${bpeNumber ? `\nBPE: ${bpeNumber}` : ''}\n\n[Lihat detail](${getAppUrl()}/submissions)\n\n_AI Pajak × JTC_`;
  return sendTelegram({ chatId, text });
}
