# Tax Code Rule — Audit Timeline (Track C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** §5 "기준 변경이력" 의 mock 3행을 실제 PATCH 이력 timeline 으로 교체. `audit_log` 재활용, PATCH 당 full diff 1행 기록, expandable before/after UI.

**Architecture:** PATCH 핸들러에서 `withAudit` 제거 → SELECT before → UPDATE → manual `recordAudit` (diff 포함). GET `/audit-log` endpoint 가 last N + actor email join. §5 가 정적 `<ul>` → 신규 client component `TaxCodeRuleAuditTimeline` 으로 교체. 신규 테이블 0개.

**Tech Stack:** Next.js 16 (server+client components), Supabase (audit_log JSONB), TypeScript strict, composeMiddleware, pino, sonner — Track B 와 동일 스택.

**Spec reference:** `docs/superpowers/specs/2026-05-27-tax-code-rule-audit-design.md`

---

## File Structure

**New files:**
- `src/app/api/admin/tax-code-rule/audit-log/route.ts` — GET endpoint (list with limit)
- `src/app/[locale]/(dashboard)/operator/settings/_components/TaxCodeRuleAuditTimeline.tsx` — client component

**Modified files:**
- `src/app/api/admin/tax-code-rule/[id]/route.ts` — withAudit 제거 + SELECT before + manual recordAudit
- `src/types/tax-code-rule.ts` — `AuditRowDTO` 타입 추가
- `src/app/[locale]/(dashboard)/operator/settings/page.tsx` — §5 replace + AUDIT_ROWS 삭제 + audit fetch
- `src/i18n/messages/{ko,en,id,ja,zh}.json` — 6 신규 키 + 3 mock 키 삭제
- `scripts/test-tax-code-rule.ts` — 3 assertion 추가 (12 → 15)

마이그레이션 신규: **0개**.

---

## Pre-flight

- [ ] **Step 0.1: Verify Track B 가 main 에 반영됐는지**

```bash
git log --oneline origin/main -1
```
Expected: 가장 최근 commit 이 `6df5d99` 이거나 그 이후 (Track B 마무리).

- [ ] **Step 0.2: 현 audit_log 상태 확인**

```bash
SEED_TARGET=prod npx tsx -e "
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production.local' });
const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
c.from('audit_log').select('id, activity_details, created_at').eq('activity_type', 'TAX_CODE_RULE_UPDATE').order('created_at', { ascending: false }).limit(5).then(r => console.log(JSON.stringify(r.error || r.data, null, 2)));
"
```
Expected: 0 행 (clean prod, Track B 의 smoke 가 revert 후 audit row 는 활성), 혹은 prior PATCH 의 intent rows (details: { method, url }). Track C 첫 PATCH 부터 diff 가 담긴 새 row 가 추가됨.

---

## Task 1: Modify PATCH endpoint — drop withAudit, add diff capture

**Files:**
- Modify: `src/app/api/admin/tax-code-rule/[id]/route.ts`

- [ ] **Step 1.1: Rewrite the handler**

Open `src/app/api/admin/tax-code-rule/[id]/route.ts` and replace the entire `handlePatch` + `PATCH` export to look like:

```ts
const PATCHABLE_FIELDS = ['tax_code', 'rate_rule', 'condition_text', 'doc_required', 'review_note'] as const;
type PatchableField = (typeof PATCHABLE_FIELDS)[number];

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

  // 1. SELECT before — needed for diff capture in audit log.
  const { data: before, error: selErr } = await admin
    .from('tax_code_rule')
    .select('*')
    .eq('id', id)
    .single();
  if (selErr) {
    if (selErr.code === 'PGRST116') {
      return NextResponse.json({ error: 'rule not found' }, { status: 404 });
    }
    loggers.api.error(
      { err: selErr.message, route: `/api/admin/tax-code-rule/${id}`, code: selErr.code },
      'tax_code_rule pre-update select failed',
    );
    return NextResponse.json({ error: 'Failed to update rule' }, { status: 500 });
  }

  // 2. UPDATE
  const { data: after, error: updErr } = await admin
    .from('tax_code_rule')
    .update({
      ...parsed.data,
      updated_by: req.session.userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();
  if (updErr) {
    loggers.api.error(
      { err: updErr.message, route: `/api/admin/tax-code-rule/${id}`, code: updErr.code },
      'tax_code_rule update failed',
    );
    return NextResponse.json({ error: 'Failed to update rule' }, { status: 500 });
  }

  // 3. Compute diff — only fields that actually changed.
  const beforeRule = before as TaxCodeRule;
  const afterRule = after as TaxCodeRule;
  const diff: Record<string, { before: string; after: string }> = {};
  for (const k of PATCHABLE_FIELDS) {
    if (parsed.data[k] !== undefined && beforeRule[k] !== afterRule[k]) {
      diff[k] = { before: beforeRule[k], after: afterRule[k] };
    }
  }

  // 4. Record audit row only if something actually changed (skip no-op PATCH).
  if (Object.keys(diff).length > 0) {
    await recordAudit({
      action: 'TAX_CODE_RULE_UPDATE',
      actorUserId: req.session.userId,
      actorRole: req.session.role,
      details: { ruleId: id, category: afterRule.category, diff },
      ipAddress:
        req.headers.get('x-forwarded-for') ||
        req.headers.get('x-real-ip') ||
        null,
      userAgent: req.headers.get('user-agent') || null,
    });
  }

  return NextResponse.json({ data: afterRule });
}

export async function PATCH(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(UserRole.TAX_OPERATOR_MASTER),
    // withAudit 제거 — handler 가 diff 와 함께 직접 recordAudit 호출.
  )(request as RequestWithSession, handlePatch);
}
```

You'll also need to add the `recordAudit` import at the top:
```ts
import { recordAudit } from '@/middleware/audit';
```
And remove the now-unused `withAudit` import.

- [ ] **Step 1.2: TS check**

```bash
npx tsc --noEmit -p . 2>&1 | head
```
Expected: 0 errors related to this file.

- [ ] **Step 1.3: Smoke (manual curl) — verify diff capture**

