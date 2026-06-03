# Annual Closing Wizard — Credit Step Auto-fill

- **Date**: 2026-06-03
- **Status**: Approved (Q1+Q2+Q3 = a+a+b)
- **Builds on**: annual-aggregator (이미 PPh21/22/23/25/26/PPN 모두 cover), PPh26 wholesale importer (오늘 commit `3ec111d`)

## 1. Context

PPh25 closing wizard 의 "credit" step (`/tax/annual/pph25/[id]/credit`) 에서 사용자가 PPh22/23/25/26 세액공제 (tax credit) 를 수동 입력. 그러나:
- `annual-aggregator.ts` 가 이미 모든 source (`tax_calculation`, `pph23_transaction`, `pph26_transaction`, `tax_monthly_payment`) 를 aggregate 가능
- 사용자가 동일 데이터를 다시 손으로 적는 painful 흐름
- 입력 오류 위험 + 일관성 X

## 2. Decisions

| # | 결정 | 선택 |
|---|---|---|
| Q1 | Trigger | **(a)** credit step 진입 시 자동 GET — 수동 fetch 버튼 X |
| Q2 | 충돌 처리 | **(a)** 사용자 입력 우선 — auto-detected 는 비어 있을 때만 prefill, badge 로 source 표시 |
| Q3 | PPh22 폴백 | **(b)** `tax_calculation` 폴백 — annual-aggregator 가 이미 그렇게 함 |

## 3. Code 변경

### 3.1 신규 endpoint `GET /api/tax/annual-closing/[id]/auto-credits`

```ts
// src/app/api/tax/annual-closing/[id]/auto-credits/route.ts
async function handleGet(req: RequestWithSession, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = getSupabaseAdmin();

  // closing_session 에서 customer + year 확인
  const { data: session } = await admin
    .from('annual_closing_session')
    .select('customer_id, fiscal_year, regime')
    .eq('id', id)
    .single();

  if (!session) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

  // annual-aggregator 호출 — 이미 모든 source 알고 있음
  const aggregated = await aggregateAnnualTaxData({
    customerId: session.customer_id,
    fiscalYear: session.fiscal_year,
  });

  return NextResponse.json({
    success: true,
    data: {
      pph22: aggregated.pph22_credit ?? 0,
      pph23: aggregated.pph23_credit ?? 0,
      pph25: aggregated.pph25_paid ?? 0,
      pph26: aggregated.pph26_credit ?? 0,
      sources: {
        pph22: { table: 'tax_calculation', rowCount: aggregated.pph22_count ?? 0 },
        pph23: { table: 'pph23_transaction', rowCount: aggregated.pph23_count ?? 0 },
        pph25: { table: 'tax_monthly_payment', rowCount: aggregated.pph25_count ?? 0 },
        pph26: { table: 'pph26_transaction', rowCount: aggregated.pph26_count ?? 0 },
      },
      computedAt: new Date().toISOString(),
    },
  });
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(UserRole.CUSTOMER, UserRole.CONSULTANT_JTC, UserRole.TAX_ADVISOR_JTC,
                UserRole.TAX_OPERATOR, UserRole.TAX_OPERATOR_SUPERVISOR, UserRole.TAX_OPERATOR_MASTER),
    withAudit('ANNUAL_CLOSING_AUTO_CREDITS_READ')
  )(request as RequestWithSession, (r) => handleGet(r, ctx));
}
```

audit enum 신규: `ANNUAL_CLOSING_AUTO_CREDITS_READ`

### 3.2 annual-aggregator 확장 (필요 시)

`src/lib/tax/annual-aggregator.ts` 가 이미 `aggregateAnnualTaxData()` 같은 함수를 export 하는지 확인. 없으면 wrapper 함수 추가. 핵심: PPh22/23/25/26 별 합계 + row count.

만약 함수 signature 가 다르면 → 신규 wrapper `aggregateClosingCredits()` 추가, 기존 함수 변경 X (backward compat).

### 3.3 Credit step UI (`src/app/[locale]/(dashboard)/tax/annual/pph25/[id]/credit/page.tsx`)

기존 입력 form 에 auto-prefill 흐름 추가:

```tsx
'use client';
import { useEffect, useState } from 'react';

interface AutoCredits {
  pph22: number;
  pph23: number;
  pph25: number;
  pph26: number;
  sources: Record<string, { table: string; rowCount: number }>;
  computedAt: string;
}

export default function CreditStep({ params }: { params: { id: string } }) {
  const [pph22, setPph22] = useState<string>('');
  const [pph23, setPph23] = useState<string>('');
  const [pph25, setPph25] = useState<string>('');
  const [pph26, setPph26] = useState<string>('');
  const [autoCredits, setAutoCredits] = useState<AutoCredits | null>(null);
  const [loading, setLoading] = useState(true);

  // Step 진입 시 자동 GET
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/tax/annual-closing/${params.id}/auto-credits`, { signal: ac.signal });
        if (!res.ok) return;
        const json = await res.json();
        if (!json.success) return;
        const a: AutoCredits = json.data;
        setAutoCredits(a);

        // 사용자 입력 우선 — 비어 있을 때만 prefill
        if (!pph22 && a.pph22 > 0) setPph22(String(a.pph22));
        if (!pph23 && a.pph23 > 0) setPph23(String(a.pph23));
        if (!pph25 && a.pph25 > 0) setPph25(String(a.pph25));
        if (!pph26 && a.pph26 > 0) setPph26(String(a.pph26));
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [params.id]);

  return (
    <div>
      <h2>세액공제 입력</h2>
      {autoCredits && (
        <div className="bg-emerald-50 border border-emerald-200 rounded p-3 text-sm mb-4">
          ✨ <strong>자동 감지됨</strong> ({new Date(autoCredits.computedAt).toLocaleString('ko-KR')})
          <ul className="mt-2 text-xs space-y-0.5">
            <li>PPh22: {autoCredits.sources.pph22.rowCount} rows from {autoCredits.sources.pph22.table}</li>
            <li>PPh23: {autoCredits.sources.pph23.rowCount} rows from {autoCredits.sources.pph23.table}</li>
            <li>PPh25: {autoCredits.sources.pph25.rowCount} rows from {autoCredits.sources.pph25.table}</li>
            <li>PPh26: {autoCredits.sources.pph26.rowCount} rows from {autoCredits.sources.pph26.table}</li>
          </ul>
          <p className="mt-2 text-[11px] text-emerald-700">
            아래 값은 자동으로 채워졌습니다. 필요 시 수동으로 수정 가능합니다.
          </p>
        </div>
      )}

      {/* PPh22 */}
      <label>PPh22 (수입 시 원천징수)
        <input type="number" value={pph22} onChange={e => setPph22(e.target.value)} />
        {autoCredits && autoCredits.pph22 > 0 && Number(pph22) === autoCredits.pph22 && (
          <span className="badge bg-emerald-100 text-emerald-700 text-[10px] ml-2">자동 감지</span>
        )}
      </label>
      {/* PPh23 / PPh25 / PPh26 동일 패턴 */}
      ...
    </div>
  );
}
```

핵심 패턴:
- Step 진입 시 자동 GET
- 비어 있을 때만 prefill (사용자 입력 우선)
- "자동 감지" badge 가 값이 source 와 일치할 때만 표시 (사용자가 수정하면 사라짐)
- 자동 감지된 source breakdown 패널 (사용자가 어디서 왔는지 알 수 있게)

### 3.4 i18n 키 5개 × 5 locale

```
- closingAutoDetected: "자동 감지됨"
- closingAutoDetectedHint: "아래 값은 자동으로 채워졌습니다. 필요 시 수동으로 수정 가능합니다."
- closingAutoDetectedBadge: "자동 감지"
- closingAutoFromTable: "{rowCount} rows from {table}"
- closingAutoComputedAt: "계산 시각"
```

## 4. Files

**신규** (2):
- `src/app/api/tax/annual-closing/[id]/auto-credits/route.ts`
- `scripts/verify-closing-auto-credits.ts`

**수정** (4):
- `src/lib/tax/annual-aggregator.ts` — `aggregateClosingCredits()` wrapper (only if 기존 signature 다름)
- `src/app/[locale]/(dashboard)/tax/annual/pph25/[id]/credit/page.tsx` — auto-prefill 흐름
- `src/i18n/messages/{ko,en,id,ja,zh}.json` — 5 키
- `scripts/test-smoke-all.ts` — STEPS +1
- `supabase/migrations/202606030000XX_audit_enum_auto_credits.sql` — 신규 audit enum

**마이그레이션** (1): audit enum 추가만

## 5. Smoke (`scripts/verify-closing-auto-credits.ts`)

5 assertion:
1. Login + 활성 closing_session 찾거나 생성 (회사 customer + 작년)
2. Seed: `pph23_transaction` 2 row + `pph26_transaction` 1 row + `tax_monthly_payment` 3 row (sentinel year)
3. GET `/api/tax/annual-closing/[id]/auto-credits` → 200 + pph23/pph25/pph26 합계 일치
4. response.sources 가 각 table 의 rowCount 정확
5. Cleanup

runner +1 step (25→26).

## 6. Out of scope (Phase 별도)

- **자동 prefill 후 사용자 수정 시 audit log** — 현재는 server 만 audit. UI 수정은 별도 트랙
- **UMKM closing 의 credit step 통합** — UMKM 은 PPh Final 0.5% 만 — credit 개념 없음. 안 함
- **Override 후 server 가 aggregator 와 차이 알림** — 사용자 자유롭게 입력. 차이 검출은 v2
- **PPh4(2) 통합** — DB 테이블 없음. 별도 트랙
- **PPN credit 처리** — closing PPN step 은 별도 (옵션 c). 이 spec 은 PPh 만

## 7. Risks

- **annual-aggregator signature 불일치**: 기존 함수 export 가 closing wrapper 가 기대하는 shape 와 다를 수 있음. subagent 가 확인 후 wrapper 추가.
- **closing_session 의 fiscal_year 컬럼 이름**: `fiscal_year` vs `year` vs `period_year` — DB schema 확인 필요. subagent 가 schema 확인.
- **annual_closing_session 의 customer_id 컬럼**: 확인 필요.
- **사용자가 수정 후 새 GET 시 덮어쓰기 위험**: useEffect 의 의존성 array 가 `params.id` 만 — 페이지 새 진입 시 한 번만. 안전.
- **session.regime 이 UMKM 일 때**: GET 응답에서 credits 0 또는 별도 처리 (UMKM 은 credit 개념 없음). subagent 가 early return.
- **권한**: `composeMiddleware` 에 CUSTOMER + CONSULTANT_JTC + TAX_ADVISOR_JTC + 3 OPERATOR role 포함. PLATFORM_ADMIN 블록 (기존 패턴).
- **prod schema drift audit**: 신규 audit enum 만 — drift CI guard 가 detect. PASS expected.
