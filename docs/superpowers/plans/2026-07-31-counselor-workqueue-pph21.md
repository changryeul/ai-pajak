# 상담원 통합 업무함 (PPh21 골든 패턴) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** v19 목업을 픽셀 단위로 재현한 상담원 통합 업무함(`/operator/workqueue`)을 만들고, PPh21 한 세목을 실데이터(큐 + 급여명세)에 붙여 끝까지 동작시킨다.

**Architecture:** 업무 단위 = 기존 `djp_submission_queue` row (고객×세목×월). 신규 상태 테이블 0. 목업의 자체 어두운 사이드바 화면을 위해 `(dashboard)` 공용 셸을 벗어난 전용 full-bleed 라우트 그룹을 쓴다. 리스트·상태전이·요청·발행은 기존 API 재사용, 신규는 PPh21 상세 GET + quick-create POST + 이슈 판정 순수함수뿐.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Supabase(admin client + RLS), CSS Module(v19 이식), next-intl(ko/en/id), Vitest 유닛, prod smoke 스크립트(tsx), Playwright e2e.

**Design doc:** `docs/superpowers/specs/2026-07-31-counselor-workqueue-pph21-design.md`
**Visual source of truth:** `ai_pajak_counselor_workqueue_v19.html` (리포 루트)

---

## File Structure (생성/수정 파일 맵)

**신규 백엔드**
- `src/lib/operator/pph21-review-flags.ts` — 직원별 이슈 판정 순수 함수. (Task 1)
- `src/lib/operator/__tests__/pph21-review-flags.test.ts` — 유닛 테스트. (Task 1)
- `src/app/api/operator/workqueue/[queueId]/pph21/route.ts` — PPh21 상세 GET. (Task 2)
- `src/app/api/operator/queue/route.ts` — POST(quick-create) 추가. (Task 3, 기존 파일 수정)

**신규 프런트 (전용 full-bleed)**
- `src/app/[locale]/(fullscreen)/layout.tsx` — 앱 셸 없는 그룹 레이아웃. (Task 4)
- `src/lib/security/operator-access.ts` — operator 게이트 공용 헬퍼. (Task 4)
- `src/app/[locale]/(fullscreen)/operator/workqueue/page.tsx` — 서버 컴포넌트 진입점. (Task 4)
- `src/app/[locale]/(fullscreen)/operator/workqueue/workqueue.module.css` — v19 CSS 이식. (Task 5)
- `src/components/operator/workqueue/WorkqueueClient.tsx` — 최상위 클라이언트 상태/조립. (Task 6)
- `src/components/operator/workqueue/WorkqueueSidebar.tsx` — 좌측 사이드바. (Task 6)
- `src/components/operator/workqueue/CustomerWorklist.tsx` — 중앙 리스트. (Task 7)
- `src/components/operator/workqueue/Pph21ReviewPanel.tsx` — 우측 상세(요약+표). (Task 8)
- `src/components/operator/workqueue/EmployeeReviewTable.tsx` — 직원 검토 표. (Task 8)
- `src/components/operator/workqueue/CustomerMirrorToggle.tsx` — 고객 화면 미러. (Task 9)
- `src/components/operator/workqueue/RequestDrawer.tsx` — 플로팅 메신저/요청. (Task 10)
- `src/components/operator/workqueue/types.ts` — 공유 DTO 타입. (Task 6)

**수정**
- `src/i18n/messages/{ko,en,id}.json` — `operatorWorkqueue.*` 네임스페이스. (Task 11)
- `scripts/test-workqueue-pph21.ts` — 신규 smoke. (Task 12)
- `scripts/test-smoke-all.ts` — runner에 1 step 추가. (Task 12)
- `src/tests/e2e/operator-workqueue.spec.ts` — 신규 e2e. (Task 13)

---

## Task 1: 이슈 판정 순수 함수 (`pph21-review-flags.ts`)

**Files:**
- Create: `src/lib/operator/pph21-review-flags.ts`
- Test: `src/lib/operator/__tests__/pph21-review-flags.test.ts`

목적: 직원 급여명세 한 줄을 받아 목업의 "이슈" 라벨(레벨 red/amber/green)을 계산. v19 mock의 판정을 실데이터 규칙으로 옮긴다: NPWP 없음 → red, BPJS 미입력 → red, 둘 다 → "NPWP·BPJS 필요", payslip status FINALIZED → green "확인 완료", 그 외 → amber "검토 필요".

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/operator/__tests__/pph21-review-flags.test.ts
import { describe, it, expect } from 'vitest';
import { evaluatePph21EmployeeFlags, type PayslipReviewInput } from '../pph21-review-flags';

const base: PayslipReviewInput = {
  employeeNpwp: '70.505.712.3-016.000',
  bpjsKesehatan: 100000,
  bpjsKetenagakerjaan: 50000,
  payslipStatus: 'DRAFT',
};