Dev server should be running (use Track B's pattern: swap `.env.local` ↔ `.env.production.local` if needed, restore after). Get MASTER token + PPh21 id, PATCH, then query audit_log directly:

```bash
TOKEN=$(SEED_TARGET=prod npx tsx -e "
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production.local' });
const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
c.auth.signInWithPassword({ email: 'master.test@aipajak.com', password: 'TestPassword123!' })
  .then(r => { console.log(r.data.session?.access_token || ''); });
")

ID=$(curl -sS http://localhost:3000/api/admin/tax-code-rule -H "Authorization: Bearer $TOKEN" | npx --yes jq -r '.data[] | select(.category=="PPh21") | .id')

# Capture original
ORIG=$(curl -sS http://localhost:3000/api/admin/tax-code-rule -H "Authorization: Bearer $TOKEN" | npx --yes jq -r '.data[] | select(.category=="PPh21") | .review_note')
echo "ORIG = $ORIG"

# PATCH with TEMP
curl -sS -X PATCH "http://localhost:3000/api/admin/tax-code-rule/$ID" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"review_note":"__TRACK_C_TEST__"}' | npx --yes jq .

# Verify audit_log
SEED_TARGET=prod npx tsx -e "
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production.local' });
const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
c.from('audit_log').select('activity_details, created_at').eq('activity_type', 'TAX_CODE_RULE_UPDATE').order('created_at', { ascending: false }).limit(1).then(r => console.log(JSON.stringify(r.data, null, 2)));
"
# Expected: most recent row has activity_details.diff.review_note.before === ORIG, .after === '__TRACK_C_TEST__'

# Revert
curl -sS -X PATCH "http://localhost:3000/api/admin/tax-code-rule/$ID" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"review_note\":\"$ORIG\"}" | npx --yes jq .
```

- [ ] **Step 1.4: Commit**

```bash
git add src/app/api/admin/tax-code-rule/\[id\]/route.ts
git commit -m "$(cat <<'EOF'
feat(tax-code-rule): PATCH 가 audit_log 에 full diff 기록 (Track C 1/N)

withAudit 미들웨어 제거 후 handler 가 SELECT before → UPDATE → diff
계산 → manual recordAudit. activity_details 에:
  { ruleId, category, diff: { field: { before, after } } }

이전엔 intent-only ({ method, url }) 행만 남아 "무엇이 어떻게 바뀌었나"
가 audit_log 에 없었음. no-op PATCH (UI diff-skip 통과 후 동일 값) 는
audit row 생성하지 않음.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: New TS type — AuditRowDTO

**Files:**
- Modify: `src/types/tax-code-rule.ts`

- [ ] **Step 2.1: Add `AuditRowDTO` interface**

Append to `src/types/tax-code-rule.ts`:

```ts
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
```

- [ ] **Step 2.2: Commit (with next task)** — see Task 3.

---

## Task 3: New GET endpoint — /audit-log

**Files:**
- Create: `src/app/api/admin/tax-code-rule/audit-log/route.ts`

- [ ] **Step 3.1: Write the handler**

Create directory + file:
```bash
mkdir -p "src/app/api/admin/tax-code-rule/audit-log"
```

Create `src/app/api/admin/tax-code-rule/audit-log/route.ts`:

```ts
/**
 * GET /api/admin/tax-code-rule/audit-log?limit=10
 *   → 200 { data: AuditRowDTO[] }  (created_at DESC)
 *
 * Read-only timeline of TAX_CODE_RULE_UPDATE audit_log rows.
 * All authenticated roles can read (PLATFORM_ADMIN blocked).
 * Actor email joined via auth.admin.getUserById per unique actor.
 */

import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import type { RequestWithSession } from '@/types/auth';
import type { AuditRowDTO } from '@/types/tax-code-rule';

interface AuditLogRow {
  id: string;
  actor_user_id: string;
  actor_role: string | null;
  activity_details: {
    ruleId?: string;
    category?: string;
    diff?: Record<string, { before: string; after: string }>;
  };
  created_at: string;
}

async function handleGet(req: RequestWithSession): Promise<Response> {
  const url = new URL((req as unknown as NextRequest).url);
  const limitParam = Number(url.searchParams.get('limit') ?? '10');
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 10;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('audit_log')
    .select('id, actor_user_id, actor_role, activity_details, created_at')
    .eq('activity_type', 'TAX_CODE_RULE_UPDATE')
    .order('created_at', { ascending: false })
    .limit(limit);

  const headers = { 'Cache-Control': 'no-store' };
  if (error) {
    loggers.api.error(
      { err: error.message, route: '/api/admin/tax-code-rule/audit-log', code: error.code },
      'tax_code_rule audit-log select failed',
    );
    return NextResponse.json({ error: 'Failed to load audit log' }, { status: 500, headers });
  }

  const rows = (data ?? []) as AuditLogRow[];

  // Join actor email via getUserById per unique actor (signup/route.ts:72 pattern).
  const userIds = [...new Set(rows.map((r) => r.actor_user_id))];
  const emailById = Object.fromEntries(
    await Promise.all(
      userIds.map(async (id) => {
        const { data: u } = await admin.auth.admin.getUserById(id);
        return [id, u.user?.email ?? null] as const;
      }),
    ),
  );

  const dto: AuditRowDTO[] = rows
    .filter((r) => r.activity_details?.ruleId && r.activity_details?.diff) // skip legacy intent-only rows
    .map((r) => ({
      id: r.id,
      ruleId: r.activity_details.ruleId!,
      category: r.activity_details.category ?? '',
      actorRole: r.actor_role,
      actorUserId: r.actor_user_id,
      actorEmail: emailById[r.actor_user_id] ?? null,
      createdAt: r.created_at,
      diff: r.activity_details.diff!,
    }));

  return NextResponse.json({ data: dto }, { headers });
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
  )(request as RequestWithSession, handleGet);
}
```

- [ ] **Step 3.2: TS check**

```bash
npx tsc --noEmit -p . 2>&1 | head
```
Expected: 0 errors related to new files.

- [ ] **Step 3.3: Smoke (manual curl)**

```bash
# (TOKEN already obtained from Task 1)
curl -sS "http://localhost:3000/api/admin/tax-code-rule/audit-log?limit=5" \
  -H "Authorization: Bearer $TOKEN" | npx --yes jq .
