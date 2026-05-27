# Coretax Toggle — env → DB-driven (Track D) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `CORETAX_SUBMIT_ENABLED` env → DB-driven 토글. MASTER 가 `/operator/settings` 의 Coretax 카드에서 즉시 ON/OFF flip. credentials (URL/token/timeout) 는 env 유지.

**Architecture:** 신규 `system_setting` 테이블 (generic kv, MASTER-write RLS). `isEnabled()` sync→async + 60s in-memory cache + PATCH 시 invalidation. 신규 GET/PATCH endpoint + 신규 client component CoretaxStatusCard (page §3 카드 교체).

**Tech Stack:** Next.js 16 server+client components, Supabase RLS, composeMiddleware, Zod 4, sonner toast, vitest mock.

**Spec reference:** `docs/superpowers/specs/2026-05-27-coretax-toggle-design.md`

---

## File Structure

**New files:**
- `supabase/migrations/20260527000003_system_setting.sql` — table + RLS + seed + ENUM add
- `src/app/api/admin/coretax/config/route.ts` — GET + PATCH
- `src/app/[locale]/(dashboard)/operator/settings/_components/CoretaxStatusCard.tsx`
- `scripts/test-coretax-toggle.ts` — 5 assertion smoke

**Modified files:**
- `src/lib/coretax/client.ts` — `isEnabled()` async + cache + invalidate
- `src/lib/coretax/client.test.ts` — DB mock 으로 재작성
- `src/app/api/operator/cases/[id]/coretax/route.ts` — 4 곳 `await coretax.isEnabled()`
- `src/app/api/tax/annual-closing/[id]/submit/route.ts` — env 참조 → `await coretax.isEnabled()`
- `src/app/[locale]/(dashboard)/operator/settings/page.tsx` — coretax fetch + 카드 교체
- `src/i18n/messages/{ko,en,id,ja,zh}.json` — 3 신규 + 1 삭제
- `scripts/test-smoke-all.ts` — step 추가
- `package.json` — `test:coretax-toggle` 단독 스크립트
- `CLAUDE.md` — env deprecate 명시 + 새 smoke 라인

마이그레이션 신규: 1.

---

## Pre-flight

- [ ] **Step 0.1: Track A 가 prod 에 반영됨**
```bash
git log --oneline origin/main -1
```
Expected: `472e427` (Track A 마지막) 이거나 그 이후 + 본 task 의 spec commit `e238562`.

- [ ] **Step 0.2: Prod 의 현 `CORETAX_SUBMIT_ENABLED` 값 확인**
```bash
grep "CORETAX_SUBMIT_ENABLED" .env.production.local 2>/dev/null || echo "(env 파일에 없음)"
```
Expected: false 또는 unset. 마이그레이션 seed `{enabled: false}` 와 일관이라 deploy 후 동작 변화 없음. 만약 prod 가 true 였으면 deploy 직후 manual mode 로 잠시 바뀜 — master 가 UI 로 다시 ON 해야 함.

---

## Task 1: Migration (`20260527000003_system_setting.sql`)

**Files:**
- Create: `supabase/migrations/20260527000003_system_setting.sql`

- [ ] **Step 1.1: Write the migration**

Create the file with exactly:

```sql
-- Generic platform-level kv store. Today's only row: coretax.submit_enabled.
-- Read = all authenticated; Update = TAX_OPERATOR_MASTER. No INSERT/DELETE
-- from app (rows added via migrations only). Track D of PDF p.26 §3 Coretax
-- Status card — moves the toggle out of CORETAX_SUBMIT_ENABLED env var.

CREATE TABLE system_setting (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_by  UUID REFERENCES auth.users(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE system_setting IS
  'Platform-level config kv. MASTER edits only. Today: coretax.submit_enabled.';

ALTER TABLE system_setting ENABLE ROW LEVEL SECURITY;

CREATE POLICY system_setting_read ON system_setting
  FOR SELECT TO authenticated USING (true);

CREATE POLICY system_setting_master_update ON system_setting
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'TAX_OPERATOR_MASTER'
        AND user_roles.is_active = true
    )
  );

-- No INSERT or DELETE policy → seed-only via migration.

-- Seed (idempotent). Default OFF — master flips via UI after deploy.
INSERT INTO system_setting (key, value) VALUES
  ('coretax.submit_enabled', '{"enabled": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Track D 의 audit action 을 activity_type ENUM 에 추가 (Track C 의
-- audit_tax_code_rule_enum 패턴과 동일).
DO $$ BEGIN
  ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'CORETAX_TOGGLE';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
```