describe('evaluatePph21EmployeeFlags', () => {
  it('flags missing NPWP as red', () => {
    const r = evaluatePph21EmployeeFlags({ ...base, employeeNpwp: null });
    expect(r.level).toBe('red');
    expect(r.issues).toContain('NPWP');
    expect(r.label).toBe('NPWP 확인 필요');
  });

  it('flags missing BPJS as red', () => {
    const r = evaluatePph21EmployeeFlags({ ...base, bpjsKesehatan: 0, bpjsKetenagakerjaan: 0 });
    expect(r.level).toBe('red');
    expect(r.issues).toContain('BPJS');
    expect(r.label).toBe('BPJS 필요');
  });

  it('combines NPWP and BPJS into one label', () => {
    const r = evaluatePph21EmployeeFlags({ ...base, employeeNpwp: '   ', bpjsKesehatan: 0, bpjsKetenagakerjaan: 0 });
    expect(r.level).toBe('red');
    expect(r.label).toBe('NPWP·BPJS 필요');
  });

  it('marks FINALIZED clean payslip as green 확인 완료', () => {
    const r = evaluatePph21EmployeeFlags({ ...base, payslipStatus: 'FINALIZED' });
    expect(r.level).toBe('green');
    expect(r.label).toBe('확인 완료');
    expect(r.issues).toEqual([]);
  });

  it('marks DRAFT clean payslip as amber 검토 필요', () => {
    const r = evaluatePph21EmployeeFlags(base);
    expect(r.level).toBe('amber');
    expect(r.label).toBe('검토 필요');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/operator/__tests__/pph21-review-flags.test.ts`
Expected: FAIL — cannot find module `../pph21-review-flags`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/operator/pph21-review-flags.ts

export interface PayslipReviewInput {
  employeeNpwp: string | null;
  bpjsKesehatan: number;
  bpjsKetenagakerjaan: number;
  payslipStatus: string; // DRAFT | FINALIZED | FILED
}

export type ReviewLevel = 'red' | 'amber' | 'green';

export interface Pph21EmployeeFlags {
  level: ReviewLevel;
  issues: string[];   // machine tokens: 'NPWP' | 'BPJS'
  label: string;      // human label for the 이슈 column
}

const isBlank = (v: string | null): boolean => !v || v.trim().length === 0;

export function evaluatePph21EmployeeFlags(input: PayslipReviewInput): Pph21EmployeeFlags {
  const issues: string[] = [];
  if (isBlank(input.employeeNpwp)) issues.push('NPWP');
  if (input.bpjsKesehatan <= 0 && input.bpjsKetenagakerjaan <= 0) issues.push('BPJS');

  if (issues.length > 0) {
    const label =
      issues.length === 2 ? 'NPWP·BPJS 필요'
      : issues[0] === 'NPWP' ? 'NPWP 확인 필요'
      : 'BPJS 필요';
    return { level: 'red', issues, label };
  }

  if (input.payslipStatus === 'FINALIZED' || input.payslipStatus === 'FILED') {
    return { level: 'green', issues: [], label: '확인 완료' };
  }
  return { level: 'amber', issues: [], label: '검토 필요' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/operator/__tests__/pph21-review-flags.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/operator/pph21-review-flags.ts src/lib/operator/__tests__/pph21-review-flags.test.ts
git commit -m "feat(operator): PPh21 employee review-flag pure function + unit tests"
```

---

## Task 2: PPh21 상세 GET 엔드포인트

**Files:**
- Create: `src/app/api/operator/workqueue/[queueId]/pph21/route.ts`

목적: 큐 건(queueId) → 그 (customer_id, period)의 `monthly_payslip ⋈ employee_payroll` + 요약 + Task 1 플래그를 반환. RBAC은 기존 operator 게이트 방식(user_roles 확인)을 따른다. 계약은 Task 12 smoke가 검증한다(리포 관행: 순수함수=유닛, API=prod smoke).

- [ ] **Step 1: Write the route**

```typescript
// src/app/api/operator/workqueue/[queueId]/pph21/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { evaluatePph21EmployeeFlags } from '@/lib/operator/pph21-review-flags';
import { getTERCategory, normalizePtkpCategory } from '@/lib/tax/pph21-calculator';

const OPERATOR_ROLES = ['TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ queueId: string }> }) {
  const { queueId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: roleRow } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).eq('is_active', true).maybeSingle();
  if (!roleRow || !OPERATOR_ROLES.includes(roleRow.role)) {
    return NextResponse.json({ error: 'Operator access required' }, { status: 403 });
  }

  const admin = getSupabaseAdmin();

  // 1) queue row → customer + period
  const { data: q } = await admin
    .from('djp_submission_queue')
    .select('id, customer_id, tax_type, tax_period_month, tax_period_year, status')
    .eq('id', queueId).maybeSingle();
  if (!q) return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });

  const period = `${q.tax_period_year}-${String(q.tax_period_month).padStart(2, '0')}`; // YYYY-MM

  // 2) payslips ⋈ employees
  const { data: payslips } = await admin
    .from('monthly_payslip')
    .select('id, employee_id, period, total_gross, thr, bonus, bpjs_kesehatan, bpjs_ketenagakerjaan, ter_rate, pph21_tax, status')
    .eq('customer_id', q.customer_id).eq('period', period);

  const employeeIds = [...new Set((payslips ?? []).map(p => p.employee_id))];
  const empMap: Record<string, { employee_name: string; employee_npwp: string | null; ptkp_category: string }> = {};
  if (employeeIds.length > 0) {
    const { data: emps } = await admin
      .from('employee_payroll')
      .select('id, employee_name, employee_npwp, ptkp_category')
      .in('id', employeeIds);
    for (const e of emps ?? []) empMap[e.id] = e;
  }

  const rows = (payslips ?? []).map(p => {
    const emp = empMap[p.employee_id];
    const ptkp = normalizePtkpCategory(emp?.ptkp_category ?? 'TK0');
    const flags = evaluatePph21EmployeeFlags({
      employeeNpwp: emp?.employee_npwp ?? null,
      bpjsKesehatan: Number(p.bpjs_kesehatan ?? 0),
      bpjsKetenagakerjaan: Number(p.bpjs_ketenagakerjaan ?? 0),
      payslipStatus: p.status ?? 'DRAFT',
    });
    return {
      payslipId: p.id,
      employeeId: p.employee_id,
      name: emp?.employee_name ?? '—',
      npwp: emp?.employee_npwp ?? null,
      ptkp,
      terCategory: getTERCategory(ptkp),
      totalGross: Number(p.total_gross ?? 0),
      bpjs: Number(p.bpjs_kesehatan ?? 0) + Number(p.bpjs_ketenagakerjaan ?? 0),
      thr: Number(p.thr ?? 0) + Number(p.bonus ?? 0),
      pph21: Number(p.pph21_tax ?? 0),
      payslipStatus: p.status ?? 'DRAFT',
      flags,
    };
  });

  const summary = {
    employeeCount: rows.length,
    totalGross: rows.reduce((s, r) => s + r.totalGross, 0),
    totalPph21: rows.reduce((s, r) => s + r.pph21, 0),
    incompleteCount: rows.filter(r => r.flags.level === 'red' || r.flags.level === 'amber').length,
  };

  return NextResponse.json({
    success: true,
    data: { queueId: q.id, customerId: q.customer_id, period, status: q.status, summary, rows },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in the new file. If `getTERCategory`/`normalizePtkpCategory` are not exported from `src/lib/tax/pph21-calculator.ts`, add `export` to those declarations (they exist per grep) and re-run.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/operator/workqueue/
git commit -m "feat(operator): GET workqueue/[queueId]/pph21 — payslip join + review flags"
```

---

## Task 3: quick-create POST (큐 row 없을 때)

**Files:**
- Modify: `src/app/api/operator/queue/route.ts` (append `POST` handler)

목적: 상담원이 (고객×세목×월) 큐 건이 없을 때 하나 생성. idempotent — UNIQUE 충돌 시 기존 row 반환. operator_id는 요청자의 tax_operators.id로 세팅(있으면).

- [ ] **Step 1: Add POST handler at end of `queue/route.ts`**

```typescript
// src/app/api/operator/queue/route.ts  (append)
export async function POST(request: NextRequest) {
  const auth = await getOperatorUser();
  if ('error' in auth && auth.error) return auth.error;
  const { user, admin } = auth;

  const body = await request.json();
  const { customerId, taxType, month, year } = body as {
    customerId?: string; taxType?: string; month?: number; year?: number;
  };
  if (!customerId || !taxType || !month || !year) {
    return NextResponse.json({ error: 'customerId, taxType, month, year are required' }, { status: 400 });
  }

  // existing?
  const { data: existing } = await admin
    .from('djp_submission_queue')
    .select('*')
    .eq('customer_id', customerId).eq('tax_type', taxType)
    .eq('tax_period_month', month).eq('tax_period_year', year)
    .maybeSingle();
  if (existing) return NextResponse.json({ success: true, data: existing, created: false });

  const { data: opProfile } = await admin
    .from('tax_operators').select('id').eq('user_id', user!.id).maybeSingle();

  const { data: created, error } = await admin
    .from('djp_submission_queue')
    .insert({
      customer_id: customerId, tax_type: taxType,
      tax_period_month: month, tax_period_year: year,
      operator_id: opProfile?.id ?? null, status: 'PENDING',
    })
    .select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, data: created, created: true });
}
```

- [ ] **Step 2: Verify `getOperatorUser` is in scope**

Run: `grep -n "async function getOperatorUser\|const getOperatorUser" src/app/api/operator/queue/route.ts`
Expected: one definition (the PUT handler uses it). If the helper returns `{ user, role, admin }`, the destructure above is valid.

- [ ] **Step 3: Type-check + commit**

```bash
npx tsc --noEmit
git add src/app/api/operator/queue/route.ts
git commit -m "feat(operator): queue quick-create POST (idempotent per customer×taxType×period)"
```

---

## Task 4: 전용 full-bleed 라우트 + operator 게이트 헬퍼

**Files:**
- Create: `src/lib/security/operator-access.ts`
- Create: `src/app/[locale]/(fullscreen)/layout.tsx`
- Create: `src/app/[locale]/(fullscreen)/operator/workqueue/page.tsx`

목적: 목업의 자체 셸을 쓰기 위해 `(dashboard)` 공용 사이드바를 벗어난 새 라우트 그룹. 그룹 레이아웃은 operator 역할+MFA 게이트만 하고 앱 크롬은 렌더하지 않는다. 게이트 로직은 기존 `operator/layout.tsx`와 공유(DRY).

- [ ] **Step 1: Extract shared gate helper**

```typescript
// src/lib/security/operator-access.ts
import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveUserRole } from '@/lib/auth/resolve-role';
import { checkOperatorMfaGate } from '@/lib/security/operator-mfa';

const ALLOWED_ROLES = ['TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];

/** Redirects on failure; returns the resolved role on success. */
export async function assertOperatorAccess(supabase: SupabaseClient, locale: string): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const role = await resolveUserRole(supabase, user.id);
  if (!role || !ALLOWED_ROLES.includes(role)) redirect(`/${locale}/dashboard`);

  const mfaGate = await checkOperatorMfaGate(supabase);
  if (mfaGate === 'enroll') redirect(`/${locale}/settings?mfa=required`);
  if (mfaGate === 'challenge') redirect(`/${locale}/login?mfa=challenge`);
  return role;
}
```

- [ ] **Step 2: Refactor existing `operator/layout.tsx` to use it**

In `src/app/[locale]/(dashboard)/operator/layout.tsx`, replace the inline role/MFA block (lines ~24-47) with:

```typescript
  const locale = await getLocale();
  const supabase = await createClient();
  await assertOperatorAccess(supabase, locale);
  return <>{children}</>;
```

and add `import { assertOperatorAccess } from '@/lib/security/operator-access';` (remove now-unused imports `resolveUserRole`, `checkOperatorMfaGate`, `ALLOWED_ROLES` const).

- [ ] **Step 3: Create the fullscreen group layout (no app chrome)**

```typescript
// src/app/[locale]/(fullscreen)/layout.tsx
import { getLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { assertOperatorAccess } from '@/lib/security/operator-access';

export const dynamic = 'force-dynamic';

export default async function FullscreenLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const supabase = await createClient();
  await assertOperatorAccess(supabase, locale);
  return <>{children}</>;
}
```

- [ ] **Step 4: Create the page (server → client)**

```typescript
// src/app/[locale]/(fullscreen)/operator/workqueue/page.tsx
import { WorkqueueClient } from '@/components/operator/workqueue/WorkqueueClient';

export const dynamic = 'force-dynamic';

export default function WorkqueuePage() {
  return <WorkqueueClient />;
}
```

- [ ] **Step 5: Add a temporary placeholder client so the route builds**

```typescript
// src/components/operator/workqueue/WorkqueueClient.tsx  (temporary; replaced in Task 6)
'use client';
export function WorkqueueClient() {
  return <div style={{ padding: 24 }}>Workqueue scaffold</div>;
}
```

- [ ] **Step 6: Build + verify no route conflict**

Run: `npm run build`
Expected: build succeeds; `/[locale]/operator/workqueue` appears in the route list. If Next.js reports a parallel-route conflict with `(dashboard)/operator`, confirm no `workqueue` folder exists under `(dashboard)/operator/` (it must not).

- [ ] **Step 7: Commit**

```bash
git add src/lib/security/operator-access.ts "src/app/[locale]/(fullscreen)" "src/app/[locale]/(dashboard)/operator/layout.tsx" src/components/operator/workqueue/WorkqueueClient.tsx
git commit -m "feat(operator): fullscreen workqueue route + shared operator access gate"
```

---

## Task 5: v19 CSS를 CSS Module로 이식

**Files:**
- Create: `src/app/[locale]/(fullscreen)/operator/workqueue/workqueue.module.css`

목적: 목업과 픽셀 일치. v19의 `<style>`(파일 `ai_pajak_counselor_workqueue_v19.html` lines 8–89)을 **그대로** 복사해 CSS Module로 만든다. 단, `:root{...}` 변수 블록과 `body{...}`/`*{box-sizing}` 전역 규칙은 CSS Module에서 클래스 스코프로 못 쓰므로 `.root` 래퍼로 감싼다.

- [ ] **Step 1: Copy v19 styles**

`ai_pajak_counselor_workqueue_v19.html` lines 8–89의 CSS 규칙 전체를 `workqueue.module.css`로 복사한다. 변환 규칙:
- line 8 `:root{--bg:...}` → `.root{--bg:...}` (동일 변수, 셀렉터만 `.root`).
- line 9 `body{margin:0;background:var(--bg);...}` → `.root{background:var(--bg);color:var(--text);font-family:...}` 로 병합, `*{box-sizing:border-box}` → `.root *{box-sizing:border-box}`.
- 나머지 클래스 규칙(`.app`, `.side`, `.cust`, `.tbl`, `.wa-bubble` 등)은 셀렉터 앞에 변경 없이 그대로 둔다(모두 `.root` 하위에서 쓰이므로 CSS Module 로컬 클래스로 동작). `@media` 블록도 그대로 복사.

- [ ] **Step 2: Verify it compiles**

Run: `npm run build` (또는 `npx next lint`로 CSS import 확인은 Task 6 이후). 이 단계에서는 파일 존재만 확인: `test -f "src/app/[locale]/(fullscreen)/operator/workqueue/workqueue.module.css" && echo OK`.

- [ ] **Step 3: Commit**

```bash
git add "src/app/[locale]/(fullscreen)/operator/workqueue/workqueue.module.css"
git commit -m "feat(operator): port v19 workqueue styles to CSS module"
```

---

## Task 6: 최상위 클라이언트 + 사이드바 + 공유 타입

**Files:**
- Create: `src/components/operator/workqueue/types.ts`
- Create: `src/components/operator/workqueue/WorkqueueSidebar.tsx`
- Modify: `src/components/operator/workqueue/WorkqueueClient.tsx` (placeholder → 실제)

목적: 3-pane 셸 조립 + 상태(선택 세목/상태필터/기간/선택 큐건) 관리. 목업 마크업(`ai_pajak_counselor_workqueue_v19.html` lines 94–137: `.app > .side` + `.top` + `.content > .grid`)을 JSX로 옮기고 `styles`(module)로 클래스를 매핑.

- [ ] **Step 1: Shared types**

```typescript
// src/components/operator/workqueue/types.ts
export type TaxView = 'pph21' | 'withholding' | 'umkm' | 'ppn' | 'annual' | 'employees' | 'billing';
export type StatusFilter = '' | 'unreviewed' | 'inReview' | 'request' | 'reviewed';

// djp_submission_queue.status → 목업 라벨
export const STATUS_LABEL_MAP: Record<string, StatusFilter> = {
  PENDING: 'unreviewed',
  DATA_REVIEW: 'inReview',
  PENDING_DOCS: 'request',
  PENDING_APPROVAL: 'reviewed',
};

export interface QueueListItem {
  id: string;
  customer_id: string;
  tax_type: string;
  tax_period_month: number;
  tax_period_year: number;
  amount: number | null;
  status: string;
  customer: { id: string; customer_name: string; npwp: string; customer_type: string } | null;
}

export interface Pph21Row {
  payslipId: string; employeeId: string; name: string; npwp: string | null;
  ptkp: string; terCategory: string; totalGross: number; bpjs: number; thr: number;
  pph21: number; payslipStatus: string;
  flags: { level: 'red' | 'amber' | 'green'; issues: string[]; label: string };
}
export interface Pph21Detail {
  queueId: string; customerId: string; period: string; status: string;
  summary: { employeeCount: number; totalGross: number; totalPph21: number; incompleteCount: number };
  rows: Pph21Row[];
}
```

- [ ] **Step 2: Sidebar component (port v19 lines 95–117)**

```tsx
// src/components/operator/workqueue/WorkqueueSidebar.tsx
'use client';
import styles from '@/app/[locale]/(fullscreen)/operator/workqueue/workqueue.module.css';
import type { TaxView, StatusFilter } from './types';

interface Props {
  counts: { all: number; unreviewed: number; inReview: number; request: number; reviewed: number };
  statusFilter: StatusFilter;
  onStatusFilter: (s: StatusFilter) => void;
  taxView: TaxView;
  onTaxView: (v: TaxView) => void;
}

export function WorkqueueSidebar({ counts, statusFilter, onStatusFilter, taxView, onTaxView }: Props) {
  const statusBtn = (key: StatusFilter, icon: string, label: string, n: number, cls: string) => (
    <button className={`${styles.nav} ${statusFilter === key ? styles.active : ''}`} onClick={() => onStatusFilter(key)}>
      <span>{icon} {label}</span><span className={`${styles.cnt} ${styles[cls]}`}>{n}</span>
    </button>
  );
  const viewBtn = (key: TaxView, label: string, stub = false) => (
    <button className={`${styles.nav} ${taxView === key ? styles.active : ''}`}
      onClick={() => !stub && onTaxView(key)} disabled={stub} title={stub ? '준비 중' : ''}>
      <span>{label}{stub ? ' · 준비 중' : ''}</span>
    </button>
  );
  return (
    <aside className={styles.side}>
      <div className={styles.brand}><div className={styles.logo}>AI</div><div>AI Pajak</div></div>
      <div className={styles.st}>상담원 업무함</div>
      {statusBtn('', '📌', '전체 고객 업무함', counts.all, 'blue')}
      {statusBtn('unreviewed', '🔴', '미검토 고객', counts.unreviewed, 'red')}
      {statusBtn('inReview', '🟡', '검토중', counts.inReview, 'amber')}
      {statusBtn('request', '💬', '수정작업중', counts.request, 'red')}
      {statusBtn('reviewed', '🟢', '검토완료', counts.reviewed, 'green')}
      <div className={styles.st}>고객 입력자료 검토</div>
      <div className={styles.sub}>
        {viewBtn('pph21', '개인소득세 (PPh 21)')}
        {viewBtn('withholding', '원천세 (PPh 4(2), 15, 22, 23, 26)', true)}
        {viewBtn('umkm', '선납법인세 (PPh Final, 25)', true)}
        {viewBtn('ppn', '부가세 (PPN)', true)}
        {viewBtn('annual', '연 신고 (SPT)', true)}
        {viewBtn('employees', '직원 인사 기록', true)}
      </div>
      <div className={styles.st}>상담원 처리업무</div>
      <div className={styles.sub}>
        <a className={styles.nav} href="../billing-issuance"><span>ID Billing 발행</span></a>
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Top-level client (port v19 lines 118–137 shell; wires queue GET)**

```tsx
// src/components/operator/workqueue/WorkqueueClient.tsx
'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from '@/app/[locale]/(fullscreen)/operator/workqueue/workqueue.module.css';
import { WorkqueueSidebar } from './WorkqueueSidebar';
import { CustomerWorklist } from './CustomerWorklist';
import { Pph21ReviewPanel } from './Pph21ReviewPanel';
import { RequestDrawer } from './RequestDrawer';
import { STATUS_LABEL_MAP, type QueueListItem, type StatusFilter, type TaxView } from './types';

const now = new Date();
const DEFAULT_PERIOD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

export function WorkqueueClient() {
  const [period, setPeriod] = useState(DEFAULT_PERIOD);
  const [taxView, setTaxView] = useState<TaxView>('pph21');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [items, setItems] = useState<QueueListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [y, m] = period.split('-');
    const r = await fetch(`/api/operator/queue?taxType=PPh21&year=${y}&month=${Number(m)}&limit=200`);
    const j = await r.json();
    if (j.success) setItems(j.data.items as QueueListItem[]);
  }, [period]);
  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const c = { all: items.length, unreviewed: 0, inReview: 0, request: 0, reviewed: 0 };
    for (const it of items) {
      const lbl = STATUS_LABEL_MAP[it.status];
      if (lbl === 'unreviewed') c.unreviewed++;
      else if (lbl === 'inReview') c.inReview++;
      else if (lbl === 'request') c.request++;
      else if (lbl === 'reviewed') c.reviewed++;
    }
    return c;
  }, [items]);

  const filtered = useMemo(
    () => statusFilter ? items.filter(it => STATUS_LABEL_MAP[it.status] === statusFilter) : items,
    [items, statusFilter],
  );

  return (
    <div className={styles.root}>
      <div className={styles.app}>
        <WorkqueueSidebar counts={counts} statusFilter={statusFilter} onStatusFilter={setStatusFilter}
          taxView={taxView} onTaxView={setTaxView} />
        <main>
          <div className={styles.top}>
            <div className={styles.role}><button className={`${styles.pill} ${styles.active}`}>상담원</button></div>
            <div className={styles.tools}>
              <input type="month" value={period} onChange={e => setPeriod(e.target.value)} />
              <input placeholder="고객명, NPWP, 담당자 검색" />
            </div>
          </div>
          <section className={styles.content}>
            <div className={styles.grid}>
              <CustomerWorklist items={filtered} selectedId={selectedId} onSelect={setSelectedId} counts={counts} />
              <div id="page">
                {selectedId
                  ? <Pph21ReviewPanel queueId={selectedId} onChanged={load} />
                  : <div className={styles.card}><div className={styles.body}>왼쪽에서 고객 업무를 선택하세요.</div></div>}
              </div>
            </div>
          </section>
        </main>
      </div>
      <RequestDrawer />
    </div>
  );
}
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: succeeds. (CustomerWorklist / Pph21ReviewPanel / RequestDrawer are created in Tasks 7–10; until then, temporarily stub them as `export function X(_: any){return null}` in their files so the build passes, or implement Tasks 7–10 before building.)