```

Expected: `{ "data": [ { id, ruleId, category, actorRole, actorUserId, actorEmail, createdAt, diff: { ... } } ] }`. 적어도 Task 1.3 의 PATCH 가 만든 row 한 개.

```bash
# PLATFORM_ADMIN 차단
ADMIN_TOK=$(SEED_TARGET=prod npx tsx -e "
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production.local' });
const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
c.auth.signInWithPassword({ email: 'admin.test@aipajak.com', password: 'TestPassword123!' })
  .then(r => { console.log(r.data.session?.access_token || ''); });
")
curl -sS -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/admin/tax-code-rule/audit-log" \
  -H "Authorization: Bearer $ADMIN_TOK"
```
Expected: `403`.

- [ ] **Step 3.4: Commit (combined with Task 2)**

```bash
git add src/types/tax-code-rule.ts src/app/api/admin/tax-code-rule/audit-log/route.ts
git commit -m "$(cat <<'EOF'
feat(tax-code-rule): GET /api/admin/tax-code-rule/audit-log (Track C 2/N)

read-only timeline endpoint, last N (default 10, max 50) TAX_CODE_RULE_UPDATE
audit_log 행. actor email 은 getUserById 로 unique actor 마다 parallel
조회 (signup/route.ts:72 패턴). PLATFORM_ADMIN 차단.

legacy intent-only 행 (Track C 이전의 withAudit 가 남긴 method/url 만
담긴 행) 은 filter 로 제외 — ruleId + diff 있는 행만 timeline 노출.

신규 AuditRowDTO 타입 추가.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: i18n keys (5 locale, 6 신규 + 3 삭제)

**Files:**
- Modify: `src/i18n/messages/{ko,en,id,ja,zh}.json`

- [ ] **Step 4.1: Add 6 new keys + remove 3 mock keys**

For each of 5 locale files (`ko`/`en`/`id`/`ja`/`zh`), in `operatorSettings.audit`:

**Add** (after existing `badge` / `title`):
| key | ko | en | id | ja | zh |
|---|---|---|---|---|---|
| `empty` | "아직 편집 이력이 없습니다." | "No edit history yet." | "Belum ada riwayat edit." | "編集履歴がありません。" | "暂无编辑历史。" |
| `changedFields` | "변경 필드" | "Changed fields" | "Bidang yang diubah" | "変更フィールド" | "更改字段" |
| `expandToggle` | "자세히" | "Details" | "Detail" | "詳細" | "详情" |
| `collapseToggle` | "접기" | "Collapse" | "Tutup" | "閉じる" | "收起" |
| `colBefore` | "이전" | "Before" | "Sebelum" | "変更前" | "之前" |
| `colAfter` | "변경 후" | "After" | "Setelah" | "変更後" | "之后" |

**Remove** (mock UI 사라지므로): `sampleByTaxAdmin`, `sampleBySystem`, `stateReviewing`. `stateApplied` 는 timeline state pill 에서 재활용하므로 유지.

Use Edit tool to apply both changes per file. Validate JSON afterwards:

```bash
for f in src/i18n/messages/{ko,en,id,ja,zh}.json; do
  npx tsx -e "JSON.parse(require('fs').readFileSync('$f','utf8'));" && echo "✓ $f" || echo "✗ $f"
done
```

- [ ] **Step 4.2: Commit (combined with Task 5+6)** — see Task 6.

---

## Task 5: New client component — TaxCodeRuleAuditTimeline

**Files:**
- Create: `src/app/[locale]/(dashboard)/operator/settings/_components/TaxCodeRuleAuditTimeline.tsx`

- [ ] **Step 5.1: Write the component**

Create `src/app/[locale]/(dashboard)/operator/settings/_components/TaxCodeRuleAuditTimeline.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { AuditRowDTO } from '@/types/tax-code-rule';

interface Props {
  initialRows: AuditRowDTO[];
}

function formatTs(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TaxCodeRuleAuditTimeline({ initialRows }: Props) {
  const t = useTranslations('operatorSettings.audit');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (initialRows.length === 0) {
    return (
      <p className="text-xs text-slate-500 italic py-4 text-center">{t('empty')}</p>
    );
  }

  return (
    <ul className="space-y-3">
      {initialRows.map((row) => {
        const expanded = expandedId === row.id;
        const fields = Object.keys(row.diff);
        return (
          <li key={row.id} className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-block rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700">
                    {row.category}
                  </span>
                  <span className="text-xs text-slate-600">
                    {t('changedFields')}: <code className="font-mono text-slate-800">{fields.join(', ')}</code>
                  </span>
                </div>
                <p className="mt-2 text-[10px] text-slate-400">
                  {formatTs(row.createdAt)} · {row.actorEmail ?? row.actorUserId}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                  {t('stateApplied')}
                </span>
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : row.id)}
                  className="text-[10px] font-bold text-slate-600 hover:text-slate-900"
                  aria-expanded={expanded}
                >
                  {expanded ? `▲ ${t('collapseToggle')}` : `▼ ${t('expandToggle')}`}
                </button>
              </div>
            </div>
            {expanded && (
              <div className="mt-3 space-y-2">
                {fields.map((f) => (
                  <div key={f} className="rounded-lg border border-slate-100 overflow-hidden">
                    <p className="bg-slate-50 px-3 py-1.5 text-[10px] font-bold text-slate-700 font-mono">{f}</p>
                    <div className="grid grid-cols-[60px_1fr] text-[11px]">
                      <p className="bg-rose-50 px-3 py-2 text-rose-700 font-bold">{t('colBefore')}</p>
                      <p className="bg-rose-50 px-3 py-2 text-rose-900 whitespace-pre-wrap break-words">{row.diff[f].before}</p>
                      <p className="bg-emerald-50 px-3 py-2 text-emerald-700 font-bold">{t('colAfter')}</p>
                      <p className="bg-emerald-50 px-3 py-2 text-emerald-900 whitespace-pre-wrap break-words">{row.diff[f].after}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 5.2: Commit (combined with Task 4+6)** — see Task 6.

---

## Task 6: Modify page.tsx — replace §5 with audit fetch

**Files:**
- Modify: `src/app/[locale]/(dashboard)/operator/settings/page.tsx`

- [ ] **Step 6.1: Apply the changes**

Open `src/app/[locale]/(dashboard)/operator/settings/page.tsx`. Make these surgical changes:

**A. Remove `AUDIT_ROWS` constant + the `AuditRow` interface** (lines 18-29 approximately — find and delete the entire block):

```ts
interface AuditRow {
  titleKey: string;
  body: string;
  byKey: 'sampleByTaxAdmin' | 'sampleBySystem';
  ts: string;
  stateKey: 'stateApplied' | 'stateReviewing';
}

const AUDIT_ROWS: AuditRow[] = [
  { titleKey: 'SPT OP Form Profile', body: ..., byKey: 'sampleByTaxAdmin', ts: '2026-05-25', stateKey: 'stateApplied' },
  { titleKey: 'PPh23/PPh4(2) 판단',  body: ..., byKey: 'sampleByTaxAdmin', ts: '2026-05-25', stateKey: 'stateReviewing' },
  { titleKey: 'Coretax Integration', body: ..., byKey: 'sampleBySystem',   ts: '2026-05-25', stateKey: 'stateApplied' },
];
```

**B. Add imports**:
```ts
import { TaxCodeRuleAuditTimeline } from './_components/TaxCodeRuleAuditTimeline';
import type { AuditRowDTO } from '@/types/tax-code-rule';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
```

**C. Add audit fetch in the server component body** (right after the `rules` fetch):

```ts
  // Audit timeline — last 10 PATCH events with full diff.
  const admin = getSupabaseAdmin();
  const { data: auditRaw } = await admin
    .from('audit_log')
    .select('id, actor_user_id, actor_role, activity_details, created_at')
    .eq('activity_type', 'TAX_CODE_RULE_UPDATE')
    .order('created_at', { ascending: false })
    .limit(10);

  const auditRows = (auditRaw ?? []) as Array<{
    id: string;
    actor_user_id: string;
    actor_role: string | null;
    activity_details: {
      ruleId?: string;
      category?: string;
      diff?: Record<string, { before: string; after: string }>;
    };
    created_at: string;
  }>;

  const userIds = [...new Set(auditRows.map((r) => r.actor_user_id))];
  const emailById = Object.fromEntries(
    await Promise.all(
      userIds.map(async (id) => {
        const { data: u } = await admin.auth.admin.getUserById(id);
        return [id, u.user?.email ?? null] as const;
      }),
    ),
  );

  const initialAuditRows: AuditRowDTO[] = auditRows
    .filter((r) => r.activity_details?.ruleId && r.activity_details?.diff)
    .map((r) => ({
      id: r.id,
      ruleId: r.activity_details.ruleId!,
      category: r.activity_details.category ?? '',
      actorRole: r.actor_role,
      actorUserId: r.actor_user_id,
      actorEmail: emailById[r.actor_user_id] ?? null,
      createdAt: r.created_at,
      diff: r.activity_details.diff!,
    }));
```

**D. Replace the §5 `<ul>` block** (the `.map((row) => (<li>...)...)` block inside §5) with:

```tsx
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-black text-slate-900">{t('audit.title')}</h2>
            <Pill tone="blue">{t('audit.badge')}</Pill>
          </div>
          <TaxCodeRuleAuditTimeline initialRows={initialAuditRows} />
        </section>
```

(Keep the outer §4+§5 grid wrapper; only the §5 inner content changes.)

- [ ] **Step 6.2: TS check + JSON validate**

```bash
npx tsc --noEmit -p . 2>&1 | head
for f in src/i18n/messages/{ko,en,id,ja,zh}.json; do
  npx tsx -e "JSON.parse(require('fs').readFileSync('$f','utf8'));" && echo "✓ $f" || echo "✗ $f"
done
```

- [ ] **Step 6.3: Visual smoke (optional, browser)**

If practical:
- Open `http://localhost:3000/ko/operator/settings`
- Login as MASTER
- §5 should now show the PATCH 1 made in Task 1.3 (and revert) — 2 audit rows
- Click "▼ 자세히" on the most recent row → before/after for `review_note` shown inline (red/green)
- "▲ 접기" closes
- Verify "변경 필드: review_note" and timestamp + actor email

If 0 audit rows in prod: edit PPh21 inline (UI), save, refresh → row appears.

- [ ] **Step 6.4: Commit Task 4+5+6 together**

```bash
git add src/i18n/messages/{ko,en,id,ja,zh}.json \
        src/app/\[locale\]/\(dashboard\)/operator/settings/_components/TaxCodeRuleAuditTimeline.tsx \
        src/app/\[locale\]/\(dashboard\)/operator/settings/page.tsx
git commit -m "$(cat <<'EOF'
feat(tax-code-rule): §5 audit timeline 동적 교체 (Track C 3/N)

mock 3행 (SPT/PPh23/Coretax 안내) → DB last 10 PATCH 이력 timeline.

- 신규 client component TaxCodeRuleAuditTimeline: 행마다 category pill +
  변경 필드 리스트 + timestamp + actor email + applied pill + 확장 토글.
  확장 시 변경 필드별 before/after 표 (rose/emerald).
- page.tsx: AUDIT_ROWS 상수 + 정적 <ul> 삭제, server-side 로 last 10
  audit_log 행 fetch + actor email join 후 client 컴포넌트에 전달.
- i18n: audit.empty/changedFields/expandToggle/collapseToggle/colBefore/
  colAfter 6키 × 5 locale 신규. 사용처 사라진 sampleByTaxAdmin/
  sampleBySystem/stateReviewing 3키 삭제.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Extend smoke script — 3 new assertions

**Files:**
- Modify: `scripts/test-tax-code-rule.ts`

- [ ] **Step 7.1: Add 3 assertions after assertion 12**

Open `scripts/test-tax-code-rule.ts`. Right after assertion 12 (non-existent uuid 404), before the final `console.log(\`\n— ${pass} pass / ${fail} fail —\`)` summary, insert:

```ts
  // 13. MASTER GET audit-log → 200, array
  async function getAudit(token: string, limit = 10) {
    const r = await fetch(`${baseUrl}/api/admin/tax-code-rule/audit-log?limit=${limit}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  }
  const r13 = await getAudit(masterTok);
  if (r13.status === 200 && Array.isArray(r13.body.data)) {
    console.log(`✅ 13. MASTER GET audit-log → 200, ${r13.body.data.length} rows`); pass++;
  } else {
    console.error(`✗ 13. MASTER GET audit-log:`, r13); fail++;
  }

  // 14. PATCH 후 audit-log 첫 행 = 방금 변경
  const TEMP2 = `__SMOKE_AUDIT_${Date.now()}__`;
  const r14p = await patch(masterTok, pph21.id, { review_note: TEMP2 });
  if (r14p.status !== 200) {
    console.error(`✗ 14. setup PATCH failed:`, r14p); fail++;
  } else {
    const r14 = await getAudit(masterTok, 1);
    const first = r14.body.data?.[0];
    const matches =
      first?.ruleId === pph21.id &&
      first?.category === 'PPh21' &&
      first?.diff?.review_note?.before === originalReviewNote &&
      first?.diff?.review_note?.after === TEMP2;
    if (matches) {
      console.log(`✅ 14. audit-log 첫 행 = 방금 PATCH (before/after 정확)`); pass++;
    } else {
      console.error(`✗ 14. audit-log first row mismatch:`, first); fail++;
    }
    // revert
    await patch(masterTok, pph21.id, { review_note: originalReviewNote });
  }

  // 15. PLATFORM_ADMIN GET audit-log → 403
  const r15 = await getAudit(adminTok);
  if (r15.status === 403) { console.log(`✅ 15. PLATFORM_ADMIN GET audit-log → 403`); pass++; }
  else { console.error(`✗ 15. PLATFORM_ADMIN GET audit-log ${r15.status}`); fail++; }
```

- [ ] **Step 7.2: Run the smoke (dev server up against prod Supabase)**

```bash
SEED_TARGET=prod TEST_BASE_URL=http://localhost:3000 npx tsx scripts/test-tax-code-rule.ts
```
Expected: `— 15 pass / 0 fail —` and exit 0.

If failure: diagnose root cause (not paper over). Likely:
- audit-log endpoint not registered (restart dev server)
- audit row not created (Task 1 PATCH didn't call recordAudit — check the `if (Object.keys(diff).length > 0)` guard)

- [ ] **Step 7.3: Commit**

```bash
git add scripts/test-tax-code-rule.ts
git commit -m "$(cat <<'EOF'
test(tax-code-rule): 3 audit-log assertions (Track C 4/N)

12 → 15:
  13. MASTER GET /audit-log → 200, array
  14. PATCH 후 첫 audit-log 행 = 방금 변경 (ruleId/category/before/after 정확)
  15. PLATFORM_ADMIN GET /audit-log → 403

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Update CLAUDE.md + push + verify prod

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 8.1: Update CLAUDE.md**

CLAUDE.md 의 "Individual scripts" 의 tax-code-rule 라인 갱신:
```markdown
- `SEED_TARGET=prod npx tsx scripts/test-tax-code-rule.ts` — Track B+C Tax Code Rule CRUD + RBAC + audit timeline (GET 3 role + PATCH 5 role + 400/404 + audit-log 3 assertion, 총 15)
```

(Track B 라인을 그대로 in-place 갱신; 새 줄 추가하지 않음.)

- [ ] **Step 8.2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(CLAUDE.md): tax-code-rule smoke 15 assertions (Track C)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 8.3: Push**

```bash
git push origin main
```

- [ ] **Step 8.4: Wait for Vercel deploy**

```bash
for i in $(seq 1 30); do
  CODE=$(curl -sS -o /dev/null -w "%{http_code}" https://ai-pajak.vercel.app/api/admin/tax-code-rule/audit-log)
  if [ "$CODE" = "401" ]; then
    echo "Deploy ready (401 from middleware) — $i × 20s"
    break
  fi
  echo "wait $i — got $CODE"
  sleep 20
done
```

- [ ] **Step 8.5: Prod smoke (15/15)**

```bash
SEED_TARGET=prod npx tsx scripts/test-tax-code-rule.ts
```
Expected: `— 15 pass / 0 fail —`.

- [ ] **Step 8.6: Save project memory**

Create `/Users/winwaysystems/.claude/projects/-Users-winwaysystems-mywork-ai-pajak-ai-pajak/memory/project_2026_05_27_tax_code_rule_track_c.md`:

```markdown
---
name: 2026-05-27 Track C Tax Code Rule audit timeline 완료
description: §5 mock 3행 → 실제 PATCH 이력 timeline. audit_log 재활용 + withAudit 제거 + manual recordAudit (full diff). 신규 endpoint + 신규 client component + 15-assert smoke.
type: project
---

(...summary similar to Track B memory...)
```

Add one-line pointer to `MEMORY.md` right after the Track B pointer.

---

## Out of scope (will become Track A/D)

- **Track A**: page-level access gate
- **Track D**: Coretax API 토글 (env → DB-driven)
- 변경 announcements/changelog 메뉴 (mock 3행의 "공지" 의도, 별도 트랙)
- audit_log retention 정책
- inline diff 의 syntax highlighting / character-level diff
