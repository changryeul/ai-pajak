# 상담원 통합 업무함 — 원천세(PPh23 + PPh4(2)) 상세 설계

> 서브프로젝트 B-반복 #1. PPh21 골든 패턴(`2026-07-31-counselor-workqueue-pph21-design.md`)을 원천세로 확장.

## 목표

v19 목업의 사이드바 "원천세 (PPh 4(2), 15, 22, 23, 26)" 뷰(현재 스텁·준비중)를 활성화하고, **PPh23 + PPh4(2)** 두 세목을 실데이터(`pph23_transaction`)에 붙여 상담원 통합 업무함에서 끝까지 검토·요청할 수 있게 한다.

## 아키텍처 원칙 (PPh21과 동일)

- **업무 단위** = 기존 `djp_submission_queue` row (customer × tax_type='PPh23' × month). 신규 상태 테이블 0.
- **상세** = `pph23_transaction` 을 (customer_id, tax_period='YYYY-MM') 으로 집계. PPh23 과 PPh4(2) 는 같은 테이블의 `tax_regime` 값('PPH23' vs 'PPH4_2')으로 구분 — 한 화면에 함께 보이되 regime 필터 제공.
- **재사용**: 요청 엔드포인트(`POST /api/operator/workqueue/[queueId]/request` → PENDING_DOCS), `RequestDrawer`, quick-create POST(tax_type='PPh23' 이미 허용)는 범용이라 그대로 재사용.
- **PPh21 회귀 없음**: 기존 PPh21 경로는 손대지 않는다. WorkqueueClient 의 리스트 fetch 만 taxView 구동으로 일반화.

## 데이터 모델 (확인 완료)

`pph23_transaction` 주요 컬럼: `id, customer_id, counterparty_id, tax_period('YYYY-MM'), transaction_date, description, service_type, invoice_number, gross_amount, tax_rate, tax_amount, counterparty_name, counterparty_npwp, tax_regime('PPH23'|'PPH4_2'), income_type, is_final, treaty_applied`.

**증빙(인보이스 사진) 첨부 여부**: `pph23_transaction` 의 컬럼이 아님. `POST /api/tax/pph23-transactions/[id]/invoice-photo` 가 storage 업로드 후 `document` row 를 삽입하고 트랜잭션에 연결한다. 따라서 상세 endpoint 는 거래 id 들로 `document` 를 **배치 조회**해 첨부 여부(`hasInvoicePhoto`)를 계산한다. (연결 컬럼명은 구현 Step에서 invoice-photo route 를 읽어 확정 — `document` 의 어떤 FK가 transaction 을 가리키는지.)

## 이슈 판정 규칙 (사용자 확정)

거래 한 줄을 **red(고객 요청 필요)** 로 분류하는 조건 — 아래 중 하나라도 해당하면 red:
1. **거래처 NPWP 없음** — `counterparty_npwp` blank.
2. **증빙 미첨부** — linked `document` 없음.
3. **세액/세율 0** — `tax_amount <= 0` 또는 `tax_rate <= 0`.
4. **거래처 미매칭** — `counterparty_id` null (공동 거래처 DB 미매칭).

이슈가 하나도 없으면 **green "확인 완료"**. (원천세 거래엔 payslip 같은 DRAFT/FINALIZED 상태가 없으므로 amber 는 v1에서 미사용 — 타입은 유지하되 emit 안 함. label 은 이슈 토큰 조합으로 생성, 예: "NPWP·증빙 필요".)

## 구성 단위 (PPh21과 1:1 대응)

### 1. 순수 이슈 판정 함수 — `src/lib/operator/withholding-review-flags.ts`
```ts
interface WithholdingReviewInput {
  counterpartyNpwp: string | null;
  counterpartyId: string | null;
  taxAmount: number;
  taxRate: number;
  hasInvoicePhoto: boolean;
}
type ReviewLevel = 'red' | 'amber' | 'green';
interface WithholdingFlags { level: ReviewLevel; issues: string[]; label: string; }
function evaluateWithholdingFlags(input): WithholdingFlags
```
이슈 토큰: `'NPWP' | '증빙' | '세액' | '거래처'`. label 은 토큰 한글 조합("NPWP·증빙 필요") 또는 단일("증빙 필요"), 없으면 "확인 완료". 유닛 테스트: 각 이슈 단독 red + 복합 label + clean green + 경계값(rate 0, amount 0).

