export type ContextKind = 'PPH21' | 'PPH23' | 'PPN' | 'CLOSING' | 'OTHER';
export type ThreadStatus = 'AWAITING_OPERATOR' | 'RESPONDED' | 'RESOLVED';
export type SenderRole = 'customer' | 'operator';

export interface ChatContext {
  kind: ContextKind;
  period: string;  // 'YYYY-MM' or 'OTHER'
  label: string;   // UI display
}

export interface ThreadDTO {
  id: string;
  contextKind: ContextKind;
  contextPeriod: string;
  status: ThreadStatus;
  customerUnreadCount: number;
  operatorUnreadCount: number;
  lastCustomerMessageAt: string | null;
  lastOperatorMessageAt: string | null;
  createdAt: string;
  displayLabel: string;
}

export interface ThreadWithCustomerDTO extends ThreadDTO {
  customerId: string;
  customerName: string;
  /** Phase 2.1: auto-generated draft pending operator review. NULL when no
   *  pending draft. Operator-only — never sent to customer endpoints. */
  auto_draft: string | null;
  /** Phase 2.1: when auto_draft was generated. NULL when auto_draft is NULL. */
  auto_draft_at: string | null;
}

export interface MessageDTO {
  id: string;
  senderRole: SenderRole;
  /** Customer view: 'AI 상담원' for operator. Operator view: real sender email. */
  displaySender: string;
  content: string;
  createdAt: string;
  customerReadAt: string | null;
  operatorReadAt: string | null;
}
