# 자동 큐 생성 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 고객이 자료(급여명세·원천세·PPN·월납부)를 저장/제출하면 해당 `(customer×세목×월)` djp_submission_queue 행을 자동 생성해 담당 상담원 업무함에 노출.

**Architecture:** best-effort idempotent 공유 헬퍼 `ensureQueueForActivity` + 4세목 write 엔드포인트 훅. operator_id = 고객 담당 operator(operator_client_assignments). 신규 테이블 0, 큐 상태기계 변경 0.

**Design doc:** `docs/superpowers/specs/2026-07-31-auto-queue-creation-design.md`

---

## File Structure

- Create: `src/lib/operator/ensure-queue-item.ts` (헬퍼) + `__tests__/ensure-queue-item.test.ts` (parsePeriod 유닛).
- Modify: `src/app/api/tax/monthly-payslip/route.ts` (PPh21 훅).
- Modify: `src/app/api/tax/pph23-transactions/route.ts` (PPh23 단건 훅).
- Modify: `src/app/api/tax/pph23-transactions/import/route.ts` (PPh23 일괄 훅).
- Modify: `src/app/api/tax/ppn-faktur-monthly/route.ts` (PPN 단건 훅).
- Modify: `src/app/api/tax/ppn-bulk-import/route.ts` (PPN 일괄 훅).
- Modify: `src/app/api/tax/monthly-payments/route.ts` (UMKM update-payment 훅).
- Create: `scripts/test-auto-queue-creation.ts` (prod smoke) + runner 1 step.

---

## Task 1: 공유 헬퍼 + 유닛

**Files:**
- Create: `src/lib/operator/ensure-queue-item.ts`
- Test: `src/lib/operator/__tests__/ensure-queue-item.test.ts`

- [ ] **Step 1: Write the failing test (parsePeriod pure)**

```typescript
// src/lib/operator/__tests__/ensure-queue-item.test.ts
import { describe, it, expect } from 'vitest';
import { parsePeriod, isAutoQueueTaxType } from '../ensure-queue-item';

describe('parsePeriod', () => {
  it('parses a valid YYYY-MM', () => {
    expect(parsePeriod('2026-06')).toEqual({ month: 6, year: 2026 });
  });
  it('parses December boundary', () => {
    expect(parsePeriod('2099-12')).toEqual({ month: 12, year: 2099 });
  });
  it('rejects malformed input', () => {
    expect(parsePeriod('2026')).toBeNull();
    expect(parsePeriod('2026-13')).toBeNull();
    expect(parsePeriod('2026-00')).toBeNull();
    expect(parsePeriod('')).toBeNull();
    expect(parsePeriod('abcd-ef')).toBeNull();
  });
});

describe('isAutoQueueTaxType', () => {
  it('accepts the 4 supported types', () => {
    for (const t of ['PPh21', 'PPh23', 'PPN', 'PPh_FINAL']) expect(isAutoQueueTaxType(t)).toBe(true);
  });
  it('rejects others', () => {
    expect(isAutoQueueTaxType('PPh26')).toBe(false);
    expect(isAutoQueueTaxType('SPT_TAHUNAN')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/operator/__tests__/ensure-queue-item.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write the helper** (parsePeriod uses `String.match`, not regex-exec)

```typescript
// src/lib/operator/ensure-queue-item.ts
import type { SupabaseClient } from '@supabase/supabase-js';

const AUTO_QUEUE_TAX_TYPES = new Set(['PPh21', 'PPh23', 'PPN', 'PPh_FINAL']);

export function isAutoQueueTaxType(taxType: string): boolean {
  return AUTO_QUEUE_TAX_TYPES.has(taxType);
}

/** 'YYYY-MM' → { month, year } | null (month 1-12 검증). */
export function parsePeriod(period: string): { month: number; year: number } | null {
  const m = (period ?? '').match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return { month, year };
}

/**
 * best-effort: (customer×taxType×월) djp_submission_queue 행이 없으면 생성.
 * 담당 operator(operator_client_assignments active)를 operator_id 로 세팅.
 * 어떤 예외도 던지지 않는다 — 호출측 write 를 절대 실패시키지 않는다.
 */