- [ ] **Step 5: Commit**

```bash
git add src/components/operator/workqueue/
git commit -m "feat(operator): workqueue shell + sidebar + queue wiring"
```

---

## Task 7: 중앙 고객 업무함 리스트

**Files:**
- Create: `src/components/operator/workqueue/CustomerWorklist.tsx`

목적: v19 lines 138–159 영역(`.qpanel > .card`)을 JSX로. 큐 아이템을 목업 `.cust` 카드로 렌더. `metrics` 4칸은 counts로 채운다.

- [ ] **Step 1: Implement**

```tsx
// src/components/operator/workqueue/CustomerWorklist.tsx
'use client';
import styles from '@/app/[locale]/(fullscreen)/operator/workqueue/workqueue.module.css';
import { STATUS_LABEL_MAP, type QueueListItem } from './types';

const LABEL_KO: Record<string, [string, string]> = {
  unreviewed: ['미검토', 'red'], inReview: ['검토중', 'amber'],
  request: ['수정작업중', 'red'], reviewed: ['검토완료', 'green'],
};

interface Props {
  items: QueueListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  counts: { unreviewed: number; request: number };
}

export function CustomerWorklist({ items, selectedId, onSelect, counts }: Props) {
  return (
    <aside className={styles.qpanel}>
      <div className={styles.card}>
        <div className={styles.head}><div><h1>고객 업무함</h1></div></div>
        <div className={styles.body}>
          <div className={styles.metrics}>
            <div className={styles.metric}><small>미검토</small><b>{counts.unreviewed}</b></div>
            <div className={styles.metric}><small>수정중</small><b>{counts.request}</b></div>
            <div className={styles.metric}><small>전체</small><b>{items.length}</b></div>
            <div className={styles.metric}><small>기간</small><b>월</b></div>
          </div>
          <div className={styles.qlist}>
            {items.length === 0 && <div className={styles.body}>해당 조건의 고객 업무가 없습니다.</div>}
            {items.map(it => {
              const lbl = STATUS_LABEL_MAP[it.status];
              const [text, cls] = LABEL_KO[lbl] ?? ['기타', 'gray'];
              return (
                <div key={it.id}
                  className={`${styles.cust} ${selectedId === it.id ? styles.active : ''}`}
                  onClick={() => onSelect(it.id)}>
                  <div className={styles.ct}>
                    <b>{it.customer?.customer_name ?? '—'}</b>
                    <span className={`${styles.badge} ${styles[cls]}`}>{text}</span>
                  </div>
                  <span>{it.customer?.npwp ?? 'NPWP 없음'} · PPh 21 · {it.tax_period_year}-{String(it.tax_period_month).padStart(2, '0')}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Build + commit**

```bash
npm run build
git add src/components/operator/workqueue/CustomerWorklist.tsx
git commit -m "feat(operator): workqueue customer worklist"
```

---

## Task 8: 우측 PPh21 상세 패널 + 직원 검토 표

**Files:**
- Create: `src/components/operator/workqueue/Pph21ReviewPanel.tsx`
- Create: `src/components/operator/workqueue/EmployeeReviewTable.tsx`

목적: 선택 큐건의 `GET /workqueue/[id]/pph21`을 불러 요약 4카드(v19 lines 처럼 `.m4`) + 직원 표(v19 lines 340–360의 `.tbl` 구조: 상태/직원/NPWP/PTKP/총지급/BPJS/THR/TER/PPH21/이슈/요청)를 렌더. "고객이 보는 그대로 보기" 토글은 Task 9.

- [ ] **Step 1: EmployeeReviewTable**

```tsx
// src/components/operator/workqueue/EmployeeReviewTable.tsx
'use client';
import styles from '@/app/[locale]/(fullscreen)/operator/workqueue/workqueue.module.css';
import type { Pph21Row } from './types';