- [ ] **Step 1.2: Apply to prod**

```bash
supabase db push --include-all --linked
```
Expected: 마이그레이션 적용 완료 로그.

- [ ] **Step 1.3: Verify prod**

```bash
SEED_TARGET=prod npx tsx -e "
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production.local' });
const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
c.from('system_setting').select('*').eq('key', 'coretax.submit_enabled').single().then(r => console.log(JSON.stringify(r.data || r.error, null, 2)));
"
```
Expected: `{ key: 'coretax.submit_enabled', value: { enabled: false }, ... }`.

또한 ENUM:
```bash
SEED_TARGET=prod npx tsx -e "
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production.local' });
const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
c.from('audit_log').insert({
  activity_type: 'CORETAX_TOGGLE',
  actor_user_id: '00000000-0000-0000-0000-000000000000',
  activity_details: { test: 'enum_check' }
}).then(r => console.log('insert ok:', !r.error, r.error?.message || ''));
"
```
Expected: actor_user_id FK error (= ENUM 자체는 valid). Track B 의 enum verification 패턴.

- [ ] **Step 1.4: Commit**

```bash
git add supabase/migrations/20260527000003_system_setting.sql
git commit -m "$(cat <<'EOF'
feat(system-setting): generic kv table + coretax toggle seed (Track D 1/N)

신규 system_setting (TEXT key PK + JSONB value + updated_by/_at).
RLS: read=all auth, UPDATE=MASTER, no INSERT/DELETE (seed-only).
오늘 1행: coretax.submit_enabled = {enabled: false}.

audit ENUM 에 'CORETAX_TOGGLE' 추가 (Track C 의 audit enum 패턴).

PDF p.26 §3 Coretax Status 카드의 정적 라벨을 라이브 토글로 전환
하는 Track D 의 schema 기반. 후속 commit: client lib async + GET/
PATCH endpoint + UI 카드 + smoke.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `src/lib/coretax/client.ts` — async isEnabled + cache

**Files:**
- Modify: `src/lib/coretax/client.ts`

- [ ] **Step 2.1: Replace isEnabled + add cache + invalidate**

Open `src/lib/coretax/client.ts`. Add import at top:
```ts
import { getSupabaseAdmin } from '@/lib/supabase/admin';
```

Replace the existing `isEnabled()` function (currently sync, env-based) with:

```ts
let enabledCache: { value: boolean; expiresAt: number } | null = null;
const ENABLED_CACHE_TTL_MS = 60_000;

/**
 * DB-backed (Track D): system_setting.coretax.submit_enabled + credentials
 * presence check. 60s in-memory cache; PATCH endpoint calls
 * invalidateEnabledCache() after master flips the toggle.
 *
 * env CORETAX_SUBMIT_ENABLED 는 더 이상 참조하지 않음 (Track D 에서
 * deprecate). URL/token/timeout 은 여전히 env.
 */
export async function isEnabled(): Promise<boolean> {
  if (enabledCache && enabledCache.expiresAt > Date.now()) {
    return enabledCache.value;
  }
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from('system_setting')
    .select('value')
    .eq('key', 'coretax.submit_enabled')
    .single();
  const dbEnabled = (data?.value as { enabled?: boolean } | undefined)?.enabled === true;
  const cfg = readConfig();
  const value = dbEnabled && !!(cfg.baseUrl && cfg.token);
  enabledCache = { value, expiresAt: Date.now() + ENABLED_CACHE_TTL_MS };
  return value;
}

