/**
 * Luxury Item Classification — PMK 131/2024 분류 row.
 * MASTER 가 /admin/master/luxury-classifications 에서 직접 add/edit/delete.
 * Phase 3.3 classifyLuxuryBatch() 가 description substring match 로 사용.
 *
 * Used by:
 *   - GET    /api/admin/master/luxury-classifications        → LuxuryClassification[]
 *   - POST   /api/admin/master/luxury-classifications        → { data: LuxuryClassification }
 *   - PATCH  /api/admin/master/luxury-classifications?id=…   → { data: LuxuryClassification }
 *   - DELETE /api/admin/master/luxury-classifications?id=…   → { data: { ok: true } }
 */
export type LuxuryCategory = 'LUXURY' | 'ESSENTIAL' | 'SPECIAL';

export interface LuxuryClassification {
  id: string;
  item_name: string;
  hs_code: string | null;
  category: LuxuryCategory;
  ppn_treatment: string | null;
  legal_basis: string | null;
  created_at: string; // ISO
  updated_at: string; // ISO
}

/** Body shape for POST. */
export interface LuxuryClassificationCreate {
  item_name: string;
  hs_code?: string | null;
  category: LuxuryCategory;
  ppn_treatment?: string | null;
  legal_basis?: string | null;
}

/** Body shape for PATCH (all fields optional, at least one required). */
export type LuxuryClassificationPatch = Partial<LuxuryClassificationCreate>;
