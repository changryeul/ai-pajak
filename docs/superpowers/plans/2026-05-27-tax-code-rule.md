# Tax Code Rule — DB-persistence + inline 편집 (Track B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/operator/settings` §3 "Tax Code Rules" 7행을 DB-persisted + TAX_OPERATOR_MASTER inline-editable 로 전환한다.

**Architecture:** 시스템-레벨 단일 테이블 `tax_code_rule` + RLS (read=all auth / write=MASTER) + `composeMiddleware`-protected GET/PATCH API + server-component 화된 settings page 안의 client `TaxCodeRulesTable` 자식. 신규 row / 삭제 / per-tenant override 없음.

**Tech Stack:** Next.js 16 (App Router, Server Components), Supabase (PostgreSQL + RLS), TypeScript strict, Zod 4, next-intl, tanstack/react-query, sonner toast, pino logger.

**Spec reference:** `docs/superpowers/specs/2026-05-27-tax-code-rule-design.md`

---

## File Structure

**New files:**
- `supabase/migrations/20260527000001_tax_code_rule.sql` — table + RLS + seed
- `src/types/tax-code-rule.ts` — `TaxCodeRule` TS interface (shared client+server)
- `src/app/api/admin/tax-code-rule/route.ts` — GET (list)
- `src/app/api/admin/tax-code-rule/[id]/route.ts` — PATCH (update)
- `src/app/[locale]/(dashboard)/operator/settings/_components/TaxCodeRulesTable.tsx` — client component
- `scripts/test-tax-code-rule.ts` — smoke test (12 assertions)

**Modified files:**
- `src/app/[locale]/(dashboard)/operator/settings/page.tsx` — `'use client'` 제거 + server fetch + §3 자식 분리
- `src/i18n/messages/{ko,en,id,ja,zh}.json` — `operatorSettings.rules.*` 에 7키 추가
- `scripts/test-smoke-all.ts` — 새 step entry 1줄 추가
- `package.json` — `test:tax-code-rule` 스크립트 1줄 추가

---

## Pre-flight

- [ ] **Step 0.1: Verify MASTER 계정 prod 시드 확인**

Run:
```bash
SEED_TARGET=prod npx tsx -e 'import {createClient} from "@supabase/supabase-js"; import * as dotenv from "dotenv"; dotenv.config({path:".env.production.local"}); const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!); c.auth.signInWithPassword({email:"master.test@aipajak.com", password:"TestPassword123!"}).then(r => console.log(r.error ? "FAIL: "+r.error.message : "OK: master logged in"));'
```
Expected: `OK: master logged in`.
If FAIL → `SEED_TARGET=prod npx tsx scripts/seed-master-and-external.ts` 먼저.

---

## Task 1: Migration — schema + RLS + seed

**Files:**
- Create: `supabase/migrations/20260527000001_tax_code_rule.sql`

- [ ] **Step 1.1: Write the migration**

Create `supabase/migrations/20260527000001_tax_code_rule.sql`:

```sql
-- Tax Code Rule — system-level Indonesian tax code reference managed by
-- TAX_OPERATOR_MASTER. 7 fixed categories (PPh21, PPh23, PPh4(2), PPh22,
-- PPh26, PPN, PPh25); no INSERT/DELETE from app, only seed in this file.
-- Track B of PDF p.26-27 "Admin / Tax Engine".

CREATE TABLE tax_code_rule (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category        TEXT NOT NULL UNIQUE,
  sort_order      INTEGER NOT NULL,
  tax_code        TEXT NOT NULL,
  rate_rule       TEXT NOT NULL,
  condition_text  TEXT NOT NULL,
  doc_required    TEXT NOT NULL,
  review_note     TEXT NOT NULL,
  updated_by      UUID REFERENCES auth.users(id),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX tax_code_rule_sort_order_idx ON tax_code_rule(sort_order);

COMMENT ON TABLE tax_code_rule IS
  'System-level Indonesian tax code reference rules. 7 fixed rows; MASTER edits only. Seeded in same migration.';

-- ── RLS ──
ALTER TABLE tax_code_rule ENABLE ROW LEVEL SECURITY;

CREATE POLICY tax_code_rule_read ON tax_code_rule
  FOR SELECT TO authenticated USING (true);

CREATE POLICY tax_code_rule_master_update ON tax_code_rule
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'TAX_OPERATOR_MASTER'
        AND user_roles.is_active = true
    )
  );

-- No INSERT or DELETE policy → no app-side row creation/deletion.

-- ── Seed (idempotent) ──
INSERT INTO tax_code_rule (category, sort_order, tax_code, rate_rule, condition_text, doc_required, review_note) VALUES
  ('PPh21',   1, '411121-100', '급여/비정기소득별 누진·TER 기준',     '직원 급여, THR, bonus, benefit 등',                        'Payroll, A1/A2, employee master',         '직원구분/비과세/공제항목 확인'),
  ('PPh23',   2, '411124-104', '일반 용역 2% 등',                    '서비스 수수료, management fee, royalty 등',                'Invoice, contract, bukti potong',         '서비스 성격과 계약서 문구 확인'),
  ('PPh4(2)', 3, '411128-403', '최종분리과세 항목별 상이',             '건물 임대, 특정 건설서비스, 토지/건물 거래 등',              '계약서, 라이선스, invoice',                  'PPh23과 혼동 위험이 큰 항목 우선검토'),
  ('PPh22',   4, '411122-100', '거래/수입/기관별 상이',               '수입, 정부거래, 특정 상품 거래',                            'PIB, purchase document, payment proof',   '거래주체와 과세대상 여부 확인'),
  ('PPh26',   5, '411127-100', '기본 20% / 조세조약 적용 가능',         '비거주자 지급, royalty, interest, technical fee',          'DGT Form, treaty residence certificate, contract', '조세조약 적용 가능성과 DGT 유효성 확인'),
  ('PPN',     6, '411211-100', '현재 적용 VAT rate 기준',             '과세 재화/용역, PKP 거래',                                  'Faktur Pajak, invoice, e-Faktur data',    'PKP 여부, VAT credit 가능 여부 확인'),
  ('PPh25',   7, '411126-100', '전년도 기준 월할 또는 신규 기준',        '법인/개인 월별 선납세액',                                    '전년도 SPT, PPh25 billing history',       'UMKM final 전환 여부와 법인나이 확인')
ON CONFLICT (category) DO NOTHING;
```