const rp = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

export function EmployeeReviewTable({ rows, onRequest }: { rows: Pph21Row[]; onRequest: (r: Pph21Row) => void }) {
  return (
    <div className={styles.tbl}>
      <table>
        <thead><tr>
          <th>상태</th><th>직원</th><th>NPWP</th><th>PTKP</th><th className={styles.money}>총 지급</th>
          <th>BPJS</th><th>THR/보너스</th><th>TER</th><th className={styles.money}>PPH21</th><th>이슈</th><th>요청</th>
        </tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.payslipId}>
              <td><span className={`${styles.badge} ${styles[r.flags.level]}`}>{r.payslipStatus === 'FINALIZED' ? '완료' : '작성중'}</span></td>
              <td className={styles.name}><b>{r.name}</b></td>
              <td>{r.npwp ?? 'NPWP 없음'}</td>
              <td>{r.ptkp}</td>
              <td className={styles.money}>{rp(r.totalGross)}</td>
              <td>{r.bpjs > 0 ? '입력완료' : '미입력'}</td>
              <td>{r.thr > 0 ? rp(r.thr) : '없음'}</td>
              <td>Kategori {r.terCategory}</td>
              <td className={styles.money}>{rp(r.pph21)}</td>
              <td><span className={`${styles.badge} ${styles[r.flags.level]}`}>{r.flags.label}</span></td>
              <td><button className={`${styles.btn} ${styles.blue}`} onClick={() => onRequest(r)}>요청</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Pph21ReviewPanel (fetch + 요약 + 표 + 승인요청 버튼)**

```tsx
// src/components/operator/workqueue/Pph21ReviewPanel.tsx
'use client';
import { useCallback, useEffect, useState } from 'react';
import styles from '@/app/[locale]/(fullscreen)/operator/workqueue/workqueue.module.css';
import { EmployeeReviewTable } from './EmployeeReviewTable';
import { CustomerMirrorToggle } from './CustomerMirrorToggle';
import type { Pph21Detail, Pph21Row } from './types';

const rp = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

export function Pph21ReviewPanel({ queueId, onChanged }: { queueId: string; onChanged: () => void }) {
  const [detail, setDetail] = useState<Pph21Detail | null>(null);
  const [mirror, setMirror] = useState(false);
  const [requestRow, setRequestRow] = useState<Pph21Row | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/operator/workqueue/${queueId}/pph21`);
    const j = await r.json();
    if (j.success) setDetail(j.data as Pph21Detail);
  }, [queueId]);
  useEffect(() => { load(); }, [load]);

  const act = async (action: string) => {
    await fetch('/api/operator/queue', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: queueId, action }),
    });
    await load(); onChanged();
  };

  if (!detail) return <div className={styles.card}><div className={styles.body}>불러오는 중…</div></div>;
  const s = detail.summary;

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div><h1>개인소득세 (PPh 21)</h1><p>{detail.period} 귀속분 · 고객 제출자료 전체 검토</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={styles.btn} onClick={() => setMirror(m => !m)}>{mirror ? '검토 표로' : '고객이 보는 그대로 보기'}</button>
          <button className={`${styles.btn} ${styles.blue}`} onClick={() => act('review')}>검토 시작</button>
          <button className={`${styles.btn} ${styles.green}`} onClick={() => act('request-approval')}>승인 요청</button>
        </div>
      </div>
      <div className={styles.body}>
        <div className={styles.m4}>
          <div className={styles.metric2}><small>직원 수</small><b>{s.employeeCount}명</b></div>
          <div className={styles.metric2}><small>총 지급</small><b>{rp(s.totalGross)}</b></div>
          <div className={styles.metric2}><small>PPh 21 합계</small><b>{rp(s.totalPph21)}</b></div>
          <div className={styles.metric2}><small>미완료</small><b>{s.incompleteCount}건</b></div>
        </div>
        {mirror
          ? <CustomerMirrorToggle customerId={detail.customerId} />
          : <EmployeeReviewTable rows={detail.rows} onRequest={setRequestRow} />}
      </div>
      {requestRow && (
        <RequestModal row={requestRow} queueId={queueId}
          onClose={() => setRequestRow(null)} onSent={async () => { setRequestRow(null); await act('review'); }} />
      )}
    </div>
  );
}

