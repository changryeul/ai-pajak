# Annual Closing — PPh23 Invoice Photo Traceability

- **Date**: 2026-06-03
- **Status**: Approved (defaults a+a+b)
- **Builds on**: PPh23 Phase 5 (`0d2abe3`, invoice_document_id FK) + closing credit auto-fill (`19893c2`)

## 1. Context

PPh23 Phase 5 에서 wholesale rows 의 invoice photo attach 가능 (선택). 그러나:
- closing wizard 안에서 PPh23 invoice 사진 상태 노출 0
- closing submit 후 inspector 가 "이 PPh23 거래의 evidence 어디?" 물으면 사용자가 또 검색
- counterparty 별로 사진 없는 거래가 몇 개인지 인지 0

## 2. Decisions

| # | 결정 | 선택 |
|---|---|---|
| Q1 | 위치 | **(a)** closing wizard "collect" step 에 신규 panel — 자료 수집 단계 가 자연스러움 |
| Q2 | 정책 | **(a)** warning only — closing 진행 허용. 사용자가 부담 인지하는 데 목적 |
| Q3 | excel export | **(b)** v1 skip — UI 만. export 는 별도 트랙 |

## 3. Code 변경

### 3.1 신규 endpoint `GET /api/tax/annual-closing/[id]/pph23-photo-status`

```ts
// src/app/api/tax/annual-closing/[id]/pph23-photo-status/route.ts
async function handleGet(req: RequestWithSession, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = getSupabaseAdmin();

  // tax_closing_session 에서 customer + fiscal_year
  const { data: session } = await admin
    .from('tax_closing_session')
    .select('customer_id, fiscal_year')
    .eq('id', id)
    .single();

  if (!session) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

  // fiscal_year 의 tax_period 범위 (YYYY-MM)
  const periodStart = `${session.fiscal_year}-01`;
  const periodEnd = `${session.fiscal_year}-12`;

  // PPh23 transactions in fiscal year
  const { data: txs } = await admin
    .from('pph23_transaction')
    .select('id, counterparty_name, counterparty_npwp, gross_amount, tax_amount, invoice_document_id, tax_period')
    .eq('customer_id', session.customer_id)
    .gte('tax_period', periodStart)
    .lte('tax_period', periodEnd);

  const rows = txs ?? [];
  const totalCount = rows.length;
  const attachedCount = rows.filter(r => r.invoice_document_id != null).length;
  const missingCount = totalCount - attachedCount;

  // Counterparty 별 groupBy
  const byCounterparty = new Map<string, { name: string; npwp: string | null; total: number; attached: number; missingAmount: number }>();
  for (const r of rows) {
    const key = r.counterparty_npwp ?? r.counterparty_name ?? 'UNKNOWN';
    let g = byCounterparty.get(key);
    if (!g) g = { name: r.counterparty_name ?? key, npwp: r.counterparty_npwp, total: 0, attached: 0, missingAmount: 0 };
    g.total++;
    if (r.invoice_document_id) g.attached++;
    else g.missingAmount += Number(r.gross_amount ?? 0);
    byCounterparty.set(key, g);
  }
  const counterparties = Array.from(byCounterparty.values())
    .map(g => ({ ...g, missing: g.total - g.attached }))
    .sort((a, b) => b.missing - a.missing); // 사진 없는 거래 많은 순

  return NextResponse.json({
    success: true,
    data: {
      total: totalCount,
      attached: attachedCount,
      missing: missingCount,
      attachedPct: totalCount > 0 ? Math.round((attachedCount / totalCount) * 100) : 100,
      counterparties: counterparties.slice(0, 50), // top 50
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
    withAudit('ANNUAL_CLOSING_PPH23_PHOTO_STATUS_READ')
  )(request as RequestWithSession, (r) => handleGet(r, ctx));
}
```

audit enum 신규: `ANNUAL_CLOSING_PPH23_PHOTO_STATUS_READ`

### 3.2 CollectStep UI panel 추가

`src/app/[locale]/(dashboard)/tax/annual/pph25/page.tsx` 의 `CollectStep` 컴포넌트 (line 498+) 안에 panel 추가:

```tsx
// CollectStep 안
const [photoStatus, setPhotoStatus] = useState<PhotoStatusData | null>(null);

useEffect(() => {
  if (!sessionId) return;
  const ac = new AbortController();
  fetch(`/api/tax/annual-closing/${sessionId}/pph23-photo-status`, { signal: ac.signal })
    .then(r => r.ok ? r.json() : null)
    .then(j => { if (j?.success) setPhotoStatus(j.data); })
    .catch(() => {});
  return () => ac.abort();
}, [sessionId]);

// JSX (기존 자료 수집 진행률 카드 아래)
{photoStatus && photoStatus.total > 0 && (
  <div className={`rounded border p-3 text-sm ${photoStatus.missing > 0 ? 'bg-amber-50 border-amber-300' : 'bg-emerald-50 border-emerald-300'}`}>
    <div className="flex items-center justify-between">
      <p className="font-bold">
        {photoStatus.missing > 0 ? '⚠️ ' : '✅ '}
        {t('collect.pph23PhotoStatus', { attached: photoStatus.attached, total: photoStatus.total })}
      </p>
      <span className={`text-xs px-2 py-0.5 rounded ${photoStatus.missing > 0 ? 'bg-amber-200 text-amber-900' : 'bg-emerald-200 text-emerald-900'}`}>
        {photoStatus.attachedPct}%
      </span>
    </div>
    {photoStatus.missing > 0 && (
      <>
        <p className="text-xs text-amber-700 mt-1">
          {t('collect.pph23PhotoMissingHint', { count: photoStatus.missing })}
        </p>
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-amber-800 hover:text-amber-900">
            {t('collect.pph23PhotoShowCounterparties')}
          </summary>
          <table className="mt-2 w-full text-xs">
            <thead>
              <tr className="text-left text-amber-900">
                <th>{t('collect.pph23CounterpartyHeader')}</th>
                <th className="text-right">{t('collect.pph23AttachedHeader')}</th>
                <th className="text-right">{t('collect.pph23MissingAmountHeader')}</th>
              </tr>
            </thead>
            <tbody>
              {photoStatus.counterparties.filter(c => c.missing > 0).map(c => (
                <tr key={c.npwp ?? c.name} className="border-t border-amber-200">
                  <td className="py-1">{c.name}{c.npwp ? <span className="text-amber-600 text-[10px] ml-1">({c.npwp})</span> : null}</td>
                  <td className="text-right">{c.attached}/{c.total}</td>
                  <td className="text-right">{c.missingAmount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
        <Link href={`/${locale}/tax/pph23`} className="inline-block mt-2 text-xs text-amber-800 underline hover:text-amber-900">
          {t('collect.pph23PhotoOpenList')} →
        </Link>
      </>
    )}
  </div>
)}
```

### 3.3 i18n 6 키 × 5 locale

```
- collect.pph23PhotoStatus: "PPh23 사진 첨부 {attached}/{total}"
- collect.pph23PhotoMissingHint: "{count} 거래의 invoice 사진이 없습니다. 첨부 권장 (closing 진행은 가능)."
- collect.pph23PhotoShowCounterparties: "상대방별 상세 보기"
- collect.pph23PhotoOpenList: "PPh23 페이지에서 사진 첨부"
- collect.pph23CounterpartyHeader: "상대방"
- collect.pph23AttachedHeader: "첨부"
- collect.pph23MissingAmountHeader: "사진 없는 금액 (Rp)"
```

(7 키 — 위 count 정정)

## 4. Files

**신규** (2):
- `src/app/api/tax/annual-closing/[id]/pph23-photo-status/route.ts`
- `scripts/verify-closing-pph23-photo-status.ts`

**수정** (4):
- `src/app/[locale]/(dashboard)/tax/annual/pph25/page.tsx` — CollectStep 안 panel
- `src/i18n/messages/{ko,en,id,ja,zh}.json` — 7 키
- `scripts/test-smoke-all.ts` — STEPS +1 (26→27)
- `supabase/migrations/20260603000014_audit_enum_pph23_photo_status.sql` — audit enum

**마이그레이션** (1): audit enum 만

## 5. Smoke (`scripts/verify-closing-pph23-photo-status.ts`)

5 assertion:
1. Login + 활성 closing_session (`fiscal_year=2097` sentinel + 회사 customer)
2. Seed: PPh23 transactions 3 row — 1 with invoice_document_id, 2 without
3. GET `/api/tax/annual-closing/[id]/pph23-photo-status` → 200, total=3, attached=1, missing=2, attachedPct=33
4. response.counterparties 가 정확 groupBy (sort by missing desc)
5. Cleanup (transactions + session)

runner +1 step (26→27).

## 6. Out of scope

- **Excel export** (counterparty 별 PPh23 invoice 명세) — Phase 별도
- **사진 thumbnail in panel** — modal hover preview 만 — v2
- **사진 없는 거래에 직접 인라인 attach** — 현재는 /tax/pph23 페이지로 이동만 — v2
- **PPh26 / PPN faktur 의 invoice 사진 추적** — 별도 트랙 (그쪽은 사진 컬럼 없음)
- **closing PDF 에 invoice 명세 포함** — Phase 별도 (DJP lampiran 확장)

## 7. Risks

- **fiscal_year 범위 query**: tax_period 가 YYYY-MM 형식이라 string 범위 검색 (gte/lte) — 동작.
- **counterparty NULL 처리**: NPWP 도 NULL, name 도 NULL 시 `'UNKNOWN'` key. UI 에서 "—" 표시 처리.
- **closing_session 생성 시 FK chain**: customer + fiscal_year + closing_type. spec smoke 에서 minimal insert.
- **권한**: composeMiddleware 동일 패턴. CUSTOMER + CONSULTANT + 3 OPERATOR role.
- **panel 표시 시점**: photoStatus null 또는 total=0 일 때는 panel 안 보임. PPh23 거래 없는 customer 도 안전.
- **prod schema drift**: audit enum 만 — drift CI guard PASS.
