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
  const text = `${emoji} *${taxType} 신고 마감 알림*\n\n안녕하세요, ${customerName}님.\n\n*${taxType}* 신고 마감일이 *${daysLeft}일* 남았습니다.\n마감일: ${deadline}\n\n[AI Pajak에서 확인](${process.env.NEXT_PUBLIC_APP_URL || 'https://ai-pajak.vercel.app'}/tax/monthly-dashboard)\n\n_AI Pajak × JTC_`;
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
  const text = `📋 *${title}*\n\n안녕하세요, ${customerName}님.\n\n다음 자료가 필요합니다:\n\n${docList}\n\n[업로드하기](${process.env.NEXT_PUBLIC_APP_URL || 'https://ai-pajak.vercel.app'}/documents/upload)\n\n_AI Pajak_`;
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
  const text = `✅ *${taxType} 신고 완료*\n\n안녕하세요, ${customerName}님.\n\n*${period}* ${taxType} 신고가 완료되었습니다.${bpeNumber ? `\nBPE: ${bpeNumber}` : ''}\n\n[상세 확인](${process.env.NEXT_PUBLIC_APP_URL || 'https://ai-pajak.vercel.app'}/submissions)\n\n_AI Pajak × JTC_`;
  return sendTelegram({ chatId, text });
}