function RequestModal({ row, queueId, onClose, onSent }:
  { row: Pph21Row; queueId: string; onClose: () => void; onSent: () => void }) {
  const [msg, setMsg] = useState(`${row.name}님의 ${row.flags.label} 관련 자료를 확인 부탁드립니다.`);
  const send = async () => {
    await fetch(`/api/operator/workqueue/${queueId}/request`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: row.employeeId, message: msg }),
    });
    onSent();
  };
  return (
    <div className={`${styles.modalbg} ${styles.open}`}>
      <div className={styles.modal}>
        <h2>고객에게 요청</h2>
        <div className={styles.mb}>
          <label>대상 직원<input readOnly value={row.name} /></label>
          <label>고객에게 보낼 메시지<textarea value={msg} onChange={e => setMsg(e.target.value)} /></label>
        </div>
        <div className={styles.mf}>
          <button className={styles.btn} onClick={onClose}>취소</button>
          <button className={`${styles.btn} ${styles.blue}`} onClick={send}>고객에게 표시</button>
        </div>
      </div>
    </div>
  );
}
```

> Note: `/api/operator/workqueue/[queueId]/request` 및 `CustomerMirrorToggle`는 Tasks 9–10에서 만든다. Task 8만 단독 빌드하려면 두 참조를 임시 스텁으로 둔다.

- [ ] **Step 3: Build + commit**

```bash
npm run build
git add src/components/operator/workqueue/Pph21ReviewPanel.tsx src/components/operator/workqueue/EmployeeReviewTable.tsx
git commit -m "feat(operator): PPh21 review panel + employee review table"
```

---

## Task 9: 고객 화면 미러 토글

**Files:**
- Create: `src/components/operator/workqueue/CustomerMirrorToggle.tsx`

목적: 개념 4의 "고객이 보는 그대로 보기". 기존 고객 컴포넌트 `MonthlyPayslipTab`(props: `customerId`, `reloadTrigger?`)을 read-only로 임베드. 자체 기간 선택기를 가지므로 customerId만 넘긴다.

- [ ] **Step 1: Implement**

```tsx
// src/components/operator/workqueue/CustomerMirrorToggle.tsx
'use client';
import { MonthlyPayslipTab } from '@/components/pph21/MonthlyPayslipTab';