### 2. 상세 GET — `src/app/api/operator/workqueue/[queueId]/withholding/route.ts`
- operator 게이트(PPh21 route 와 동일한 user_roles 확인).
- queue row → (customer_id, period).
- `pph23_transaction` 을 (customer_id, tax_period=period) 로 조회 (regime 무관 전체).
- 거래 id 들로 `document` 배치 조회 → `hasInvoicePhoto` 맵.
- 각 행에 `evaluateWithholdingFlags` 적용.
- 응답: `{ success, data: { queueId, customerId, period, status, summary, rows } }`.
  - `summary`: `{ txnCount, totalGross, totalTax, incompleteCount }` (incomplete = red).
  - `row`: `{ id, regime('PPH23'|'PPH4_2'), counterpartyName, counterpartyNpwp, transactionDate, description, incomeType, grossAmount, taxRate, taxAmount, hasInvoicePhoto, flags }`.
- `Cache-Control: no-store`.

### 3. 우측 패널 — `WithholdingReviewPanel.tsx` + `WithholdingReviewTable.tsx`
- Pph21ReviewPanel 구조 미러: 요약 4카드(거래 수 / 총 지급액 / 원천세 합계 / 미완료 N건) + regime 필터(전체/PPh23/PPh4(2)) + 상태 필터(red/green) + 표.
- 표 컬럼: 상태 badge / 거래처 / NPWP / 세목(regime→"PPh 23"·"PPh 4(2)") / 거래일 / 총 지급 / 세율 / 세액 / 증빙(첨부됨 CheckCircle→클릭 시 서명URL 미리보기 모달, 미첨부는 회색) / 이슈 badge / [요청].
- [요청] → 기존 RequestModal 재사용(메시지 기본값 = 거래처명 + flags.label). 전송 → `/workqueue/[queueId]/request` → PENDING_DOCS.
- 증빙 미리보기: 기존 `GET /api/tax/pph23-transactions/[id]/invoice-photo`(서명 URL) 재사용.

### 4. WorkqueueClient 일반화
- 현재 `load()` 가 `taxType=PPh21` 하드코딩 → `taxView` 기반 매핑으로 변경: `pph21→'PPh21'`, `withholding→'PPh23'`. 리스트 fetch 의 taxType 파라미터가 taxView 를 따라간다.
- 우측 상세: `taxView==='pph21'` → `Pph21ReviewPanel`, `'withholding'` → `WithholdingReviewPanel`. 선택 큐건 id 전달 방식 동일.
- 사이드바 `viewBtn('withholding', …, true)` 의 stub 플래그 제거 → 활성화. 나머지 세목(umkm/ppn/annual/employees)은 스텁 유지.
- taxView 변경 시 selectedId 초기화(다른 세목 큐건 혼선 방지).

### 5. i18n — `operatorWorkqueue.*` 확장
`whTitle`("원천세 (PPh 23 · 4(2))"), 컬럼 키(`colCounterparty, colRegime, colDate, colGrossWh, colRate, colTaxAmount, colEvidence`), 요약 라벨. ko/en/id.

### 6. prod smoke — `scripts/test-workqueue-withholding.ts` + runner
sentinel period 2099-12, tax_type='PPh23'. quick-create → GET withholding shape(summary.txnCount number, rows array) → request POST(PENDING_DOCS + 400 guard) → customer RBAC 403 → cleanup. runner 에 non-optional step 추가.

## 비범위 (다음 반복)

PPh26(별도 `pph26_transaction`)·PPh22·PPh15, UMKM/PPN/연신고/직원인사 뷰, AI 게이트+자동 큐생성, 승인 반려 루프, 수퍼바이저 잔여. 각각 별도 spec→plan.

## 알려진 확인 지점 (구현 중 검증)

1. `document` ↔ `pph23_transaction` 연결 컬럼명 (invoice-photo POST route 읽기).
2. `pph23_transaction` 에 status 유사 컬럼 부재 확인 (amber 미사용 근거).
3. WorkqueueClient 의 selectedId/counts 가 taxView 전환 시 올바르게 리셋되는지.
4. quick-create 가 tax_type='PPh23' 로 정상 생성(VALID_TAX_TYPES 포함 확인됨).