- [ ] **Step 1.2: Apply migration to local + prod**

Local:
```bash
supabase migration up
```
Expected: migration 20260527000001 마지막에 적용됨.

Prod (memory `feedback_local_testing_only.md` 에 따라 prod 도 staging):
```bash
SUPABASE_DB_URL="$(grep DATABASE_URL .env.production.local | cut -d= -f2-)" supabase db push --include-all
```
또는 Supabase Studio SQL editor 에 그대로 붙여넣기.

- [ ] **Step 1.3: Verify seed**

Run (local):
```bash
psql "$(supabase status --output env | grep DB_URL | cut -d= -f2- | tr -d '"')" -c "SELECT category, sort_order, tax_code FROM tax_code_rule ORDER BY sort_order;"
```
Expected: 7 rows, sort_order 1..7, category PPh21..PPh25 in order.

- [ ] **Step 1.4: Commit**

```bash
git add supabase/migrations/20260527000001_tax_code_rule.sql
git commit -m "$(cat <<'EOF'
feat(tax-code-rule): schema + RLS + 7-row seed (Track B 1/N)

시스템-레벨 단일 테이블 tax_code_rule. RLS: 인증된 모든 role read,
TAX_OPERATOR_MASTER 만 UPDATE. INSERT/DELETE 정책 없음 (7행 고정).
PDF p.27 Tax Code Rules 7행을 같은 마이그레이션에서 seed.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Shared TS type

**Files:**
- Create: `src/types/tax-code-rule.ts`

- [ ] **Step 2.1: Define `TaxCodeRule` interface**

Create `src/types/tax-code-rule.ts`:

```ts
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
```

- [ ] **Step 2.2: Commit (with next task)** — see Task 3.

---

## Task 3: GET endpoint

**Files:**
- Create: `src/app/api/admin/tax-code-rule/route.ts`

- [ ] **Step 3.1: Write the handler**

Create `src/app/api/admin/tax-code-rule/route.ts`:

```ts
/**
 * GET /api/admin/tax-code-rule
 *   → 200 { data: TaxCodeRule[] } (sort_order ASC)
 *
 * All authenticated roles can read (RLS USING (true)).
 * PLATFORM_ADMIN is blocked by blockPlatformAdmin middleware for
 * consistency with hard rule #1 (no tax data for platform admin).
 */

import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { RequestWithSession } from '@/types/auth';
import type { TaxCodeRule } from '@/types/tax-code-rule';

async function handleGet(_req: RequestWithSession): Promise<Response> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('tax_code_rule')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(
    { data: (data ?? []) as TaxCodeRule[] },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
  )(request as RequestWithSession, handleGet);
}
```

- [ ] **Step 3.2: Smoke-verify via curl (local)**

Run (with dev server up):
```bash
# Get a master token first
TOKEN=$(npx tsx -e 'import {createClient} from "@supabase/supabase-js"; import * as d from "dotenv"; d.config({path:".env.local"}); const c=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!); c.auth.signInWithPassword({email:"master.test@aipajak.com", password:"TestPassword123!"}).then(r=>{console.log(r.data.session?.access_token||"FAIL")});')
curl -sS http://localhost:3000/api/admin/tax-code-rule -H "Authorization: Bearer $TOKEN" | head -200
```
Expected: JSON with `data: [...]` containing 7 objects, first `category: "PPh21"`.

- [ ] **Step 3.3: Commit**

```bash
git add src/types/tax-code-rule.ts src/app/api/admin/tax-code-rule/route.ts
git commit -m "$(cat <<'EOF'
feat(tax-code-rule): GET /api/admin/tax-code-rule (Track B 2/N)