export function CustomerMirrorToggle({ customerId }: { customerId: string }) {
  return (
    <div style={{ marginTop: 4 }}>
      <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
        고객이 자기 화면에서 보는 급여명세입니다 (읽기 전용 미러).
      </p>
      <MonthlyPayslipTab customerId={customerId} />
    </div>
  );
}
```

- [ ] **Step 2: Verify prop signature**

Run: `grep -n "function MonthlyPayslipTab" src/components/pph21/MonthlyPayslipTab.tsx`
Expected: `function MonthlyPayslipTab({ customerId, reloadTrigger }: Props)` — matches. If it requires additional required props, pass safe defaults.

- [ ] **Step 3: Build + commit**

```bash
npm run build
git add src/components/operator/workqueue/CustomerMirrorToggle.tsx
git commit -m "feat(operator): customer screen mirror embed in workqueue"
```

---

## Task 10: 요청 엔드포인트 + 플로팅 드로어

**Files:**
- Create: `src/app/api/operator/workqueue/[queueId]/request/route.ts`
- Create: `src/components/operator/workqueue/RequestDrawer.tsx`

목적: [요청] → 큐건을 PENDING_DOCS(수정작업중)로 전이 + 요청 메모 저장. 드로어는 목업 lines 128 영역의 플로팅 메신저(요청함) — v1은 큐건 요청현황 목록 + customer-inbox 링크 수준으로 최소 구현.

- [ ] **Step 1: request endpoint (transition to PENDING_DOCS + note)**

```typescript
// src/app/api/operator/workqueue/[queueId]/request/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const OPERATOR_ROLES = ['TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];

