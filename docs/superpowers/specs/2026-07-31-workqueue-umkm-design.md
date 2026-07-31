# 상담원 통합 업무함 — 선납법인세(UMKM/PPh Final) 상세 설계

> 서브프로젝트 B-반복 #3. 골든 패턴(PPh21/원천세/PPN)을 선납법인세로 확장. 상세 소스가 거래 리스트가 아닌 **월 납부 레코드**(`tax_monthly_payment`)라는 점만 다름.

## 목표

v19 사이드바 "선납법인세 (PPh Final, 25)" 뷰(스텁) 활성화. `tax_monthly_payment`의 PPh_FINAL(UMKM 0.5%)·PPh25 월 납부 레코드를 상담원 업무함에서 검토·요청.

## 아키텍처 원칙

- **업무 단위** = `djp_submission_queue` row (customer × tax_type='PPh_FINAL' × month). PPh25는 큐 VALID_TAX_TYPES에 없고 prod 데이터 0 → 큐 매핑은 PPh_FINAL. 신규 테이블 0.
- **상세** = `tax_monthly_payment` (customer_id, tax_period='YYYY-MM', tax_type ∈ {PPh_FINAL, PPh25}). 보통 1~2행.
- 재사용: 요청 엔드포인트·RequestDrawer·quick-create(PPh_FINAL 이미 VALID_TAX_TYPES). 기존 뷰 회귀 없음.

## 데이터 모델 (확인 완료)

`tax_monthly_payment` 컬럼: `id, customer_id, tax_type('PPh_FINAL'|'PPh25'|…), tax_period('YYYY-MM'), tax_year, amount_due, amount_paid, penalty_amount, kode_billing, ntpn, payment_date, spt_masa_filed, bpe_number, status('UNPAID'|'PAID'|'OVERDUE'|'PARTIAL'), payment_deadline, reporting_deadline, notes`. prod PPh_FINAL 24행(customer.test 2025 각 월), PPh25 0행.

## 이슈 판정 규칙 (사용자 확정)

월 납부 레코드를 **red(확인 필요)** — 아래 중 하나라도:
1. **미납** — `status === 'UNPAID'`.
2. **연체** — `status === 'OVERDUE'`.
3. **부분납** — `status === 'PARTIAL'`.
4. **미계산** — `amount_due <= 0`.

이슈 없으면(= status PAID + amount_due>0) **green "확인 완료"**. 토큰: 상태 토큰(미납/연체/부분납) 우선 + `미계산`. label=`토큰.join('·')+' 확인 필요'`, 없으면 "확인 완료". amber 미사용.

## 구성 단위

### 1. 순수 판정 — `src/lib/operator/umkm-review-flags.ts`
```ts
interface UmkmReviewInput { status: string | null; amountDue: number; }
function evaluateUmkmFlags(input): { level: 'red'|'amber'|'green'; issues: string[]; label: string }
```
로직: status UNPAID→'미납' / OVERDUE→'연체' / PARTIAL→'부분납'; amountDue<=0→'미계산'. 유닛: 각 단독 red + PAID+due>0 green + 복합 label(예 UNPAID+due0 → "미납·미계산 확인 필요").

### 2. 상세 GET — `.../workqueue/[queueId]/umkm/route.ts`
- operator 게이트(기존 route 동일).
- queue → (customer_id, period).
- `tax_monthly_payment` (customer, tax_period=period, tax_type in ['PPh_FINAL','PPh25']), `order('tax_type')`.
- 각 행 `evaluateUmkmFlags`.
- 응답 `{ success, data: { queueId, customerId, period, status, summary, rows } }`.
  - `summary`: `{ recordCount, totalDue, totalPaid, totalPenalty, incompleteCount(red) }`.
  - `row`: `{ id, taxType('PPh_FINAL'|'PPh25'), amountDue, amountPaid, penaltyAmount, kodeBilling, paymentStatus, paymentDeadline, reportingDeadline, flags }`.
- `Cache-Control: no-store`.

### 3. 패널 — `UmkmReviewPanel.tsx` + `UmkmReviewTable.tsx`
- 요약 4카드(레코드 수 / 총 납부할 세액 / 총 납부액 / 미완료). 상태 필터(전체/미납/연체/부분납/완납). 표 컬럼: 상태 badge / 세목(PPh_FINAL→"PPh Final"·PPh25→"PPh 25") / 납부기한 / 신고기한 / 납부할 세액(amount_due) / 납부액(amount_paid) / 가산세(penalty) / kode billing / 납부상태 badge(UNPAID gray 미납/PAID green 완납/OVERDUE red 연체/PARTIAL amber 부분납) / 이슈 badge / [요청].
- [요청] → 기존 RequestModal 패턴 → `/workqueue/[id]/request` → PENDING_DOCS.

### 4. WorkqueueClient + Sidebar
- `types.ts#TAX_VIEW_TO_TYPE` 에 `umkm: 'PPh_FINAL'`.
- 패널 4-way 분기: `taxView==='umkm'` → `UmkmReviewPanel`.
- 사이드바 `viewBtn('umkm', '선납법인세 (PPh Final, 25)', true)` 스텁 제거.

### 5. i18n — `operatorWorkqueue.*`
`umkmTitle`, `umkmRecordCount`, `umkmTotalDue`, `umkmTotalPaid`. ko/en/id.

### 6. smoke — `scripts/test-workqueue-umkm.ts` + runner
sentinel period 2099-12, tax_type='PPh_FINAL'. quick-create → GET umkm shape(summary.recordCount number, rows array) → request PENDING_DOCS + 400 → customer RBAC 403 → cleanup. runner non-optional step.

## 비범위 (다음 반복)

PPh25 별도(데이터 0), PPh26/22/15, 연신고(SPT), 직원인사, AI 게이트+자동 큐생성, 승인 반려 루프, 수퍼바이저 잔여.

## 알려진 확인 지점 (구현 중)

1. status 값이 UNPAID/PAID/OVERDUE/PARTIAL 인지 prod sample 확인.
2. WorkqueueClient 패널 분기 4-way(pph21/withholding/ppn/umkm) 가독성 — 분기 함수 추출 고려.