read-only list endpoint, all authenticated roles allowed (PLATFORM_ADMIN
차단으로 하드룰 #1 일관). Cache-Control: no-store 로 stale 회피.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: PATCH endpoint

**Files:**
- Create: `src/app/api/admin/tax-code-rule/[id]/route.ts`

- [ ] **Step 4.1: Write the handler**

Create `src/app/api/admin/tax-code-rule/[id]/route.ts`:

```ts
/**
 * PATCH /api/admin/tax-code-rule/[id]
 *   body: { tax_code?, rate_rule?, condition_text?, doc_required?, review_note? }
 *   → 200 { data: TaxCodeRule }
 *
 * TAX_OPERATOR_MASTER only. updated_by / updated_at are server-set.
 * category and sort_order cannot be changed (system keys).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireRole } from '@/middleware/rbac';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { UserRole, type RequestWithSession } from '@/types/auth';
import type { TaxCodeRule } from '@/types/tax-code-rule';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const patchSchema = z
  .object({
    tax_code:       z.string().min(1).max(50).optional(),
    rate_rule:      z.string().min(1).max(500).optional(),
    condition_text: z.string().min(1).max(500).optional(),
    doc_required:   z.string().min(1).max(500).optional(),
    review_note:    z.string().min(1).max(500).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'at least one of tax_code, rate_rule, condition_text, doc_required, review_note is required',
  });

function getId(req: NextRequest): string | null {
  const m = req.nextUrl.pathname.match(/\/tax-code-rule\/([^/]+)/);
  return m?.[1] ?? null;
}

async function handlePatch(req: RequestWithSession): Promise<Response> {
  const id = getId(req as unknown as NextRequest);
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: 'id must be uuid' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('tax_code_rule')
    .update({
      ...parsed.data,
      updated_by: req.session.userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    // PostgREST PGRST116 = no row matched
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'rule not found' }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: data as TaxCodeRule });
}

export async function PATCH(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(UserRole.TAX_OPERATOR_MASTER),
    withAudit('TAX_CODE_RULE_UPDATE'),
  )(request as RequestWithSession, handlePatch);
}
```

- [ ] **Step 4.2: Smoke-verify via curl (local)**

Run (dev server up, TOKEN from Step 3.2):
```bash
# Find PPh21 id
ID=$(curl -sS http://localhost:3000/api/admin/tax-code-rule -H "Authorization: Bearer $TOKEN" | npx --yes jq -r '.data[] | select(.category=="PPh21") | .id')
echo "PPh21 id = $ID"

# PATCH it
curl -sS -X PATCH "http://localhost:3000/api/admin/tax-code-rule/$ID" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"review_note":"TEMP_PATCH_TEST"}' | head -200

# Revert
curl -sS -X PATCH "http://localhost:3000/api/admin/tax-code-rule/$ID" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"review_note":"직원구분/비과세/공제항목 확인"}' | head -200
```
Expected: each call returns `{ data: { ... review_note: "..." } }` with the new value. 2nd revert.

- [ ] **Step 4.3: Commit**

```bash
git add src/app/api/admin/tax-code-rule/\[id\]/route.ts
git commit -m "$(cat <<'EOF'
feat(tax-code-rule): PATCH /api/admin/tax-code-rule/[id] (Track B 3/N)

TAX_OPERATOR_MASTER 만. Zod partial schema (5 patchable fields, 최소 1개).
updated_by/updated_at 서버 set, category/sort_order 변경 불가.
withAudit('TAX_CODE_RULE_UPDATE') 로 audit_log 기록.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: i18n keys (5 locales)

**Files:**
- Modify: `src/i18n/messages/{ko,en,id,ja,zh}.json` — add to `operatorSettings.rules.*`

- [ ] **Step 5.1: Read current `operatorSettings.rules` shape (ko)**

Run:
```bash
npx tsx -e 'const m=require("./src/i18n/messages/ko.json"); console.log(JSON.stringify(m.operatorSettings.rules, null, 2));'
```
Expected: existing keys (`title`, `badge`, `intro`, `colCategory`, `colCode`, …).

- [ ] **Step 5.2: Add 7 keys to all 5 locales**

For each of `ko.json`, `en.json`, `id.json`, `ja.json`, `zh.json` — add these keys inside `operatorSettings.rules`:

```jsonc
// ko.json
"editButton": "편집",
"saveButton": "저장",
"cancelButton": "취소",
"savingLabel": "저장 중…",
"saveError": "저장 실패: {message}",
"recentlyUpdated": "최근 수정",
"masterOnlyTooltip": "편집은 MASTER 권한이 필요합니다."
```

```jsonc
// en.json
"editButton": "Edit",
"saveButton": "Save",
"cancelButton": "Cancel",
"savingLabel": "Saving…",
"saveError": "Save failed: {message}",
"recentlyUpdated": "Recently updated",
"masterOnlyTooltip": "Editing requires MASTER role."
```

```jsonc
// id.json
"editButton": "Edit",
"saveButton": "Simpan",
"cancelButton": "Batal",
"savingLabel": "Menyimpan…",
"saveError": "Gagal menyimpan: {message}",
"recentlyUpdated": "Baru diperbarui",
"masterOnlyTooltip": "Pengeditan memerlukan peran MASTER."
```

```jsonc
// ja.json
"editButton": "編集",
"saveButton": "保存",
"cancelButton": "キャンセル",
"savingLabel": "保存中…",
"saveError": "保存失敗: {message}",
"recentlyUpdated": "最近更新",
"masterOnlyTooltip": "編集にはMASTER権限が必要です。"
```

```jsonc
// zh.json
"editButton": "编辑",
"saveButton": "保存",
"cancelButton": "取消",
"savingLabel": "保存中…",
"saveError": "保存失败: {message}",
"recentlyUpdated": "最近更新",
"masterOnlyTooltip": "编辑需要MASTER权限。"
```

Use Edit tool with exact JSON insertion before the closing `}` of `operatorSettings.rules`. Make sure to add the comma after the prior last existing key in the rules object so JSON stays valid.

- [ ] **Step 5.3: Validate JSON**

Run:
```bash
for f in src/i18n/messages/{ko,en,id,ja,zh}.json; do
  npx tsx -e "JSON.parse(require('fs').readFileSync('$f','utf8'));" && echo "✓ $f" || echo "✗ $f"
done
```
Expected: `✓` for all 5 files.

- [ ] **Step 5.4: Commit (with Task 6/7)** — see Task 7.

---

## Task 6: TaxCodeRulesTable client component (read mode only)

**Files:**
- Create: `src/app/[locale]/(dashboard)/operator/settings/_components/TaxCodeRulesTable.tsx`

- [ ] **Step 6.1: Write the read-only skeleton**

Create directory + file:

```bash
mkdir -p src/app/\[locale\]/\(dashboard\)/operator/settings/_components
```

Create `src/app/[locale]/(dashboard)/operator/settings/_components/TaxCodeRulesTable.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { TaxCodeRule, TaxCodeRulePatch } from '@/types/tax-code-rule';