export async function POST(req: NextRequest, { params }: { params: Promise<{ queueId: string }> }) {
  const { queueId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: roleRow } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).eq('is_active', true).maybeSingle();
  if (!roleRow || !OPERATOR_ROLES.includes(roleRow.role)) {
    return NextResponse.json({ error: 'Operator access required' }, { status: 403 });
  }

  const { employeeId, message } = await req.json();
  if (!message || typeof message !== 'string') {
    return NextResponse.json({ error: 'message is required' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: q } = await admin
    .from('djp_submission_queue').select('id, notes, status').eq('id', queueId).maybeSingle();
  if (!q) return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });

  const stamp = new Date().toISOString();
  const noteLine = `[요청 ${stamp}]${employeeId ? ` emp=${employeeId}` : ''} ${message}`;
  const nextNotes = q.notes ? `${q.notes}\n${noteLine}` : noteLine;

  const { error } = await admin
    .from('djp_submission_queue')
    .update({ status: 'PENDING_DOCS', notes: nextNotes, updated_at: stamp })
    .eq('id', queueId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, data: { queueId, status: 'PENDING_DOCS' } });
}
```

- [ ] **Step 2: RequestDrawer (minimal floating button + panel)**

```tsx
// src/components/operator/workqueue/RequestDrawer.tsx
'use client';
import { useState } from 'react';
import styles from '@/app/[locale]/(fullscreen)/operator/workqueue/workqueue.module.css';

export function RequestDrawer() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={styles.float} onClick={() => setOpen(o => !o)}>💬 메신저 / 요청함</button>
      <div className={`${styles.drawer} ${open ? styles.open : ''}`}>
        <div className={styles.dh}><b>메신저 / 요청함</b><button className={styles.btn} onClick={() => setOpen(false)}>닫기</button></div>
        <div className={styles.db}>
          <p style={{ fontSize: 13, color: '#6b7280' }}>
            직원 행의 [요청] 버튼으로 고객에게 자료 요청을 보냅니다. 대화 이력은 고객 인박스에서 확인하세요.
          </p>
          <a className={`${styles.btn} ${styles.blue}`} href="../customer-inbox">고객 인박스 열기</a>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 3: Build + commit**

```bash
npm run build
git add src/app/api/operator/workqueue/ src/components/operator/workqueue/RequestDrawer.tsx
git commit -m "feat(operator): workqueue request endpoint + floating drawer"
```

---

## Task 11: i18n 키 (ko/en/id)

**Files:**
- Modify: `src/i18n/messages/ko.json`, `en.json`, `id.json`

목적: 하드코딩 한국어 라벨을 `operatorWorkqueue.*`로 옮긴다. (v1은 화면 카피가 목업 기준 한국어 고정이므로, 최소로 페이지 타이틀·세목 라벨·상태 라벨만 3로케일 등록하고 컴포넌트에서 `useTranslations('operatorWorkqueue')`로 치환.)

- [ ] **Step 1: Add namespace to `ko.json`**

`src/i18n/messages/ko.json`의 최상위 객체에 추가:

```json
"operatorWorkqueue": {
  "title": "고객 업무함",
  "pph21Title": "개인소득세 (PPh 21)",
  "reviewStart": "검토 시작",
  "requestApproval": "승인 요청",
  "mirrorOn": "고객이 보는 그대로 보기",
  "mirrorOff": "검토 표로",
  "statusUnreviewed": "미검토",
  "statusInReview": "검토중",
  "statusRequest": "수정작업중",
  "statusReviewed": "검토완료",
  "colEmployee": "직원", "colNpwp": "NPWP", "colPtkp": "PTKP",
  "colGross": "총 지급", "colBpjs": "BPJS", "colThr": "THR/보너스",
  "colTer": "TER", "colPph21": "PPH21", "colIssue": "이슈", "colRequest": "요청",
  "request": "요청", "empty": "해당 조건의 고객 업무가 없습니다.",
  "selectPrompt": "왼쪽에서 고객 업무를 선택하세요."
}
```

- [ ] **Step 2: Mirror into `en.json` and `id.json`**

같은 키 구조로 영어/인니어 번역을 추가한다. 예시(en): `"title": "Customer Workqueue"`, `"pph21Title": "Individual Income Tax (PPh 21)"`, `"reviewStart": "Start review"`, `"requestApproval": "Request approval"` … (id는 `scripts/i18n-auto-translate.ts`로 생성 가능: `npx tsx scripts/i18n-auto-translate.ts --namespace operatorWorkqueue`). 자동번역 미사용 시 수기 입력.

- [ ] **Step 3: Wire `useTranslations` into components**

`WorkqueueClient`/`Pph21ReviewPanel`/`EmployeeReviewTable`의 하드코딩 라벨을 `const t = useTranslations('operatorWorkqueue')` + `t('...')`로 치환. (이슈 라벨 `flags.label`은 서버 계산값이라 그대로 둔다 — 후속 세목 확장 시 서버 i18n로 이관.)

- [ ] **Step 4: Verify JSON validity + build**

Run: `node -e "['ko','en','id'].forEach(l=>require('./src/i18n/messages/'+l+'.json'))" && npm run build`
Expected: no JSON parse errors; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/messages/ src/components/operator/workqueue/
git commit -m "i18n(operator): workqueue labels ko/en/id"
```

---

## Task 12: prod smoke 스크립트 + runner 통합

**Files:**
- Create: `scripts/test-workqueue-pph21.ts`
- Modify: `scripts/test-smoke-all.ts`

목적: 리포 관행대로 API 계약을 prod smoke로 검증. sentinel 고객×PPh21×월 큐 건을 quick-create → GET pph21 shape 확인 → request POST로 PENDING_DOCS 전이 확인 → cleanup. RBAC 403(비-operator)도 확인.

- [ ] **Step 1: Write the smoke script**

기존 smoke 스크립트(예: `scripts/test-operator-queue-flow.ts`)의 부트스트랩 패턴(`.env.production.local` 로드, operator 계정 로그인해 Bearer 토큰 획득, admin 클라이언트)을 그대로 따른다. 핵심 assert:

```typescript
// scripts/test-workqueue-pph21.ts (핵심 로직 — 부트스트랩은 test-operator-queue-flow.ts 패턴 복제)
// 1) sentinel: operator.test 로 로그인 → Bearer. INDIVIDUAL customer.test 의 customer_id 조회.
// 2) POST /api/operator/queue { customerId, taxType:'PPh21', month: 99sentinel? } — 실제로는 month=12, year=2099 sentinel
//    → 200, data.id 확보 (created true|false 무관).
const cr = await api('POST', '/api/operator/queue', { customerId, taxType: 'PPh21', month: 12, year: 2099 });
assert(cr.success && cr.data?.id, 'quick-create returns queue id');
const qid = cr.data.id;

