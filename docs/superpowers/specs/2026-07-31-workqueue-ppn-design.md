# 상담원 통합 업무함 — PPN(부가세) 상세 설계

> 서브프로젝트 B-반복 #2. 원천세 골든 패턴(`2026-07-31-workqueue-withholding-design.md`)을 PPN으로 확장.

## 목표

v19 목업 사이드바 "부가세 (PPN)" 뷰(현재 스텁·준비중)를 활성화하고, `ppn_faktur_monthly`(매출 OUT + 매입 IN)를 상담원 업무함에서 검토·요청할 수 있게 한다. PPN 검토의 핵심은 **Coretax 대조**와 **faktur 완결성**.

## 아키텍처 원칙 (원천세와 동일)

- **업무 단위** = `djp_submission_queue` row (customer × tax_type='PPN' × month). 신규 상태 테이블 0.
- **상세** = `ppn_faktur_monthly` 을 (customer_id, tax_period='YYYY-MM') 으로 집계. faktur_type KELUARAN(매출)/MASUKAN(매입) 함께, 필터 제공.
- **재사용**: 요청 엔드포인트(`POST /api/operator/workqueue/[queueId]/request`), `RequestDrawer`, quick-create(tax_type='PPN' 이미 VALID_TAX_TYPES 포함).
- 기존 세목 뷰(PPh21/원천세) 회귀 없음. WorkqueueClient 는 이미 taxView 구동이라 매핑 1줄 + 패널 분기만 추가.

## 데이터 모델 (확인 완료)

`ppn_faktur_monthly` 컬럼: `id, customer_id, tax_period('YYYY-MM'), faktur_type('KELUARAN'=매출|'MASUKAN'=매입), faktur_number, faktur_date, counterparty_id, counterparty_name, counterparty_npwp, dpp, dpp_nilai_lain, is_luxury, ppn, coretax_dpp, coretax_ppn, recon_status('MATCH'|'DIFF'|'MISSING_CORETAX'|'MISSING_CUSTOMER'|'PENDING'|null), recon_source, reconciled_at`. prod 48행 실데이터.

`recon_status` 의미: MATCH(일치), DIFF(DPP/PPN 값 불일치), MISSING_CORETAX(Coretax에 없음), MISSING_CUSTOMER(고객자료에 없음 = Coretax 전용행), PENDING/null(아직 대조 안 함).

## 이슈 판정 규칙 (사용자 확정)

faktur 한 줄을 **red(확인 필요)** — 아래 중 하나라도 해당하면:
1. **Coretax 불일치** — `recon_status === 'DIFF'`.
2. **Coretax 누락** — `recon_status === 'MISSING_CORETAX'` 또는 `'MISSING_CUSTOMER'`.
3. **faktur 번호 없음** — `faktur_number` blank.
4. **거래처 NPWP 없음** — `counterparty_npwp` blank.

이슈 없으면 **green "확인 완료"**. recon 미실행(PENDING/null)은 Coretax 기준 미발동(대조 전엔 flag 안 함). 이슈 토큰: `Coretax`(DIFF·MISSING_* 통합), `faktur`, `NPWP`. label = `토큰.join('·') + ' 확인 필요'`, 없으면 "확인 완료". amber 미사용.

## 구성 단위 (원천세와 1:1)

### 1. 순수 판정 — `src/lib/operator/ppn-review-flags.ts`
```ts
interface PpnReviewInput {
  reconStatus: string | null; // MATCH|DIFF|MISSING_CORETAX|MISSING_CUSTOMER|PENDING|null
  fakturNumber: string | null;
  counterpartyNpwp: string | null;
}
function evaluatePpnFlags(input): { level: 'red'|'amber'|'green'; issues: string[]; label: string }
```
`Coretax` 토큰: reconStatus ∈ {DIFF, MISSING_CORETAX, MISSING_CUSTOMER}. 유닛: 각 이슈 단독 red + clean green + 복합 label + PENDING/null 은 Coretax flag 안 남.

### 2. 상세 GET — `.../workqueue/[queueId]/ppn/route.ts`
- operator 게이트(원천세 route 동일).
- queue → (customer_id, period).
- `ppn_faktur_monthly` (customer, tax_period=period) 조회, `order('faktur_type').order('faktur_date')`.
- 각 행 `evaluatePpnFlags` 적용.
- 응답 `{ success, data: { queueId, customerId, period, status, summary, rows } }`.
  - `summary`: `{ fakturCount, totalDpp, totalPpn, incompleteCount(red) }`.
  - `row`: `{ id, fakturType('KELUARAN'|'MASUKAN'), fakturNumber, fakturDate, counterpartyName, counterpartyNpwp, dpp, ppn, isLuxury, reconStatus, flags }`.
- `Cache-Control: no-store`.

### 3. 패널 — `PpnReviewPanel.tsx` + `PpnReviewTable.tsx`
- WithholdingReviewPanel 구조 미러. 요약 4카드(faktur 수 / 총 DPP / 총 PPN / 미완료). 필터: faktur_type(전체/매출 KELUARAN/매입 MASUKAN) + recon status(전체/MATCH/DIFF/MISSING/미대조). 표 컬럼: 상태 badge / 방향(KELUARAN→"매출"·MASUKAN→"매입") / faktur 번호 / 거래처 / NPWP / DPP / PPN / **Coretax 대조**(recon_status badge: MATCH green "일치" / DIFF red "불일치" / MISSING_* amber "누락" / PENDING·null gray "미대조") / 이슈 badge / [요청].
- [요청] → 기존 RequestModal 패턴(메시지 기본값 = 거래처명 + flags.label) → `/workqueue/[id]/request` → PENDING_DOCS.
- 증빙 미리보기 없음(PPN faktur 에 photo 메커니즘 없음).

### 4. WorkqueueClient + Sidebar
- `types.ts#TAX_VIEW_TO_TYPE` 에 `ppn: 'PPN'` 추가.
- 패널 분기: `taxView==='ppn'` → `PpnReviewPanel`.
- 사이드바 `viewBtn('ppn', '부가세 (PPN)', true)` 의 stub 제거.

### 5. i18n — `operatorWorkqueue.*`
`ppnTitle`, `ppnFakturCount`, `ppnTotalDpp`, `ppnTotalPpn`. ko/en/id.

### 6. smoke — `scripts/test-workqueue-ppn.ts` + runner
sentinel period 2099-12, tax_type='PPN'. quick-create → GET ppn shape(summary.fakturCount number, rows array) → request PENDING_DOCS + 400 → customer RBAC 403 → cleanup. runner non-optional step.

## 비범위 (다음 반복)

PPh26(0행)·22·15, UMKM(선납법인세/PPh25), 연신고(SPT), 직원인사, AI 게이트+자동 큐생성, 승인 반려 루프, 수퍼바이저 잔여.

## 알려진 확인 지점 (구현 중)

1. faktur_type 실제 값 = 'KELUARAN'(매출)/'MASUKAN'(매입) 확인 완료. recon_status 전부 'PENDING'(대조 전).
2. recon_status 에 'PENDING' 실사용 여부(없으면 null 만 처리해도 무방 — flags 는 이미 안전).
3. WorkqueueClient 패널 분기 3-way(pph21/withholding/ppn) 가독성.
