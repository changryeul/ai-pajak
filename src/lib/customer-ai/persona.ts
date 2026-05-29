import type { MessageDTO } from '@/types/customer-ai';

interface RawMessage {
  id: string;
  thread_id: string;
  sender_role: 'customer' | 'operator';
  sender_user_id: string | null;
  content: string;
  customer_read_at: string | null;
  operator_read_at: string | null;
  created_at: string;
}

/**
 * Customer view: operator sender always shown as "AI 상담원" — real
 * operator identity NEVER leaked to customer client.
 */
export function mapMessageForCustomer(m: RawMessage, customerOwnName: string): MessageDTO {
  return {
    id: m.id,
    senderRole: m.sender_role,
    displaySender: m.sender_role === 'operator' ? 'AI 상담원' : customerOwnName,
    content: m.content,
    createdAt: m.created_at,
    customerReadAt: m.customer_read_at,
    operatorReadAt: m.operator_read_at,
  };
}

/**
 * Operator view: real sender identity shown (email or '내부 담당자' fallback).
 */
export function mapMessageForOperator(
  m: RawMessage,
  emailById: Record<string, string | null>,
  customerName: string,
): MessageDTO {
  const fallback = '내부 담당자';
  return {
    id: m.id,
    senderRole: m.sender_role,
    displaySender:
      m.sender_role === 'operator'
        ? (m.sender_user_id ? (emailById[m.sender_user_id] ?? fallback) : fallback)
        : customerName,
    content: m.content,
    createdAt: m.created_at,
    customerReadAt: m.customer_read_at,
    operatorReadAt: m.operator_read_at,
  };
}