// 3) GET /api/operator/workqueue/{qid}/pph21 → shape
const detail = await api('GET', `/api/operator/workqueue/${qid}/pph21`);
assert(detail.success, 'pph21 detail success');
assert(typeof detail.data.summary.employeeCount === 'number', 'summary.employeeCount is number');
assert(Array.isArray(detail.data.rows), 'rows is array');

// 4) request POST → PENDING_DOCS
const rq = await api('POST', `/api/operator/workqueue/${qid}/request`, { message: '[WQ-E2E] NPWP 확인 요청' });
assert(rq.success && rq.data.status === 'PENDING_DOCS', 'request transitions to PENDING_DOCS');

// 5) RBAC: customer.test 토큰으로 GET → 403
const forbidden = await apiAs(customerToken, 'GET', `/api/operator/workqueue/${qid}/pph21`);
assert(forbidden.status === 403, 'non-operator gets 403');

// 6) cleanup: admin delete the sentinel queue row (year=2099)
await admin.from('djp_submission_queue').delete().eq('id', qid);
```

`api`/`apiAs`/`assert`/부트스트랩 유틸은 `test-operator-queue-flow.ts`의 동명 헬퍼를 복사·재사용한다. sentinel은 `tax_period_year=2099`로 실데이터와 절대 충돌하지 않게 한다.

- [ ] **Step 2: Run it against prod**

Run: `SEED_TARGET=prod npx tsx scripts/test-workqueue-pph21.ts`
Expected: `PASS` with all asserts. (dev server 또는 prod BASE_URL 필요 — 기존 스크립트와 동일 env.)

- [ ] **Step 3: Add to integrated runner**

`scripts/test-smoke-all.ts`의 `STEPS` 배열에 operator 계열 근처로 추가:

```typescript
  { name: 'workqueue PPh21 (quick-create + detail + request + RBAC)', file: 'test-workqueue-pph21.ts' },
```

- [ ] **Step 4: Run full runner (smoke sanity)**

Run: `SEED_TARGET=prod npm run test:smoke:prod`
Expected: 새 step 포함 전체 PASS(또는 기존 optional skip 유지). 신규 step은 non-optional.

- [ ] **Step 5: Commit**

```bash
git add scripts/test-workqueue-pph21.ts scripts/test-smoke-all.ts
git commit -m "test(operator): workqueue PPh21 prod smoke + runner integration"
```

---

## Task 13: e2e 렌더/접근 게이트

**Files:**
- Create: `src/tests/e2e/operator-workqueue.spec.ts`

목적: 페이지 렌더 + operator 접근 200 / customer 접근 리다이렉트(대시보드) 검증. 기존 operator e2e 스펙의 로그인 헬퍼 패턴을 복제.

- [ ] **Step 1: Write the spec**

```typescript
// src/tests/e2e/operator-workqueue.spec.ts
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth'; // 기존 헬퍼 경로에 맞춰 조정

test.describe('operator workqueue', () => {
  test('operator can open the workqueue and sees the sidebar', async ({ page }) => {
    await loginAs(page, 'operator.test@aipajak.com', 'TestPassword123!');
    await page.goto('/ko/operator/workqueue');
    await expect(page.getByText('상담원 업무함')).toBeVisible();
    await expect(page.getByText('개인소득세 (PPh 21)')).toBeVisible();
  });

  test('customer is redirected away from the workqueue', async ({ page }) => {
    await loginAs(page, 'customer.test@example.com', 'TestPassword123!');
    await page.goto('/ko/operator/workqueue');
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
```

기존 e2e에 `loginAs` 헬퍼가 없으면 `src/tests/e2e/`의 다른 스펙에서 쓰는 로그인 방식(폼 채우기 + 재시도 루프)을 복사한다.

- [ ] **Step 2: Run**

Run: `E2E_SKIP_GLOBAL_SETUP=1 BASE_URL=http://localhost:3000 npx playwright test operator-workqueue.spec.ts`
Expected: 2 passed. (dev 서버 실행 + operator MFA 토글 OFF 전제 — CLAUDE.md 경고 참조.)

- [ ] **Step 3: Commit**

```bash
git add src/tests/e2e/operator-workqueue.spec.ts
git commit -m "test(e2e): operator workqueue render + access gate"
```

---

## Self-Review 결과 (작성자 체크)

- **Spec 커버리지**: 3-pane 구조(T6-8) · 상태 라벨 매핑(T6 types) · PPh21 직원 상세(T2,T8) · 이슈 플래그(T1) · 미러 토글(T9) · [요청]→PENDING_DOCS(T10) · 승인요청(T8 act) · quick-create(T3) · full-bleed 셸(T4-5) · 테스트(T1,T12,T13) · i18n(T11) — 스펙 항목 모두 태스크 있음. ID Billing은 링크 위임(T6 sidebar)으로 스펙과 일치.
- **비범위 준수**: AI 게이트/자동 큐 생성(A), 5개 세목 상세, 승인 반려 메시지 정교화(C), 수퍼바이저 콘솔(D)은 태스크 없음 — 의도된 비범위.
- **타입 일관성**: `Pph21Row`/`Pph21Detail`(T6 types)가 T2 응답·T8 소비와 일치. `evaluatePph21EmployeeFlags` 시그니처(T1)가 T2 호출과 일치. `assertOperatorAccess`(T4)가 두 레이아웃에서 동일 시그니처.
- **알려진 확인 지점(구현 중 검증)**: (a) `getTERCategory`/`normalizePtkpCategory` export 여부(T2 Step2에서 처리) — 미export면 export 추가. (b) `getOperatorUser` 반환 형태(T3 Step2). (c) `MonthlyPayslipTab` 필수 props(T9 Step2). (d) e2e 로그인 헬퍼 경로(T13 Step1).

---

## 남은 서브프로젝트 (별도 plan)

A(AI 게이트+자동 큐 생성) → B 반복(원천세/PPN/선납/연신고/직원인사) → C(승인 반려 루프) → D(수퍼바이저 잔여). 각각 spec→plan→구현.