export async function ensureQueueForActivity(
  admin: SupabaseClient,
  customerId: string,
  taxType: string,
  period: string,
): Promise<{ created: boolean; reason?: string }> {
  try {
    if (!customerId || !isAutoQueueTaxType(taxType)) return { created: false, reason: 'unsupported' };
    const parsed = parsePeriod(period);
    if (!parsed) return { created: false, reason: 'bad-period' };
    const { month, year } = parsed;

    const { data: existing } = await admin
      .from('djp_submission_queue')
      .select('id')
      .eq('customer_id', customerId).eq('tax_type', taxType)
      .eq('tax_period_month', month).eq('tax_period_year', year)
      .maybeSingle();
    if (existing) return { created: false, reason: 'exists' };

    const { data: assign } = await admin
      .from('operator_client_assignments')
      .select('operator_id')
      .eq('customer_id', customerId).eq('is_active', true)
      .order('assigned_date', { ascending: false })
      .limit(1).maybeSingle();

    const { error } = await admin
      .from('djp_submission_queue')
      .insert({
        customer_id: customerId, tax_type: taxType,
        tax_period_month: month, tax_period_year: year,
        operator_id: assign?.operator_id ?? null, status: 'PENDING',
      });
    if (error) {
      // 23505 = UNIQUE race, treat as already-exists (idempotent).
      return { created: false, reason: error.code === '23505' ? 'exists' : error.message };
    }
    return { created: true };
  } catch (e) {
    return { created: false, reason: e instanceof Error ? e.message : 'exception' };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/operator/__tests__/ensure-queue-item.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/operator/ensure-queue-item.ts src/lib/operator/__tests__/ensure-queue-item.test.ts
git commit -m "feat(operator): ensureQueueForActivity helper (auto-queue) + parsePeriod unit tests"
```

---

## Task 2: PPh21 + PPh23 훅

**Files:**
- Modify: `src/app/api/tax/monthly-payslip/route.ts`
- Modify: `src/app/api/tax/pph23-transactions/route.ts`
- Modify: `src/app/api/tax/pph23-transactions/import/route.ts`

공통 import (각 파일 상단, 없으면 추가):
```typescript
import { ensureQueueForActivity } from '@/lib/operator/ensure-queue-item';
```
`getSupabaseAdmin` 이 미 import 안 돼 있으면 추가.

- [ ] **Step 1: PPh21 — payslip submit 훅**

`monthly-payslip/route.ts` `handlePost` (action='submit'): 성공 로그 `'Payslips submitted'` 직후, 성공 `return NextResponse.json(...)` 바로 앞에:
```typescript
    await ensureQueueForActivity(getSupabaseAdmin(), customerId, 'PPh21', period);
```

- [ ] **Step 2: PPh23 단건 — POST insert 성공 후 훅**

`pph23-transactions/route.ts` POST 의 insert 성공(`if (error) return …` 이후) 최종 성공 return 전. 스코프 변수 `customerId`, `taxPeriod`:
```typescript
    await ensureQueueForActivity(getSupabaseAdmin(), customerId, 'PPh23', taxPeriod);
```

- [ ] **Step 3: PPh23 일괄 — import 성공 후 훅**

`pph23-transactions/import/route.ts` 성공 `return NextResponse.json({ success: true, ... })` 직전. 스코프 `customerId`, `taxPeriod`:
```typescript
    await ensureQueueForActivity(getSupabaseAdmin(), customerId, 'PPh23', taxPeriod);
```

- [ ] **Step 4: Type-check + build**

Run: `npx tsc --noEmit` 후 `npm run build`
Expected: no errors. 변수명(`customerId`/`taxPeriod`/`period`)이 실제와 다르면 교정.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/tax/monthly-payslip/route.ts src/app/api/tax/pph23-transactions/route.ts src/app/api/tax/pph23-transactions/import/route.ts
git commit -m "feat(operator): auto-create workqueue item on PPh21/PPh23 customer writes"
```

---

## Task 3: PPN + UMKM 훅

**Files:**
- Modify: `src/app/api/tax/ppn-faktur-monthly/route.ts`
- Modify: `src/app/api/tax/ppn-bulk-import/route.ts`
- Modify: `src/app/api/tax/monthly-payments/route.ts`

- [ ] **Step 1: PPN 단건 — POST insert 성공 후 훅**

`ppn-faktur-monthly/route.ts` POST insert 성공 후 (스코프 `customerId`, `taxPeriod`). import 추가:
```typescript
    await ensureQueueForActivity(getSupabaseAdmin(), customerId, 'PPN', taxPeriod);
```

- [ ] **Step 2: PPN 일괄 — bulk-import 성공 후 훅**

`ppn-bulk-import/route.ts` 성공 return 직전 (스코프 `customerId`, `taxPeriod`). import 추가:
```typescript
    await ensureQueueForActivity(getSupabaseAdmin(), customerId, 'PPN', taxPeriod);
```

- [ ] **Step 3: UMKM — update-payment 후 조건부 훅**

`monthly-payments/route.ts` `case 'update-payment'` 의 update 성공 직후 삽입. import 추가:
```typescript
        // 선납법인세 납부 기록 시 워크큐 자동 노출 (best-effort).
        const { data: paidRow } = await getSupabaseAdmin()
          .from('tax_monthly_payment')
          .select('customer_id, tax_type, tax_period')
          .eq('id', paymentId).maybeSingle();
        if (paidRow && (paidRow.tax_type === 'PPh_FINAL' || paidRow.tax_type === 'PPh25')) {
          await ensureQueueForActivity(getSupabaseAdmin(), paidRow.customer_id, 'PPh_FINAL', paidRow.tax_period);
        }
```

- [ ] **Step 4: Type-check + build**

Run: `npx tsc --noEmit` 후 `npm run build`
Expected: no errors. 변수명 불일치 시 교정.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/tax/ppn-faktur-monthly/route.ts src/app/api/tax/ppn-bulk-import/route.ts src/app/api/tax/monthly-payments/route.ts
git commit -m "feat(operator): auto-create workqueue item on PPN/UMKM customer writes"
```

---

## Task 4: prod smoke + runner

**Files:**
- Create: `scripts/test-auto-queue-creation.ts`
- Modify: `scripts/test-smoke-all.ts`

목적: 고객 write → 큐 자동 생성 end-to-end. customer.test 토큰으로 sentinel PPh23 거래 POST → djp_submission_queue 행 자동 생성 확인 → cleanup.

- [ ] **Step 1: Write the smoke script**

부트스트랩은 `test-workqueue-pph21.ts` 패턴 복제. 핵심 로직:

```typescript
// scripts/test-auto-queue-creation.ts (핵심 — 부트스트랩/헬퍼는 기존 smoke 복제)
const PERIOD = '2099-12';
const SENTINEL_MONTH = 12, SENTINEL_YEAR = 2099;

// pre-clean sentinel queue + sentinel pph23 txn (description like '[AUTOQ-E2E]%')
await admin.from('djp_submission_queue').delete()
  .eq('customer_id', customer.id).eq('tax_type', 'PPh23')
  .eq('tax_period_month', SENTINEL_MONTH).eq('tax_period_year', SENTINEL_YEAR);
await admin.from('pph23_transaction').delete()
  .eq('customer_id', customer.id).eq('tax_period', PERIOD).like('description', '[AUTOQ-E2E]%');

// 1. customer.test 토큰으로 PPh23 거래 POST
const token = await login('customer.test@example.com');
const res = await fetch(`${baseUrl}/api/tax/pph23-transactions`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({
    customerId: customer.id, taxPeriod: PERIOD, transactionDate: `${PERIOD}-15`,
    description: '[AUTOQ-E2E] auto queue test', invoiceNumber: 'AUTOQ-001',
    grossAmount: 1_000_000, counterpartyName: 'PT Auto Queue', counterpartyNpwp: '01.234.567.8-901.000',
    serviceType: 'JASA_TEKNIK',
  }),
});
assert(res.ok, 'pph23 transaction created');
await new Promise(r => setTimeout(r, 1500)); // best-effort hook 완료 대기

// 2. 큐 행 자동 생성 확인
const { data: q } = await admin.from('djp_submission_queue')
  .select('id, status')
  .eq('customer_id', customer.id).eq('tax_type', 'PPh23')
  .eq('tax_period_month', SENTINEL_MONTH).eq('tax_period_year', SENTINEL_YEAR).maybeSingle();
assert(!!q, 'djp_submission_queue row exists after write');
assert(q?.status === 'PENDING', 'auto-created row is PENDING');

// cleanup: 큐 행 + sentinel 거래 삭제
```

`login`/`assert`/부트스트랩은 `test-workqueue-pph21.ts` 동명 유틸 복제.

- [ ] **Step 2: Run against local dev server (prod Supabase)**

`npm run dev` → health 200.
Run: `SEED_TARGET=prod TEST_BASE_URL=http://localhost:3000 npx tsx scripts/test-auto-queue-creation.ts`
Expected: `✅ PASS`. (POST body 필드가 실제 pph23 POST 스키마와 다르면 맞춘다.)

- [ ] **Step 3: Add to runner**

`scripts/test-smoke-all.ts` 의 workqueue UMKM step 아래:
```typescript
  { name: 'auto-queue creation (customer write → queue row)', file: 'test-auto-queue-creation.ts' },
```

- [ ] **Step 4: Commit**

```bash
git add scripts/test-auto-queue-creation.ts scripts/test-smoke-all.ts
git commit -m "test(operator): auto-queue creation prod smoke + runner integration"
```

---

## Self-Review

- **Spec 커버리지**: 헬퍼(T1) · 4세목 훅 6곳(T2 PPh21+PPh23단건+일괄, T3 PPN단건+일괄+UMKM) · smoke(T4). 스펙 항목 모두 태스크 있음.
- **best-effort**: 헬퍼 내부 try/catch + 23505 idempotent. 호출측은 await 하되 실패 무시(헬퍼가 예외 안 던짐).
- **타입 일관성**: `ensureQueueForActivity(admin, customerId, taxType, period)` 시그니처가 6 훅 호출과 일치. `parsePeriod`/`isAutoQueueTaxType` 유닛과 일치.
- **확인 지점(구현 중)**: 각 write 핸들러의 `customerId`/`taxPeriod`/`period` 실제 변수명(T2/T3 Step4 build 교정). pph23 POST 필수 필드(T4 smoke body).
