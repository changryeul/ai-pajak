# Tax Code Rule — Access Gate Narrowing (Track A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/operator/settings` UI + 2 GET endpoints 의 접근을 MASTER + SUPERVISOR 로 narrowing. OPERATOR/LEAD/PLATFORM_ADMIN/CONSULTANT/CUSTOMER 모두 차단. Sidebar 도 일관성 있게 정정.

**Architecture:** 페이지: server component 첫 줄에서 role narrowing → silent redirect. API: `composeMiddleware` chain 에 `requireRole(SUPERVISOR, MASTER)` 추가. Sidebar: `NavItem.roles` per-item override (이미 인터페이스 지원).

**Tech Stack:** Next.js 16 (server component + redirect from next/navigation), composeMiddleware, next-intl. 마이그레이션 0개, 신규 파일 0개.

**Spec reference:** `docs/superpowers/specs/2026-05-27-tax-code-rule-access-gate-design.md`

---

## File Structure

**Modified files:**
- `src/app/[locale]/(dashboard)/operator/settings/page.tsx` — role check + redirect 직후 fetch 들 전에
- `src/app/api/admin/tax-code-rule/route.ts` — middleware chain narrow
- `src/app/api/admin/tax-code-rule/audit-log/route.ts` — middleware chain narrow
- `src/components/layout/sidebar.tsx` — settings item per-role override
- `scripts/test-tax-code-rule.ts` — assertion 2 expectation + 16/17/18 신규
- `CLAUDE.md` — 라인 갱신

신규 파일 / 마이그레이션: 0.

---

## Pre-flight

- [ ] **Step 0.1: Confirm Track C 가 main 에 반영됨**
```bash
git log --oneline origin/main -1
```
Expected: 최근 commit 이 `0069ef7` (Track C 마지막) 이거나 그 이후 + 본 task 의 spec commit (`8981100`).

- [ ] **Step 0.2: Master+Supervisor test 계정 확인**
```bash
SEED_TARGET=prod npx tsx -e "
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production.local' });
const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
Promise.all([
  c.auth.signInWithPassword({ email: 'master.test@aipajak.com', password: 'TestPassword123!' }).then(r => 'master: ' + (r.error?.message ?? 'OK')),
  c.auth.signInWithPassword({ email: 'supervisor.test@aipajak.com', password: 'TestPassword123!' }).then(r => 'supervisor: ' + (r.error?.message ?? 'OK')),
  c.auth.signInWithPassword({ email: 'operator.test@aipajak.com', password: 'TestPassword123!' }).then(r => 'operator: ' + (r.error?.message ?? 'OK')),
]).then(r => r.forEach(console.log));
"
```
Expected: 3 actor 모두 OK.

---

## Task 1: API gate narrowing — 2 GET endpoints

**Files:**
- Modify: `src/app/api/admin/tax-code-rule/route.ts`
- Modify: `src/app/api/admin/tax-code-rule/audit-log/route.ts`

- [ ] **Step 1.1: tax-code-rule/route.ts GET middleware chain narrowing**

Open `src/app/api/admin/tax-code-rule/route.ts`. Find the `export async function GET` near the bottom. Current shape:

```ts
export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
  )(request as RequestWithSession, handleGet);
}
```

Change to:

```ts
export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(UserRole.TAX_OPERATOR_SUPERVISOR, UserRole.TAX_OPERATOR_MASTER),
  )(request as RequestWithSession, handleGet);
}
```

Add imports at the top if missing (likely already present from PATCH neighbor file):
```ts
import { requireRole } from '@/middleware/rbac';
import { UserRole, type RequestWithSession } from '@/types/auth';
```

(`RequestWithSession` already imported. `UserRole` may not be — add it. `requireRole` may not be — add it.)

- [ ] **Step 1.2: audit-log/route.ts GET — same change**

Open `src/app/api/admin/tax-code-rule/audit-log/route.ts`. Apply the same middleware chain change:

```ts
export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(UserRole.TAX_OPERATOR_SUPERVISOR, UserRole.TAX_OPERATOR_MASTER),
  )(request as RequestWithSession, handleGet);
}
```

Plus the same import additions.

- [ ] **Step 1.3: TS check + brief verify**

```bash
npx tsc --noEmit -p . 2>&1 | head
```
Expected: 0 errors.

Smoke (if dev server up + env swap done):
```bash
TOKEN=$(SEED_TARGET=prod npx tsx -e "
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production.local' });
const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
c.auth.signInWithPassword({ email: 'consultant.test@jakartatax.co.id', password: 'TestPassword123!' })
  .then(r => { console.log(r.data.session?.access_token || ''); });
")
curl -sS -o /dev/null -w "consultant GET: %{http_code}\n" http://localhost:3000/api/admin/tax-code-rule \
  -H "Authorization: Bearer $TOKEN"
```
Expected: `consultant GET: 403`. (이전엔 200.)

Skip smoke if dev server unavailable — Task 5 prod smoke covers it.

- [ ] **Step 1.4: Commit**

```bash
git add src/app/api/admin/tax-code-rule/route.ts \
        src/app/api/admin/tax-code-rule/audit-log/route.ts
git commit -m "$(cat <<'EOF'
feat(tax-code-rule): GET endpoints narrow to MASTER+SUPERVISOR (Track A 1/N)

2 GET endpoint (tax-code-rule + audit-log) middleware chain 에
requireRole(SUPERVISOR, MASTER) 추가. CUSTOMER/CONSULTANT/OPERATOR/LEAD
모두 403. PATCH 가 이미 MASTER-only 인 것과 일관 (read=둘, write=master).

PDF p.26-27 의 "Admin/Tax Engine" governance scope 정렬.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Page-level gate

**Files:**
- Modify: `src/app/[locale]/(dashboard)/operator/settings/page.tsx`

- [ ] **Step 2.1: Add role narrowing**

Open `src/app/[locale]/(dashboard)/operator/settings/page.tsx`.

At the top, add 2 imports (if not already present):
```ts
import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
```

(`getTranslations` 는 이미 import 됨; `getLocale` 만 추가될 가능성. `redirect` 는 신규.)

In the server component body, **right after `const role = ...` line, BEFORE `const canEdit = ...`**, insert:

```ts
  // Track A: narrow to MASTER + SUPERVISOR (PDF "Admin/Tax Engine" governance).
  // operator/layout.tsx 가 이미 4 operator-tier role 을 허용하지만, settings
  // 페이지는 governance scope 라 OPERATOR/LEAD 를 추가 차단. silent redirect
  // 패턴은 operator/layout.tsx 와 일관.
  const SETTINGS_ROLES = ['TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];
  if (!role || !SETTINGS_ROLES.includes(role)) {
    const locale = await getLocale();
    redirect(`/${locale}/operator/dashboard`);
  }
```

`canEdit` 라인은 그대로 (`role === 'TAX_OPERATOR_MASTER'`).

- [ ] **Step 2.2: TS check**

```bash
npx tsc --noEmit -p . 2>&1 | head
```
Expected: 0 errors.

- [ ] **Step 2.3: Commit**

```bash
git add "src/app/[locale]/(dashboard)/operator/settings/page.tsx"
git commit -m "$(cat <<'EOF'
feat(tax-code-rule): page narrows to MASTER+SUPERVISOR (Track A 2/N)

operator/settings server component 의 첫 줄에서 role narrowing.
OPERATOR/LEAD 는 /{locale}/operator/dashboard 로 silent redirect.

operator/layout.tsx 의 silent-redirect 패턴과 일관. UI/API gate 동기화
(이 commit 의 짝: Track A 1/N — 2 GET endpoint 같은 범위로 좁힘).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Sidebar item per-role override

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

- [ ] **Step 3.1: Add per-item roles to settings link**

Open `src/components/layout/sidebar.tsx`. Find line ~273 (the `/operator/settings` item inside the `supervisorRoles` section). Current:

```tsx
{ href: '/operator/settings',   icon: Settings,      labelKey: 'nav.opsSettings' },
```

Change to:

```tsx
{
  href: '/operator/settings',
  icon: Settings,
  labelKey: 'nav.opsSettings',
  // Track A: narrow visibility to MASTER + SUPERVISOR (PDF "Admin/Tax Engine"
  // governance scope). LEAD 는 상위 supervisorRoles 에 포함이지만 settings
  // 페이지는 OPERATOR/LEAD 진입 시 silent redirect 라 sidebar 도 일관성 위해
  // 좁힘.
  roles: [UserRole.TAX_OPERATOR_SUPERVISOR, UserRole.TAX_OPERATOR_MASTER],
},
```

`UserRole` import 는 이미 sidebar.tsx 상단에 있음 (verify with grep). 없으면 추가.

- [ ] **Step 3.2: TS check + visual smoke (optional)**

```bash
npx tsc --noEmit -p . 2>&1 | head
```
Expected: 0 errors.

Optional visual (dev server, if up): open `/ko/operator/settings` 와 sidebar 둘 다 확인 — LEAD account 로 login 시 settings 링크 안 보임. SUPERVISOR + MASTER 만 보임.

- [ ] **Step 3.3: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "$(cat <<'EOF'
fix(sidebar): /operator/settings 링크 MASTER+SUPERVISOR 한정 (Track A 3/N)

NavItem.roles per-item override 활용해 settings 줄에만 좁은 role 적용.
LEAD 는 상위 supervisorRoles 에 포함이지만 settings 페이지 redirect
와 일관성 위해 sidebar 에서도 hide. UX: click → silent redirect 의
"왜 막혔지" 회피.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Smoke script updates

**Files:**
- Modify: `scripts/test-tax-code-rule.ts`

- [ ] **Step 4.1: Assertion 2 expectation 변경 (200 → 403)**

Open `scripts/test-tax-code-rule.ts`. Find assertion 2:

```ts
// 2. CONSULTANT GET
const r2 = await get(consTok);
if (r2.status === 200) { console.log(`✅ 2. CONSULTANT GET → 200`); pass++; }
else { console.error(`✗ 2. CONSULTANT GET ${r2.status}`); fail++; }
```

Change to:

```ts
// 2. CONSULTANT GET → 403 (Track A 의 narrow gate)
const r2 = await get(consTok);
if (r2.status === 403) { console.log(`✅ 2. CONSULTANT GET → 403`); pass++; }
else { console.error(`✗ 2. CONSULTANT GET ${r2.status} (want 403)`); fail++; }
```

- [ ] **Step 4.2: Assertion 16/17/18 추가 — 끝부분에**

Find the final `console.log` summary line. **Before it**, insert these 3 new assertions:

```ts
  // ── Track A: narrow gate (SUPERVISOR/OPERATOR contracts) ──

  // 16. SUPERVISOR GET → 200 + 7 rows
  const r16 = await get(supTok);
  if (r16.status === 200 && Array.isArray(r16.body.data) && r16.body.data.length === 7) {
    console.log(`✅ 16. SUPERVISOR GET → 200, 7 rows`); pass++;
  } else {
    console.error(`✗ 16. SUPERVISOR GET unexpected:`, r16); fail++;
  }

  // 17. SUPERVISOR GET audit-log → 200 + array
  const r17 = await getAudit(supTok);
  if (r17.status === 200 && Array.isArray(r17.body.data)) {
    console.log(`✅ 17. SUPERVISOR GET audit-log → 200, ${r17.body.data.length} rows`); pass++;
  } else {
    console.error(`✗ 17. SUPERVISOR GET audit-log:`, r17); fail++;
  }

  // 18. OPERATOR GET → 403 (Track A 추가 차단)
  const r18 = await get(opTok);
  if (r18.status === 403) { console.log(`✅ 18. OPERATOR GET → 403`); pass++; }
  else { console.error(`✗ 18. OPERATOR GET ${r18.status} (want 403)`); fail++; }
```

(가능하면 header doc-comment 의 1~12, 13~15 리스트에도 16/17/18 추가하여 의도 명시.)

- [ ] **Step 4.3: Run the updated smoke**

```bash
SEED_TARGET=prod TEST_BASE_URL=http://localhost:3000 npx tsx scripts/test-tax-code-rule.ts
```

(Use env swap pattern from Track B/C if `.env.local` points at local Supabase. Restore after.)

Expected: `— 18 pass / 0 fail —`.

If failure:
- assertion 2 fail → Task 1 또는 Task 2 의 narrowing 이 안 들어감
- assertion 16 fail → SUPERVISOR 가 read 거부됨 (middleware chain 오류 — UserRole.TAX_OPERATOR_SUPERVISOR 포함 확인)
- assertion 17 fail → audit-log endpoint 동일 원인
- assertion 18 fail → OPERATOR 가 통과됨 (middleware chain 또는 page redirect 누락)

Confirm no .env leak:
```bash
git status | grep -E "\.env" || echo "✓ no env leak"
```

- [ ] **Step 4.4: Commit**

```bash
git add scripts/test-tax-code-rule.ts
git commit -m "$(cat <<'EOF'
test(tax-code-rule): Track A access gate 회귀 (Track A 4/N)

- 기존 assertion 2: CONSULTANT GET 200 → 403 (narrow gate 반영)
- 16: SUPERVISOR GET → 200 + 7 rows
- 17: SUPERVISOR GET audit-log → 200 + array
- 18: OPERATOR GET → 403

총 15 → 18 assertion. Track B+C+A 전반 회귀 매트릭스 한 스크립트에서.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: CLAUDE.md + push + Vercel prod verify

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 5.1: Update CLAUDE.md script line**

`CLAUDE.md` 에서 tax-code-rule 라인 (Track B+C 으로 갱신되어 있음) 을 찾아:
```
- `SEED_TARGET=prod npx tsx scripts/test-tax-code-rule.ts` — Track B+C Tax Code Rule CRUD + RBAC + audit timeline (...)
```
다음으로 변경:
```
- `SEED_TARGET=prod npx tsx scripts/test-tax-code-rule.ts` — Track B+C+A Tax Code Rule CRUD + RBAC + audit timeline + access gate (GET 4 roles + PATCH 5 roles + 400/404 + audit-log GET 2 roles, 총 18)
```

원본 라인 wording 이 정확히 다르면 grep 으로 찾아 in-place 갱신. 핵심: Track 라벨 + 총 assertion 수.

- [ ] **Step 5.2: Commit CLAUDE.md**

```bash
git add CLAUDE.md
git commit -m "docs(CLAUDE.md): tax-code-rule smoke 18 assertions (Track A 5/N)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 5.3: Push**

```bash
git push origin main
```

- [ ] **Step 5.4: Wait for Vercel deploy**

```bash
for i in $(seq 1 30); do
  # CONSULTANT 가 401 이 아닌 403 을 받으면 deploy ready (Track A 가 적용된 indicator)
  CONS_TOK=$(SEED_TARGET=prod npx tsx -e "
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production.local' });
const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
c.auth.signInWithPassword({ email: 'consultant.test@jakartatax.co.id', password: 'TestPassword123!' })
  .then(r => { console.log(r.data.session?.access_token || ''); });
")
  CODE=$(curl -sS -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $CONS_TOK" https://ai-pajak.vercel.app/api/admin/tax-code-rule)
  if [ "$CODE" = "403" ]; then
    echo "Track A live (CONSULTANT 403) — $i × 20s"
    break
  fi
  echo "wait $i — got $CODE"
  sleep 20
done
```

또는 더 간단하게: deploy 시간 (Track B+C 기준 200s) 기다린 후 smoke 실행해 보면 됨.

- [ ] **Step 5.5: Prod smoke (18/18)**

```bash
SEED_TARGET=prod npx tsx scripts/test-tax-code-rule.ts
```
Expected: `— 18 pass / 0 fail —`.

- [ ] **Step 5.6: Save project memory**

Create `/Users/winwaysystems/.claude/projects/-Users-winwaysystems-mywork-ai-pajak-ai-pajak/memory/project_2026_05_27_tax_code_rule_track_a.md`:

```markdown
---
name: 2026-05-27 Track A Tax Code Rule access gate narrowing 완료
description: /operator/settings UI + 2 GET endpoint 을 MASTER+SUPERVISOR 로 좁힘. operator/layout.tsx 4-role gate 위에 settings 페이지만 narrow secondary gate. Sidebar 도 일관 정정.
type: project
---

PDF p.26-27 "Admin/Tax Engine" governance scope 정렬. 5 commit (spec 제외).

## 결정 (brainstorming)
- Q1 UI: (b) MASTER + SUPERVISOR (OPERATOR/LEAD redirect)
- Q2 API GET: (a) UI 와 동일하게 좁힘
- Q3: silent redirect → /{locale}/operator/dashboard

## Access matrix (Track A 후)
- CUSTOMER / CONSULTANT_JTC / TAX_ADVISOR_JTC: 차단 (layout) + API 403
- PLATFORM_ADMIN: 차단 (blockPlatformAdmin)
- TAX_OPERATOR / LEAD: UI redirect + API 403
- TAX_OPERATOR_SUPERVISOR: UI + GET 200
- TAX_OPERATOR_MASTER: UI + GET 200 + PATCH 200

## 변경
- `page.tsx`: role narrowing + redirect from next/navigation
- `tax-code-rule/route.ts` + `audit-log/route.ts`: requireRole(SUPERVISOR, MASTER) 추가
- `sidebar.tsx`: settings item 에 inline `roles: [SUPERVISOR, MASTER]` (NavItem.roles per-item override)
- `test-tax-code-rule.ts`: assertion 2 expectation 200 → 403, 16/17/18 신규 (총 15 → 18)
- `CLAUDE.md`: 라인 갱신

## 마이그레이션
신규 0. 신규 파일 0.

## Why
Track B+C 후 페이지가 governance 영역 (편집 MASTER, audit timeline SUPERVISOR oversight) 이 됐는데도 OPERATOR/LEAD 까지 진입 가능했음 → "들어와도 손댈 게 없는" UX. API GET 도 모든 role 허용이라 UI/API 비대칭.

## How to apply
이 배치 이후 OPERATOR/LEAD/CONSULTANT/CUSTOMER 가 /operator/settings 직접 URL 또는 API 호출 시 모두 차단. SUPERVISOR + MASTER 만 접근. Track D 는 별도.

## 남은 작업 (Track D)
Coretax API 토글을 env-var → DB-driven 으로.
```

MEMORY.md 에 한 줄 추가 (Track C 항목 직후):
```
- [2026-05-27 Track A Tax Code Rule access gate 완료](project_2026_05_27_tax_code_rule_track_a.md) — UI + 2 GET endpoint MASTER+SUPERVISOR 로 narrow. sidebar 도 일관 정정. smoke 15→18.
```

### Self-Review checklist
- CLAUDE.md updated (Track B+C → B+C+A, 15 → 18)
- `git log origin/main..HEAD` is EMPTY (all pushed)
- Prod smoke 18/18 PASS
- Memory file written + MEMORY.md pointer added
- No env files leaked

## Report Format
- **Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Prod smoke output (full)
- Deploy wait time
- Files changed (CLAUDE.md + memory)
- Commit SHAs
- `git log origin/main..HEAD` empty confirmation
- Concerns

---

## Out of scope (Track D)

- Coretax API 토글 (env → DB-driven)
- 변경 announcements/changelog 메뉴
- finer per-section 게이트 (e.g., supervisor 한테는 audit timeline 만)