/** PATCH endpoint 가 toggle 후 호출. test helper 로도 사용. */
export function invalidateEnabledCache(): void {
  enabledCache = null;
}
```

Update `call()` to await the now-async `isEnabled`:

Find:
```ts
async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  if (!isEnabled()) {
```
Change to:
```ts
async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  if (!(await isEnabled())) {
```

- [ ] **Step 2.2: TS check**

```bash
npx tsc --noEmit -p . 2>&1 | head -30
```
Expected: 에러 발생 — 호출자들이 sync 사용 중. Task 3 에서 fix.

- [ ] **Step 2.3: Commit (with Task 3)** — see Task 3.

---

## Task 3: Callers — 5 await additions

**Files:**
- Modify: `src/app/api/operator/cases/[id]/coretax/route.ts`
- Modify: `src/app/api/tax/annual-closing/[id]/submit/route.ts`

- [ ] **Step 3.1: operator/cases/[id]/coretax/route.ts — 4 changes**

Open and apply at lines (line numbers approximate, find via grep):

Line ~149:
```ts
coretaxMode: coretax.isEnabled() ? 'API (auto)' : 'Manual access',
```
→
```ts
coretaxMode: (await coretax.isEnabled()) ? 'API (auto)' : 'Manual access',
```

Line ~151:
```ts
apiEnabled: coretax.isEnabled(),
```
→
```ts
apiEnabled: await coretax.isEnabled(),
```

Line ~248:
```ts
if (!billingId && coretax.isEnabled()) {
```
→
```ts
if (!billingId && (await coretax.isEnabled())) {
```

Line ~298:
```ts
if (!bpeNumber && coretax.isEnabled()) {
```
→
```ts
if (!bpeNumber && (await coretax.isEnabled())) {
```

Confirm all 4 are now awaited:
```bash
grep -n "coretax.isEnabled" src/app/api/operator/cases/\[id\]/coretax/route.ts
```
Expected: all 4 lines have `await`.

- [ ] **Step 3.2: tax/annual-closing/[id]/submit/route.ts**

Find:
```ts
const useCoretaxApi = process.env.CORETAX_SUBMIT_ENABLED === 'true';
```
Change to:
```ts
const useCoretaxApi = await coretax.isEnabled();
```

Add import if not present:
```ts
import * as coretax from '@/lib/coretax/client';
```

- [ ] **Step 3.3: Project-wide grep — no remaining sync `isEnabled` or env reference**

```bash
grep -rn "coretax\.isEnabled\(\)" src/ --include="*.ts" --include="*.tsx" | grep -v "await\|invalidate" | grep -v test
```
Expected: empty (or only `await coretax.isEnabled()` lines).

```bash
grep -rn "CORETAX_SUBMIT_ENABLED" src/ --include="*.ts" --include="*.tsx"
```
Expected: 1 reference only — `src/lib/coretax/client.ts` 의 JSDoc 또는 deprecated 코멘트. (Cleanup 후엔 0.)

If JSDoc 의 4개 env var 목록에 SUBMIT_ENABLED 가 남아있다면 "DEPRECATED — moved to system_setting (Track D)" 로 갱신.

- [ ] **Step 3.4: TS check**

```bash
npx tsc --noEmit -p . 2>&1 | head -20
```
Expected: 0 errors.

- [ ] **Step 3.5: Commit (Tasks 2 + 3 together)**

```bash
git add src/lib/coretax/client.ts \
        src/app/api/operator/cases/\[id\]/coretax/route.ts \
        src/app/api/tax/annual-closing/\[id\]/submit/route.ts
git commit -m "$(cat <<'EOF'
feat(coretax): isEnabled() DB-backed async + 60s cache (Track D 2/N)

- src/lib/coretax/client.ts: isEnabled() 가 system_setting.coretax.
  submit_enabled 를 읽고 60s in-memory cache. credentials (URL/token)
  presence guard 는 그대로. env CORETAX_SUBMIT_ENABLED 참조 제거.
- invalidateEnabledCache() export — PATCH endpoint 가 호출.
- call() 의 isEnabled gate 도 await 로 갱신.
- operator/cases/[id]/coretax/route.ts: 4 곳 await 추가.
- tax/annual-closing/[id]/submit/route.ts: env 참조 → await isEnabled().

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `client.test.ts` — DB mock 으로 재작성

**Files:**
- Modify: `src/lib/coretax/client.test.ts`

- [ ] **Step 4.1: Read current test file**

```bash
cat src/lib/coretax/client.test.ts
```
Note the existing 5 test cases (env-based). Identify imports + structure.

- [ ] **Step 4.2: Rewrite tests**

Replace the existing `isEnabled` tests with DB-mocked versions. Use Vitest `vi.mock` to stub `getSupabaseAdmin`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isEnabled, invalidateEnabledCache } from './client';

// Mock getSupabaseAdmin
const mockSingle = vi.fn();
vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: mockSingle,
        }),
      }),
    }),
  }),
}));