interface Props {
  initialRules: TaxCodeRule[];
  canEdit: boolean;
}

const QUERY_KEY = ['tax-code-rule'] as const;

async function fetchRules(): Promise<TaxCodeRule[]> {
  const r = await fetch('/api/admin/tax-code-rule', { cache: 'no-store' });
  if (!r.ok) throw new Error(`fetch failed: ${r.status}`);
  const j = await r.json();
  return j.data as TaxCodeRule[];
}

async function patchRule(id: string, patch: TaxCodeRulePatch): Promise<TaxCodeRule> {
  const r = await fetch(`/api/admin/tax-code-rule/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error?.formErrors?.[0] || j.error || `${r.status}`);
  return j.data as TaxCodeRule;
}

function isRecentlyUpdated(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < 24 * 60 * 60 * 1000;
}

export function TaxCodeRulesTable({ initialRules, canEdit }: Props) {
  const t = useTranslations('operatorSettings.rules');
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TaxCodeRulePatch>({});

  const { data: rules = initialRules } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchRules,
    initialData: initialRules,
  });

  const mutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TaxCodeRulePatch }) => patchRule(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      setEditingId(null);
      setDraft({});
      toast.success(t('saveButton'));
    },
    onError: (err: Error) => {
      toast.error(t('saveError', { message: err.message }));
    },
  });

  const startEdit = (row: TaxCodeRule) => {
    setEditingId(row.id);
    setDraft({
      tax_code: row.tax_code,
      rate_rule: row.rate_rule,
      condition_text: row.condition_text,
      doc_required: row.doc_required,
      review_note: row.review_note,
    });
  };
  const cancelEdit = () => {
    setEditingId(null);
    setDraft({});
  };
  const saveEdit = () => {
    if (!editingId) return;
    // Only send fields that actually changed.
    const original = rules.find((r) => r.id === editingId);
    if (!original) return;
    const diff: TaxCodeRulePatch = {};
    for (const k of ['tax_code', 'rate_rule', 'condition_text', 'doc_required', 'review_note'] as const) {
      if (draft[k] !== undefined && draft[k] !== original[k]) {
        diff[k] = draft[k];
      }
    }
    if (Object.keys(diff).length === 0) {
      cancelEdit();
      return;
    }
    mutation.mutate({ id: editingId, patch: diff });
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="text-left px-3 py-2">{t('colCategory')}</th>
            <th className="text-left px-3 py-2">{t('colCode')}</th>
            <th className="text-left px-3 py-2">{t('colRate')}</th>
            <th className="text-left px-3 py-2">{t('colCondition')}</th>
            <th className="text-left px-3 py-2">{t('colDoc')}</th>
            <th className="text-left px-3 py-2">{t('colReview')}</th>
            {canEdit && <th className="px-3 py-2 w-20" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rules.map((r) => {
            const editing = editingId === r.id;
            const recent = isRecentlyUpdated(r.updated_at);
            return (
              <tr key={r.id} className={editing ? 'bg-amber-50' : undefined}>
                <td className="px-3 py-2.5 font-bold text-slate-900 whitespace-nowrap">
                  {r.category}
                  {recent && (
                    <span className="ml-2 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700 border border-emerald-200">
                      {t('recentlyUpdated')}
                    </span>
                  )}
                </td>
                {editing ? (
                  <>
                    <td className="px-2 py-2"><input className="w-32 rounded border border-slate-300 px-2 py-1 font-mono text-xs" value={draft.tax_code ?? ''} onChange={(e) => setDraft((d) => ({ ...d, tax_code: e.target.value }))} /></td>
                    <td className="px-2 py-2"><textarea className="w-full rounded border border-slate-300 px-2 py-1 text-xs" rows={2} value={draft.rate_rule ?? ''} onChange={(e) => setDraft((d) => ({ ...d, rate_rule: e.target.value }))} /></td>
                    <td className="px-2 py-2"><textarea className="w-full rounded border border-slate-300 px-2 py-1 text-xs" rows={2} value={draft.condition_text ?? ''} onChange={(e) => setDraft((d) => ({ ...d, condition_text: e.target.value }))} /></td>
                    <td className="px-2 py-2"><textarea className="w-full rounded border border-slate-300 px-2 py-1 text-xs" rows={2} value={draft.doc_required ?? ''} onChange={(e) => setDraft((d) => ({ ...d, doc_required: e.target.value }))} /></td>
                    <td className="px-2 py-2"><textarea className="w-full rounded border border-slate-300 px-2 py-1 text-xs" rows={2} value={draft.review_note ?? ''} onChange={(e) => setDraft((d) => ({ ...d, review_note: e.target.value }))} /></td>
                    <td className="px-2 py-2 align-top">
                      <div className="flex flex-col gap-1">
                        <button type="button" disabled={mutation.isPending} onClick={saveEdit} className="rounded bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                          {mutation.isPending ? t('savingLabel') : t('saveButton')}
                        </button>
                        <button type="button" disabled={mutation.isPending} onClick={cancelEdit} className="rounded border border-slate-300 px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                          {t('cancelButton')}
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-2.5 font-mono text-slate-700">{r.tax_code}</td>
                    <td className="px-3 py-2.5 text-slate-700">{r.rate_rule}</td>
                    <td className="px-3 py-2.5 text-slate-700">{r.condition_text}</td>
                    <td className="px-3 py-2.5 text-slate-700">{r.doc_required}</td>
                    <td className="px-3 py-2.5 text-slate-700">{r.review_note}</td>
                    {canEdit && (
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          disabled={editingId !== null}
                          onClick={() => startEdit(r)}
                          className="rounded border border-slate-300 px-2.5 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-30"
                        >
                          {t('editButton')}
                        </button>
                      </td>
                    )}
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {!canEdit && (
        <p className="mt-2 text-[10px] text-slate-400">{t('masterOnlyTooltip')}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 6.2: Run TS check on the new file**

Run:
```bash
npx tsc --noEmit -p . 2>&1 | grep -E "TaxCodeRulesTable|tax-code-rule" | head
```
Expected: no errors mentioning these files.

- [ ] **Step 6.3: Commit (with Task 7)** — see Task 7.

---

## Task 7: Refactor `page.tsx` to server-component + use the child

**Files:**
- Modify: `src/app/[locale]/(dashboard)/operator/settings/page.tsx`

- [ ] **Step 7.1: Read the current file**

Open `src/app/[locale]/(dashboard)/operator/settings/page.tsx` and confirm the §3 block exists at the lines wrapping `<section>...<table>...</section>` rendering `TAX_RULES_KO`.

- [ ] **Step 7.2: Rewrite the file**

Replace the entire file with:

```tsx
/**
 * 세무 기준 설정 — Admin / Tax Engine 페이지. PDF p.26-27.
 *
 * Track A 이전이라 페이지 자체 접근은 operator/supervisor/master 모두 가능.
 * §3 "Tax Code Rules" 만 DB-backed + MASTER inline-editable (Track B);
 * 나머지 §1/§2/§4/§5 는 정적 view.
 */

import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { resolveUserRole } from '@/lib/auth/resolve-role';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { PageTitle } from '@/components/layout/PageTitle';
import { TaxCodeRulesTable } from './_components/TaxCodeRulesTable';
import type { TaxCodeRule } from '@/types/tax-code-rule';

interface AuditRow {
  titleKey: string;
  body: string;
  byKey: 'sampleByTaxAdmin' | 'sampleBySystem';
  ts: string;
  stateKey: 'stateApplied' | 'stateReviewing';
}

const AUDIT_ROWS: AuditRow[] = [
  { titleKey: 'SPT OP Form Profile', body: '1770/1770S/1770SS 선택 기준 대신 Coretax 단일 OP Form 기준 표시',          byKey: 'sampleByTaxAdmin', ts: '2026-05-25', stateKey: 'stateApplied' },
  { titleKey: 'PPh23/PPh4(2) 판단',  body: '건물 임대·서비스 혼합 계약은 Supervisor 검토필요로 상향',                  byKey: 'sampleByTaxAdmin', ts: '2026-05-25', stateKey: 'stateReviewing' },
  { titleKey: 'Coretax Integration', body: 'API 미연동 / 상담원 수동처리 기준 유지',                                  byKey: 'sampleBySystem',   ts: '2026-05-25', stateKey: 'stateApplied' },
];

export default async function OperatorSettingsPage() {
  const t = await getTranslations('operatorSettings');

  // Resolve current user role for canEdit gate.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const role = user ? await resolveUserRole(supabase, user.id) : null;
  const canEdit = role === 'TAX_OPERATOR_MASTER';

  // Fetch tax code rules (RLS allows all authenticated reads).
  const admin = getSupabaseAdmin();
  const { data: rulesRaw } = await admin
    .from('tax_code_rule')
    .select('*')
    .order('sort_order', { ascending: true });
  const rules = (rulesRaw ?? []) as TaxCodeRule[];

  return (
    <div className="container mx-auto py-6 px-4 max-w-[1400px]">
      <PageTitle title={t('pageTitle')} />

      {/* ── header ── */}
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-slate-900">{t('pageHeading')}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">{t('pageDesc')}</p>
        </div>
        <span className="flex-shrink-0 rounded-md bg-slate-900 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white">
          {t('adminBadge')}
        </span>
      </div>

      {/* ── 4-card header strip ── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-6">
        <Header label={t('header.fiscalYear')} value="2025" />
        <Header label={t('header.platform')} value="Coretax DJP" />
        <Header label={t('header.coretaxStatus')} value={t('header.coretaxStatusValue')} tone="amber" />
        <Header label={t('header.manageTarget')} value={t('header.manageTargetValue')} />
      </div>

      {/* ── §1 + §2 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <section className="rounded-2xl bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900">1. {t('badan.title')}</h2>
            <Pill tone="blue">Form Profile</Pill>
          </div>
          <p className="text-sm text-slate-600">{t('badan.desc')}</p>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-black text-slate-900">Badan Form Profile</h3>
              <Pill tone="slate">{t('badan.legacy')}</Pill>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-700">{t('badan.desc')}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <KeyVal label={t('badan.current')} value={t('badan.currentValue')} />
              <KeyVal label={t('badan.model')}   value={t('badan.modelValue')} />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-black text-slate-900">OP Form Profile</h3>
              <Pill tone="slate">{t('op.legacy')}</Pill>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-700">{t('op.desc')}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <KeyVal label={t('op.current')} value={t('op.currentValue')} />
              <KeyVal label={t('op.model')}   value={t('op.modelValue')} />
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-black text-slate-900">{t('control.title')}</h2>
            <Pill tone="indigo">{t('control.badge')}</Pill>
          </div>
          <div className="space-y-3">
            <ControlBox title={t('control.whyTitle')}     body={t('control.whyBody')} />
            <ControlBox title={t('control.whoTitle')}     body={t('control.whoBody')} />
            <ControlBox title={t('control.visibleTitle')} body={t('control.visibleBody')} />
            <ControlBox title={t('control.auditTitle')}   body={t('control.auditBody')} />
          </div>
        </section>
      </div>

      {/* ── §3 Tax Code Rules (DB-backed + inline edit) ── */}
      <section className="rounded-2xl bg-white p-5 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-black text-slate-900">{t('rules.title')}</h2>
          <Pill tone="blue">{t('rules.badge')}</Pill>
        </div>
        <p className="text-sm text-slate-600 mb-4">{t('rules.intro')}</p>
        <TaxCodeRulesTable initialRules={rules} canEdit={canEdit} />
      </section>

      {/* ── §4 + §5 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-black text-slate-900">{t('decision.title')}</h2>
            <Pill tone="blue">{t('decision.badge')}</Pill>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <DecisionBox title={t('decision.box1Title')} body={t('decision.box1Body')} />
            <DecisionBox title={t('decision.box2Title')} body={t('decision.box2Body')} />
            <DecisionBox title={t('decision.box3Title')} body={t('decision.box3Body')} />
            <DecisionBox title={t('decision.box4Title')} body={t('decision.box4Body')} />
            <DecisionBox title={t('decision.box5Title')} body={t('decision.box5Body')} />
            <DecisionBox title={t('decision.box6Title')} body={t('decision.box6Body')} />
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-black text-slate-900">{t('audit.title')}</h2>
            <Pill tone="blue">{t('audit.badge')}</Pill>
          </div>
          <ul className="space-y-3">
            {AUDIT_ROWS.map((row) => (
              <li key={row.titleKey} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold text-slate-900">{row.titleKey}</p>
                  <Pill tone={row.stateKey === 'stateApplied' ? 'emerald' : 'amber'}>
                    {t(`audit.${row.stateKey}`)}
                  </Pill>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600">{row.body}</p>
                <p className="mt-2 text-[10px] text-slate-400">
                  {row.ts} · {t(`audit.${row.byKey}`)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Header({ label, value, tone }: { label: string; value: string; tone?: 'amber' }) {
  const cls = tone === 'amber' ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200';
  return (
    <div className={`rounded-2xl border px-5 py-4 shadow-sm ${cls}`}>
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-0.5 text-base font-black text-slate-900">{value}</p>
    </div>
  );
}

function KeyVal({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-0.5 text-xs font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function ControlBox({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <p className="text-sm font-bold text-slate-900">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">{body}</p>
    </div>
  );
}

function DecisionBox({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="text-sm font-black text-slate-900">{title}</p>
      <p className="mt-2 text-xs leading-relaxed text-slate-700">{body}</p>
    </div>
  );
}

function Pill({ tone, children }: { tone: 'slate' | 'blue' | 'indigo' | 'amber' | 'emerald'; children: React.ReactNode }) {
  const cls =
    tone === 'blue'
      ? 'bg-blue-50 text-blue-700 border-blue-200'
      : tone === 'indigo'
      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
      : tone === 'amber'
      ? 'bg-amber-50 text-amber-800 border-amber-200'
      : tone === 'emerald'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${cls}`}>
      {children}
    </span>
  );
}
```

- [ ] **Step 7.3: TS check + lint**

Run:
```bash
npx tsc --noEmit -p . 2>&1 | grep -E "operator/settings" | head
npm run lint -- src/app/[locale]/\(dashboard\)/operator/settings 2>&1 | tail -20
```
Expected: no errors mentioning these files.

- [ ] **Step 7.4: Visual smoke (browser)**

Start dev server in background:
```bash
npm run dev
```
Wait until ready, then open:
```
http://localhost:3000/ko/operator/settings
```
- Login as `master.test@aipajak.com` — verify §3 table renders 7 rows with "편집" buttons on the right.
- Click "편집" on PPh21 row → 5 fields become editable, others get "편집" disabled.
- Type into `review_note` → "저장" → toast success → row returns to read mode with new text + "최근 수정" pill.
- Reload page → new value persists (DB ✓).
- Revert via UI to original value.

Sign out, login as `consultant.test@jakartatax.co.id` — verify §3 table renders 7 rows but NO "편집" buttons, with bottom note "편집은 MASTER 권한이 필요합니다."

- [ ] **Step 7.5: Commit Tasks 5+6+7 together**

```bash
git add src/i18n/messages/{ko,en,id,ja,zh}.json \
        src/app/\[locale\]/\(dashboard\)/operator/settings/_components/TaxCodeRulesTable.tsx \
        src/app/\[locale\]/\(dashboard\)/operator/settings/page.tsx
git commit -m "$(cat <<'EOF'
feat(tax-code-rule): inline-editable Tax Code Rules table (Track B 4/N)

§3 만 DB-backed client component (TaxCodeRulesTable) 로 분리,
page.tsx 는 server component 로 전환해 초기 7행 fetch + canEdit 결정.

- TAX_OPERATOR_MASTER 한테만 "편집" 버튼 노출 (다른 role 한테는
  read-only + "편집은 MASTER 권한이 필요합니다" 안내).
- 행별 inline 편집 (textarea 4개 + tax_code input). 동시에 한 행만.
- 저장 후 sonner toast + "최근 수정" pill (updated_at 24h 이내).
- 5 locale operatorSettings.rules.* 7키 추가.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Smoke test script

**Files:**
- Create: `scripts/test-tax-code-rule.ts`
- Modify: `package.json`, `scripts/test-smoke-all.ts`

- [ ] **Step 8.1: Write the script**

Create `scripts/test-tax-code-rule.ts`:

```ts
/**
 * Smoke test for Tax Code Rule (Track B):
 *   1.  MASTER GET → 200, 7 rows, expected category set
 *   2.  CONSULTANT_JTC GET → 200 (read allowed)
 *   3.  PLATFORM_ADMIN GET → 403 (blockPlatformAdmin)
 *   4.  MASTER PATCH PPh21.review_note → 200, value applied
 *   5.  re-GET → updated_by/updated_at reflect MASTER
 *   6.  MASTER PATCH revert → 200
 *   7.  SUPERVISOR PATCH → 403
 *   8.  TAX_OPERATOR PATCH → 403
 *   9.  CONSULTANT_JTC PATCH → 403
 *   10. PLATFORM_ADMIN PATCH → 403
 *   11. MASTER PATCH empty body → 400
 *   12. MASTER PATCH non-existent uuid → 404
 *
 * Prereq: master.test@aipajak.com seeded (seed-master-and-external.ts).
 * Migration 20260527000001_tax_code_rule.sql applied.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });
console.log(`📄 ${envFile}`);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const baseUrl =
  process.env.TEST_BASE_URL ||
  (envFile === '.env.production.local' ? 'https://ai-pajak.vercel.app' : 'http://localhost:3000');
console.log(`🌐 ${baseUrl}\n`);

const EXPECTED_CATEGORIES = ['PPh21', 'PPh23', 'PPh4(2)', 'PPh22', 'PPh26', 'PPN', 'PPh25'];
const ORIGINAL_PPH21_REVIEW = '직원구분/비과세/공제항목 확인';
const TEMP = `__SMOKE_${Date.now()}__`;

async function login(email: string): Promise<string | null> {
  const c = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: 'TestPassword123!' });
  if (error || !data.session?.access_token) {
    console.error(`✗ login ${email}: ${error?.message}`);
    return null;
  }
  return data.session.access_token;
}

async function get(token: string) {
  const r = await fetch(`${baseUrl}/api/admin/tax-code-rule`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

async function patch(token: string, id: string, body: object) {
  const r = await fetch(`${baseUrl}/api/admin/tax-code-rule/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

async function run() {
  console.log('🧪 Tax Code Rule smoke\n');
  let pass = 0;
  let fail = 0;

  const masterTok = await login('master.test@aipajak.com');
  const supTok = await login('supervisor.test@aipajak.com');
  const opTok = await login('operator.test@aipajak.com');
  const consTok = await login('consultant.test@jakartatax.co.id');
  const adminTok = await login('admin.test@aipajak.com');
  if (!masterTok || !supTok || !opTok || !consTok || !adminTok) process.exit(1);
  console.log('✅ all 5 actors logged in\n');

  // 1. MASTER GET
  const r1 = await get(masterTok);
  if (r1.status === 200 && Array.isArray(r1.body.data) && r1.body.data.length === 7) {
    const cats = r1.body.data.map((x: { category: string }) => x.category);
    if (EXPECTED_CATEGORIES.every((c) => cats.includes(c))) {
      console.log(`✅ 1. MASTER GET → 200, 7 rows, expected categories present`); pass++;
    } else {
      console.error(`✗ 1. MASTER GET categories mismatch: ${cats.join(',')}`); fail++;
    }
  } else {
    console.error(`✗ 1. MASTER GET unexpected:`, r1); fail++;
  }
  const pph21 = r1.body.data?.find((x: { category: string }) => x.category === 'PPh21');
  if (!pph21) { console.error('✗ PPh21 row missing — abort'); process.exit(1); }

  // 2. CONSULTANT GET
  const r2 = await get(consTok);
  if (r2.status === 200) { console.log(`✅ 2. CONSULTANT GET → 200`); pass++; }
  else { console.error(`✗ 2. CONSULTANT GET ${r2.status}`); fail++; }

  // 3. PLATFORM_ADMIN GET
  const r3 = await get(adminTok);
  if (r3.status === 403) { console.log(`✅ 3. PLATFORM_ADMIN GET → 403`); pass++; }
  else { console.error(`✗ 3. PLATFORM_ADMIN GET ${r3.status} (want 403)`); fail++; }

  // 4. MASTER PATCH
  const r4 = await patch(masterTok, pph21.id, { review_note: TEMP });
  if (r4.status === 200 && r4.body.data?.review_note === TEMP) {
    console.log(`✅ 4. MASTER PATCH applied`); pass++;
  } else {
    console.error(`✗ 4. MASTER PATCH:`, r4); fail++;
  }

  // 5. re-GET reflects updated_by
  const r5 = await get(masterTok);
  const reread = r5.body.data?.find((x: { category: string }) => x.category === 'PPh21');
  if (reread?.review_note === TEMP && reread?.updated_by) {
    console.log(`✅ 5. re-GET reflects update + updated_by set`); pass++;
  } else {
    console.error(`✗ 5. re-GET:`, reread); fail++;
  }

  // 6. revert
  const r6 = await patch(masterTok, pph21.id, { review_note: ORIGINAL_PPH21_REVIEW });
  if (r6.status === 200) { console.log(`✅ 6. revert ok`); pass++; }
  else { console.error(`✗ 6. revert:`, r6); fail++; }

  // 7. SUPERVISOR PATCH
  const r7 = await patch(supTok, pph21.id, { review_note: 'x' });
  if (r7.status === 403) { console.log(`✅ 7. SUPERVISOR PATCH → 403`); pass++; }
  else { console.error(`✗ 7. SUPERVISOR PATCH ${r7.status}`); fail++; }

  // 8. OPERATOR PATCH
  const r8 = await patch(opTok, pph21.id, { review_note: 'x' });
  if (r8.status === 403) { console.log(`✅ 8. OPERATOR PATCH → 403`); pass++; }
  else { console.error(`✗ 8. OPERATOR PATCH ${r8.status}`); fail++; }

  // 9. CONSULTANT PATCH
  const r9 = await patch(consTok, pph21.id, { review_note: 'x' });
  if (r9.status === 403) { console.log(`✅ 9. CONSULTANT PATCH → 403`); pass++; }
  else { console.error(`✗ 9. CONSULTANT PATCH ${r9.status}`); fail++; }

  // 10. ADMIN PATCH
  const r10 = await patch(adminTok, pph21.id, { review_note: 'x' });
  if (r10.status === 403) { console.log(`✅ 10. PLATFORM_ADMIN PATCH → 403`); pass++; }
  else { console.error(`✗ 10. PLATFORM_ADMIN PATCH ${r10.status}`); fail++; }

  // 11. empty body
  const r11 = await patch(masterTok, pph21.id, {});
  if (r11.status === 400) { console.log(`✅ 11. empty body → 400`); pass++; }
  else { console.error(`✗ 11. empty body ${r11.status}`); fail++; }

  // 12. non-existent uuid
  const r12 = await patch(masterTok, '00000000-0000-0000-0000-000000000000', { review_note: 'x' });
  if (r12.status === 404) { console.log(`✅ 12. non-existent uuid → 404`); pass++; }
  else { console.error(`✗ 12. non-existent uuid ${r12.status}`); fail++; }

  console.log(`\n— ${pass} pass / ${fail} fail —`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 8.2: Add `package.json` script**

Open `package.json` and add inside the `"scripts"` object (under `test:smoke:prod` for organization):

```jsonc
"test:tax-code-rule": "tsx scripts/test-tax-code-rule.ts",
```

- [ ] **Step 8.3: Register in smoke runner**

Open `scripts/test-smoke-all.ts`. Inside the `STEPS` array, add a new entry under "Supervisor ERP surfaces" group (or wherever you prefer — group with admin / config-y suites):

```ts
  { name: 'tax code rule CRUD + RBAC (Track B)', file: 'test-tax-code-rule.ts' },
```

- [ ] **Step 8.4: Run the script (prod target — dev server must be up if local)**

Run:
```bash
SEED_TARGET=prod npx tsx scripts/test-tax-code-rule.ts
```
Expected: `— 12 pass / 0 fail —` and exit 0.

If you have local dev running (`npm run dev`) and prefer local:
```bash
npx tsx scripts/test-tax-code-rule.ts
```

- [ ] **Step 8.5: Run the full smoke runner**

Run:
```bash
npm run test:smoke:prod 2>&1 | tail -30
```
Expected: roll-up shows `tax code rule CRUD + RBAC (Track B)` as PASS. Pre-existing optional steps may stay optional.

- [ ] **Step 8.6: Commit**

```bash
git add scripts/test-tax-code-rule.ts scripts/test-smoke-all.ts package.json
git commit -m "$(cat <<'EOF'
test(tax-code-rule): 12-assertion smoke + smoke-runner wiring (Track B 5/5)

GET MASTER/CONSULTANT/PLATFORM_ADMIN, PATCH 5 roles + empty body + 404.
Runner step "tax code rule CRUD + RBAC (Track B)" 추가, package.json
test:tax-code-rule 단독 실행 스크립트.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Update CLAUDE.md regression list

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 9.1: Add tax-code-rule script to "Individual scripts" section**

Open `CLAUDE.md`. Find the "Individual scripts (if you need to focus on one area):" list. Add one line:

```markdown
- `SEED_TARGET=prod npx tsx scripts/test-tax-code-rule.ts` — Track B Tax Code Rule CRUD + RBAC (GET MASTER/CONSULTANT/PLATFORM_ADMIN, PATCH 5 roles + 400 + 404)
```

Also update the integrated runner description if specific step count is mentioned ("12 steps in sequence" → "13 steps"); verify the line in CLAUDE.md before editing.

- [ ] **Step 9.2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(CLAUDE.md): tax-code-rule smoke script + runner step count

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Push + verify on Vercel prod

- [ ] **Step 10.1: Push**

```bash
git push origin main
```

- [ ] **Step 10.2: Wait for Vercel deploy**

Watch `https://vercel.com/<team>/ai-pajak/deployments` (or `vercel inspect --logs <url>`) until prod deploy ready.

- [ ] **Step 10.3: Re-run prod smoke against deployed URL**

```bash
SEED_TARGET=prod npx tsx scripts/test-tax-code-rule.ts
```
Expected: `— 12 pass / 0 fail —`.

- [ ] **Step 10.4: Visual smoke on prod**

Open `https://ai-pajak.vercel.app/ko/operator/settings`:
- Login as MASTER → edit + revert PPh21.review_note → confirm persistence.
- Login as SUPERVISOR/CONSULTANT → no "편집" buttons.

- [ ] **Step 10.5: Done — save project memory**

Create `/Users/winwaysystems/.claude/projects/-Users-winwaysystems-mywork-ai-pajak-ai-pajak/memory/project_2026_05_27_tax_code_rule_track_b.md` summarizing the batch (1 migration + 2 endpoints + 1 page refactor + 1 component + 5-locale i18n + 12-assert smoke), then add a one-line pointer to `MEMORY.md`.

---

## Out of scope (will become Track A/C/D)

- Track A: page-level access gate (현재 operator/supervisor/master 모두 진입 가능)
- Track C: §5 audit row list 를 `tax_code_rule_audit_log` 영구 테이블 + 동적 timeline 으로 교체
- Track D: Coretax API 토글을 env-var → DB-driven 으로 전환
