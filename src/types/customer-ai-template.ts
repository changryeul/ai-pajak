/**
 * Customer AI template snippet — Phase 2.4.
 * MASTER 가 /admin/master/customer-ai-templates 에서 직접 add/edit/delete.
 * 운영자가 customer-inbox dropdown 에서 한 번 클릭으로 답변에 적용.
 *
 * Used by:
 *   - GET    /api/admin/master/customer-ai-templates        → CustomerAiTemplate[]
 *   - POST   /api/admin/master/customer-ai-templates        → { data: CustomerAiTemplate }
 *   - PATCH  /api/admin/master/customer-ai-templates?id=…   → { data: CustomerAiTemplate }
 *   - DELETE /api/admin/master/customer-ai-templates?id=…   → { data: { ok: true } }
 *   - GET    /api/operator/customer-inbox/templates         → CustomerAiTemplate[] (active only)
 */
export interface CustomerAiTemplate {
  id: string;
  title: string;
  body: string;
  category: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string; // ISO
  updated_at: string; // ISO
}

/** Body shape for POST. */
export interface CustomerAiTemplateCreate {
  title: string;
  body: string;
  category?: string | null;
  is_active?: boolean;
  display_order?: number;
}

/** Body shape for PATCH (all fields optional, at least one required). */
export type CustomerAiTemplatePatch = Partial<CustomerAiTemplateCreate>;

/**
 * Lean DTO returned by the operator-inbox dropdown endpoint.
 * Excludes audit/timestamp fields the dropdown doesn't need.
 */
export interface CustomerAiTemplateDTO {
  id: string;
  title: string;
  body: string;
  category: string | null;
  displayOrder: number;
}