// Helper to set env for credentials guard
function setEnv(vars: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

describe('coretax client.isEnabled()', () => {
  beforeEach(() => {
    invalidateEnabledCache();
    mockSingle.mockReset();
  });

  afterEach(() => {
    setEnv({
      CORETAX_API_BASE_URL: undefined,
      CORETAX_API_TOKEN: undefined,
    });
  });

  it('returns false when system_setting row missing', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
    setEnv({ CORETAX_API_BASE_URL: 'https://x', CORETAX_API_TOKEN: 't' });
    expect(await isEnabled()).toBe(false);
  });

  it('returns false when DB has enabled=false', async () => {
    mockSingle.mockResolvedValue({ data: { value: { enabled: false } }, error: null });
    setEnv({ CORETAX_API_BASE_URL: 'https://x', CORETAX_API_TOKEN: 't' });
    expect(await isEnabled()).toBe(false);
  });

  it('returns false when DB says enabled but credentials missing', async () => {
    mockSingle.mockResolvedValue({ data: { value: { enabled: true } }, error: null });
    setEnv({ CORETAX_API_BASE_URL: undefined, CORETAX_API_TOKEN: 't' });
    expect(await isEnabled()).toBe(false);
  });

  it('returns true when DB enabled + URL + token all present', async () => {
    mockSingle.mockResolvedValue({ data: { value: { enabled: true } }, error: null });
    setEnv({ CORETAX_API_BASE_URL: 'https://api.test', CORETAX_API_TOKEN: 'tok' });
    expect(await isEnabled()).toBe(true);
  });

  it('caches result for repeated calls (DB query only once)', async () => {
    mockSingle.mockResolvedValue({ data: { value: { enabled: true } }, error: null });
    setEnv({ CORETAX_API_BASE_URL: 'https://x', CORETAX_API_TOKEN: 't' });
    await isEnabled();
    await isEnabled();
    await isEnabled();
    expect(mockSingle).toHaveBeenCalledTimes(1);
  });

  it('invalidateEnabledCache() forces re-read', async () => {
    mockSingle.mockResolvedValue({ data: { value: { enabled: true } }, error: null });
    setEnv({ CORETAX_API_BASE_URL: 'https://x', CORETAX_API_TOKEN: 't' });
    await isEnabled();
    invalidateEnabledCache();
    await isEnabled();
    expect(mockSingle).toHaveBeenCalledTimes(2);
  });
});
```

(If existing file 안에 비-isEnabled 테스트가 있으면 보존. 위는 isEnabled 그룹만 교체.)

- [ ] **Step 4.3: Run the tests**

```bash
npx vitest run src/lib/coretax/client.test.ts 2>&1 | tail -20
```
Expected: all tests PASS.

- [ ] **Step 4.4: Commit**

```bash
git add src/lib/coretax/client.test.ts
git commit -m "$(cat <<'EOF'
test(coretax): client.test.ts DB mock 재작성 (Track D 3/N)

기존 5 test 가 env 기반이라 isEnabled() async 전환 후 모두 fail.
vi.mock 으로 getSupabaseAdmin 의 from().select().eq().single() chain
스텁 + 6 test: missing row / enabled=false / credentials missing /
all present / cache hit / invalidate.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: GET + PATCH endpoint

**Files:**
- Create: `src/app/api/admin/coretax/config/route.ts`

- [ ] **Step 5.1: Write the file**

Create directory + file:
```bash
mkdir -p "src/app/api/admin/coretax/config"
```

Create `src/app/api/admin/coretax/config/route.ts`:

```ts
/**
 * GET   /api/admin/coretax/config — SUPERVISOR/MASTER. Returns toggle state.
 * PATCH /api/admin/coretax/config — MASTER only. Body { enabled: boolean }.
 *
 * Track D: env CORETAX_SUBMIT_ENABLED 를 대체하는 DB-backed 토글. Master
 * flip 후 lib cache 즉시 invalidate + audit_log 에 CORETAX_TOGGLE 행
 * 기록 (Track C 의 manual recordAudit 패턴).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireRole } from '@/middleware/rbac';
import { recordAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import { UserRole, type RequestWithSession } from '@/types/auth';
import { invalidateEnabledCache } from '@/lib/coretax/client';

const KEY = 'coretax.submit_enabled';

interface ConfigDTO {
  enabled: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

async function handleGet(_req: RequestWithSession): Promise<Response> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('system_setting')
    .select('value, updated_by, updated_at')
    .eq('key', KEY)
    .single();

  const headers = { 'Cache-Control': 'no-store' };
  if (error && error.code !== 'PGRST116') {
    loggers.api.error(
      { err: error.message, code: error.code, route: '/api/admin/coretax/config' },
      'coretax config select failed',
    );
    return NextResponse.json({ error: 'Failed to load Coretax config' }, { status: 500, headers });
  }
  const dto: ConfigDTO = {
    enabled: (data?.value as { enabled?: boolean } | undefined)?.enabled === true,
    updatedAt: data?.updated_at ?? null,
    updatedBy: data?.updated_by ?? null,
  };
  return NextResponse.json({ data: dto }, { headers });
}

const patchSchema = z.object({ enabled: z.boolean() });

async function handlePatch(req: RequestWithSession): Promise<Response> {
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // 1. SELECT before
  const { data: before, error: selErr } = await admin
    .from('system_setting')
    .select('value')
    .eq('key', KEY)
    .single();
  if (selErr) {
    if (selErr.code === 'PGRST116') {
      return NextResponse.json({ error: 'coretax.submit_enabled row not seeded' }, { status: 500 });
    }
    loggers.api.error(
      { err: selErr.message, code: selErr.code, route: '/api/admin/coretax/config' },
      'coretax config pre-update select failed',
    );
    return NextResponse.json({ error: 'Failed to update Coretax config' }, { status: 500 });
  }
  const oldEnabled = (before?.value as { enabled?: boolean } | undefined)?.enabled === true;
  const newEnabled = parsed.data.enabled;

  // 2. UPDATE
  const { data: after, error: updErr } = await admin
    .from('system_setting')
    .update({
      value: { enabled: newEnabled },
      updated_by: req.session.userId,
      updated_at: new Date().toISOString(),
    })
    .eq('key', KEY)
    .select('value, updated_by, updated_at')
    .single();
  if (updErr) {
    loggers.api.error(
      { err: updErr.message, code: updErr.code, route: '/api/admin/coretax/config' },
      'coretax config update failed',
    );
    return NextResponse.json({ error: 'Failed to update Coretax config' }, { status: 500 });
  }

  // 3. Invalidate per-instance cache
  invalidateEnabledCache();

  // 4. Audit row only if value actually changed (skip no-op)
  if (oldEnabled !== newEnabled) {
    await recordAudit({
      action: 'CORETAX_TOGGLE',
      actorUserId: req.session.userId,
      actorRole: req.session.role,
      details: { key: KEY, before: oldEnabled, after: newEnabled },
      ipAddress:
        req.headers.get('x-forwarded-for') ||
        req.headers.get('x-real-ip') ||
        null,
      userAgent: req.headers.get('user-agent') || null,
    });
  }

  const dto: ConfigDTO = {
    enabled: (after?.value as { enabled?: boolean } | undefined)?.enabled === true,
    updatedAt: after?.updated_at ?? null,
    updatedBy: after?.updated_by ?? null,
  };
  return NextResponse.json({ data: dto });
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(UserRole.TAX_OPERATOR_SUPERVISOR, UserRole.TAX_OPERATOR_MASTER),
  )(request as RequestWithSession, handleGet);
}

export async function PATCH(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(UserRole.TAX_OPERATOR_MASTER),
  )(request as RequestWithSession, handlePatch);
}
```

- [ ] **Step 5.2: TS check**

```bash
npx tsc --noEmit -p . 2>&1 | head
```
Expected: 0 errors.

- [ ] **Step 5.3: Commit**

```bash
git add src/app/api/admin/coretax/config/route.ts
git commit -m "$(cat <<'EOF'
feat(coretax): GET+PATCH /api/admin/coretax/config (Track D 4/N)

GET: SUPERVISOR/MASTER read. PATCH: MASTER 만, Zod {enabled: boolean}.
SELECT before → UPDATE → invalidateEnabledCache() → recordAudit
('CORETAX_TOGGLE', diff details, no-op skip) — Track C 패턴 그대로.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: i18n + CoretaxStatusCard + page.tsx 카드 교체

**Files:**
- Modify: `src/i18n/messages/{ko,en,id,ja,zh}.json`
- Create: `src/app/[locale]/(dashboard)/operator/settings/_components/CoretaxStatusCard.tsx`
- Modify: `src/app/[locale]/(dashboard)/operator/settings/page.tsx`

- [ ] **Step 6.1: i18n (3 신규 + 1 삭제)**

For each of `ko.json`/`en.json`/`id.json`/`ja.json`/`zh.json`, in `operatorSettings.header`:

**Add 3 keys** (place next to existing `coretaxStatus`):

| key | ko | en | id | ja | zh |
|---|---|---|---|---|---|
| `coretaxValueOn` | "API 자동" | "API auto" | "API otomatis" | "API 自動" | "API 自动" |
| `coretaxValueOff` | "수동 처리" | "Manual mode" | "Mode manual" | "手動処理" | "手动处理" |
| `coretaxToggle` | "토글" | "Toggle" | "Toggle" | "切替" | "切换" |

**Remove**: `coretaxStatusValue` (정적 라벨, page 에서 사용처 사라짐).

Validate JSON:
```bash
for f in src/i18n/messages/{ko,en,id,ja,zh}.json; do
  npx tsx -e "JSON.parse(require('fs').readFileSync('$f','utf8'));" && echo "✓ $f" || echo "✗ $f"
