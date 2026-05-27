/**
 * Tax Code Rule — system-level Indonesian tax code reference row.
 * 7 fixed categories. MASTER edits only.
 * Used by:
 *   - GET  /api/admin/tax-code-rule       → TaxCodeRule[]
 *   - PATCH /api/admin/tax-code-rule/[id] → TaxCodeRule
 *   - <TaxCodeRulesTable />               (client component)
 */
export interface TaxCodeRule {
  id: string;
  category: string;         // 'PPh21' | 'PPh23' | 'PPh4(2)' | 'PPh22' | 'PPh26' | 'PPN' | 'PPh25'
  sort_order: number;       // 1..7
  tax_code: string;         // e.g. '411121-100'
  rate_rule: string;        // 세율 기준
  condition_text: string;   // 적용 조건
  doc_required: string;     // 필요 증빙
  review_note: string;      // 상담원 검토 조건
  updated_by: string | null;
  updated_at: string;       // ISO
  created_at: string;
}

/** Patchable fields for PATCH /api/admin/tax-code-rule/[id]. */
export type TaxCodeRulePatch = Partial<
  Pick<TaxCodeRule, 'tax_code' | 'rate_rule' | 'condition_text' | 'doc_required' | 'review_note'>
>;

/**
 * Single Tax Code Rule audit timeline row, shaped for UI consumption.
 * Used by:
 *   - GET /api/admin/tax-code-rule/audit-log → AuditRowDTO[]
 *   - <TaxCodeRuleAuditTimeline />
 */
export interface AuditRowDTO {
  id: string;                 // audit_log.id
  ruleId: string;             // tax_code_rule.id
  category: string;           // 'PPh21' | ...
  actorRole: string | null;   // 'TAX_OPERATOR_MASTER' 등
  actorUserId: string;        // auth.users.id (NOT NULL per audit_log schema)
  actorEmail: string | null;  // joined from auth.users
  createdAt: string;          // ISO
  diff: Record<string, { before: string; after: string }>;
}