done
```

- [ ] **Step 6.2: CoretaxStatusCard.tsx 신규**

Create `src/app/[locale]/(dashboard)/operator/settings/_components/CoretaxStatusCard.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

interface Props {
  initial: { enabled: boolean; updatedAt: string | null; updatedBy: string | null };
  canEdit: boolean;
}

export function CoretaxStatusCard({ initial, canEdit }: Props) {
  const t = useTranslations('operatorSettings.header');
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [saving, setSaving] = useState(false);

  const toggle = async () => {
    setSaving(true);
    try {
      const r = await fetch('/api/admin/coretax/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !enabled }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `${r.status}`);
      setEnabled(j.data.enabled);
      toast.success(t(j.data.enabled ? 'coretaxValueOn' : 'coretaxValueOff'));
      router.refresh();
    } catch (e) {
      toast.error(`${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const cls = enabled
    ? 'bg-emerald-50 border-emerald-200'
    : 'bg-amber-50 border-amber-200';
  const valueLabel = t(enabled ? 'coretaxValueOn' : 'coretaxValueOff');

  return (
    <div className={`rounded-2xl border px-5 py-4 shadow-sm ${cls}`}>
      <p className="text-[11px] text-slate-500">{t('coretaxStatus')}</p>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <p className="text-base font-black text-slate-900">{valueLabel}</p>
        {canEdit && (
          <button
            type="button"
            disabled={saving}
            onClick={toggle}
            className={`rounded px-2 py-1 text-[10px] font-bold border ${enabled ? 'bg-emerald-700 text-white border-emerald-800' : 'bg-amber-700 text-white border-amber-800'} disabled:opacity-50`}
            aria-pressed={enabled}
          >
            {saving ? '…' : t('coretaxToggle')}
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 6.3: page.tsx — fetch coretax config + 카드 교체**

Open `src/app/[locale]/(dashboard)/operator/settings/page.tsx`.

Add import:
```ts
import { CoretaxStatusCard } from './_components/CoretaxStatusCard';
```

In server component body, AFTER the existing audit fetch + transform (Track C), add:
```ts
  // Coretax toggle (Track D) — same admin client.
  const { data: coretaxRow } = await admin
    .from('system_setting')
    .select('value, updated_by, updated_at')
    .eq('key', 'coretax.submit_enabled')
    .single();
  const coretaxConfig = {
    enabled: (coretaxRow?.value as { enabled?: boolean } | undefined)?.enabled === true,
    updatedAt: coretaxRow?.updated_at ?? null,
    updatedBy: coretaxRow?.updated_by ?? null,
  };
```

In the §3 4-card header strip JSX, find the line:
```tsx
<Header label={t('header.coretaxStatus')} value={t('header.coretaxStatusValue')} tone="amber" />
```
Replace with:
```tsx
<CoretaxStatusCard initial={coretaxConfig} canEdit={canEdit} />
```

Other 3 Header cards (fiscalYear / platform / manageTarget) stay using the static `Header` helper.

- [ ] **Step 6.4: TS check + JSON validate**

```bash
npx tsc --noEmit -p . 2>&1 | head
for f in src/i18n/messages/{ko,en,id,ja,zh}.json; do
  npx tsx -e "JSON.parse(require('fs').readFileSync('$f','utf8'));" && echo "✓ $f" || echo "✗ $f"
done
```

- [ ] **Step 6.5: Commit (combined)**

```bash
git add src/i18n/messages/{ko,en,id,ja,zh}.json \
        "src/app/[locale]/(dashboard)/operator/settings/_components/CoretaxStatusCard.tsx" \
        "src/app/[locale]/(dashboard)/operator/settings/page.tsx"
git commit -m "$(cat <<'EOF'
feat(coretax): live toggle 카드 (Track D 5/N)

§3 4-card header strip 의 Coretax 카드 정적 i18n → DB-backed 라이브
컴포넌트로 교체. MASTER 한테는 토글 버튼 노출 (sonner toast + router
.refresh). enabled=true 면 emerald, false 면 amber.

- 신규 CoretaxStatusCard.tsx ('use client')
- page.tsx server-side coretax fetch + canEdit 전달
- i18n 3 신규 (coretaxValueOn/Off/Toggle) + 1 삭제 (coretaxStatusValue)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Smoke + runner + package.json

**Files:**
- Create: `scripts/test-coretax-toggle.ts`
- Modify: `scripts/test-smoke-all.ts`
- Modify: `package.json`

- [ ] **Step 7.1: Write the smoke script**

Create `scripts/test-coretax-toggle.ts`:

```ts
/**
 * Smoke test for Coretax Toggle (Track D):
 *   1. SUPERVISOR GET → 200 + {enabled, updatedAt, updatedBy} shape
 *   2. MASTER GET → 200
 *   3. PLATFORM_ADMIN GET → 403
 *   4. SUPERVISOR PATCH → 403
 *   5. MASTER PATCH {enabled: !current} → 200 + DB 반영 + revert
 *
 * Prereq: master/supervisor/admin 시드. Migration 20260527000003 적용.
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
  const r = await fetch(`${baseUrl}/api/admin/coretax/config`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

async function patch(token: string, body: object) {
  const r = await fetch(`${baseUrl}/api/admin/coretax/config`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

async function run() {
  console.log('🧪 Coretax toggle smoke\n');
  let pass = 0, fail = 0;

  const masterTok = await login('master.test@aipajak.com');
  const supTok = await login('supervisor.test@aipajak.com');
  const adminTok = await login('admin.test@aipajak.com');
  if (!masterTok || !supTok || !adminTok) process.exit(1);
  console.log('✅ 3 actors logged in\n');

  // 1. SUPERVISOR GET
  const r1 = await get(supTok);
  if (r1.status === 200 && typeof r1.body.data?.enabled === 'boolean' && 'updatedAt' in r1.body.data && 'updatedBy' in r1.body.data) {
    console.log(`✅ 1. SUPERVISOR GET → 200, enabled=${r1.body.data.enabled}`); pass++;
  } else {
    console.error(`✗ 1. SUPERVISOR GET unexpected:`, r1); fail++;
  }
  const initialEnabled = r1.body.data?.enabled;
  if (typeof initialEnabled !== 'boolean') {
    console.error('✗ initialEnabled not boolean — abort'); process.exit(1);
  }

  // 2. MASTER GET
  const r2 = await get(masterTok);
  if (r2.status === 200 && r2.body.data?.enabled === initialEnabled) {
    console.log(`✅ 2. MASTER GET → 200, matches supervisor view`); pass++;
  } else {
    console.error(`✗ 2. MASTER GET:`, r2); fail++;
  }

  // 3. PLATFORM_ADMIN GET → 403
  const r3 = await get(adminTok);
  if (r3.status === 403) { console.log(`✅ 3. PLATFORM_ADMIN GET → 403`); pass++; }
  else { console.error(`✗ 3. PLATFORM_ADMIN GET ${r3.status}`); fail++; }

  // 4. SUPERVISOR PATCH → 403
  const r4 = await patch(supTok, { enabled: !initialEnabled });
  if (r4.status === 403) { console.log(`✅ 4. SUPERVISOR PATCH → 403`); pass++; }
  else { console.error(`✗ 4. SUPERVISOR PATCH ${r4.status}`); fail++; }

  // 5. MASTER PATCH + revert
  const r5flip = await patch(masterTok, { enabled: !initialEnabled });
  if (r5flip.status === 200 && r5flip.body.data?.enabled === !initialEnabled) {
    // verify via re-GET
    const r5verify = await get(masterTok);
    if (r5verify.body.data?.enabled === !initialEnabled) {
      console.log(`✅ 5. MASTER PATCH applied (${initialEnabled} → ${!initialEnabled})`); pass++;
    } else {
      console.error(`✗ 5. MASTER PATCH didn't persist:`, r5verify); fail++;
    }
    // revert
    await patch(masterTok, { enabled: initialEnabled });
  } else {
    console.error(`✗ 5. MASTER PATCH:`, r5flip); fail++;
  }

  console.log(`\n— ${pass} pass / ${fail} fail —`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 7.2: package.json + runner**

Add to `package.json` scripts:
```jsonc
"test:coretax-toggle": "tsx scripts/test-coretax-toggle.ts",
```
(adjacent to `test:tax-code-rule`)

Add to `scripts/test-smoke-all.ts` STEPS array (after the tax code rule step):
```ts
  { name: 'coretax toggle (Track D)', file: 'test-coretax-toggle.ts' },
```

- [ ] **Step 7.3: Run the smoke**

```bash
# Use env-swap pattern if local Supabase missing migrations
SEED_TARGET=prod TEST_BASE_URL=http://localhost:3000 npx tsx scripts/test-coretax-toggle.ts
```
Expected: `— 5 pass / 0 fail —`. Confirm `.env.local` restored after.

또한 integrated runner:
```bash
npm run test:smoke:prod 2>&1 | tail -30
```
Expected: 14 steps (was 13), 'coretax toggle (Track D)' PASS.

- [ ] **Step 7.4: Commit**

```bash
git add scripts/test-coretax-toggle.ts scripts/test-smoke-all.ts package.json
git commit -m "$(cat <<'EOF'
test(coretax): toggle 5-assert smoke + runner wire (Track D 6/N)

GET 3 role (sup/master/admin) + PATCH 2 role (sup 403, master flip+
revert). package.json test:coretax-toggle + smoke runner step 추가
(13 → 14 steps).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: CLAUDE.md + push + Vercel prod verify

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 8.1: Update CLAUDE.md**

Find the Coretax section in CLAUDE.md (currently lists 4 env vars). Update:

1. **Coretax 섹션 헤더 / 본문**: `CORETAX_SUBMIT_ENABLED` 항목에 "**DEPRECATED — moved to `system_setting.coretax.submit_enabled` (Track D, 2026-05-27). MASTER toggles via UI at /operator/settings.**" 추가. URL/token/timeout 은 그대로.

2. **Individual scripts 리스트**: 새 라인 추가:
```
- `SEED_TARGET=prod npx tsx scripts/test-coretax-toggle.ts` — Track D Coretax 토글 GET/PATCH RBAC + DB round-trip (총 5 assertion)
```

3. **Integrated runner 설명** (만약 step count 명시면): 13 → 14.

- [ ] **Step 8.2: Commit + push**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs(CLAUDE.md): Coretax env deprecate + Track D smoke 라인 (Track D 7/N)

CORETAX_SUBMIT_ENABLED 는 system_setting.coretax.submit_enabled (Track D)
로 이전. URL/token/timeout 은 env 유지. test-coretax-toggle.ts 5 assert.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"

git push origin main
```

- [ ] **Step 8.3: Wait for Vercel deploy**

```bash
SUP_TOK=$(SEED_TARGET=prod npx tsx -e "
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production.local' });
const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
c.auth.signInWithPassword({ email: 'supervisor.test@aipajak.com', password: 'TestPassword123!' })
  .then(r => process.stdout.write(r.data.session?.access_token || ''));
")

for i in $(seq 1 30); do
  CODE=$(curl -sS -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $SUP_TOK" https://ai-pajak.vercel.app/api/admin/coretax/config)
  if [ "$CODE" = "200" ]; then
    echo "Track D live (supervisor 200) — $i × 20s"
    break
  fi
  echo "wait $i — got $CODE"
  sleep 20
done
```

- [ ] **Step 8.4: Prod smoke (coretax + 통합)**

```bash
SEED_TARGET=prod npx tsx scripts/test-coretax-toggle.ts
SEED_TARGET=prod npm run test:smoke:prod 2>&1 | tail -20
```
Expected: coretax 5/5, 통합 runner 14/14.

- [ ] **Step 8.5: Save project memory**

Create `/Users/winwaysystems/.claude/projects/-Users-winwaysystems-mywork-ai-pajak-ai-pajak/memory/project_2026_05_27_coretax_toggle_track_d.md` summarizing the batch. Add 1-line pointer to MEMORY.md after Track A entry.

Memory body (key points):
- generic `system_setting` kv table + `coretax.submit_enabled` seed
- `isEnabled()` sync → async + 60s in-memory cache + invalidate hook
- new GET/PATCH endpoint (SUPERVISOR read / MASTER write) + manual recordAudit ('CORETAX_TOGGLE')
- live CoretaxStatusCard ('use client') with sonner toast + router.refresh
- 4 callers (`operator/cases/[id]/coretax/route.ts`) + `closing-statements/submit/route.ts` 모두 `await` 전환
- 5-assert smoke + runner 13 → 14 steps
- env `CORETAX_SUBMIT_ENABLED` deprecated (URL/token/timeout 은 env 유지)
- B/C/A/D 4-track 완전체 마감

## Self-Review checklist
- CLAUDE.md updated
- `git log origin/main..HEAD` is EMPTY
- Prod smoke 5/5 (single) + 14/14 (integrated) PASS
- Memory file + MEMORY.md 1-line pointer
- No env leak

## Report Format
- **Status**
- Both smoke outputs
- Deploy wait time
- Files changed
- Commit SHAs
- Concerns

---

## Out of scope

- credentials (URL/token) DB 이전 — 보안상 의도적 제외
- Redis pub/sub 분산 cache invalidation (per-instance 60s TTL 허용)
- Coretax 통합의 실제 endpoint 호출 변경
- multi-key system_setting UI (오늘 1행, 미래 트랙)
