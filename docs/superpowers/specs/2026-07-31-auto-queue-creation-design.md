# 자동 큐 생성 (customer 활동 → workqueue self-populate) 설계

> 서브프로젝트 A(일부). 상담원 통합 업무함이 수동 quick-create 없이 실제 고객 자료 제출로 채워지도록, 고객 tax-data write 시 `djp_submission_queue` 행을 자동 생성한다.

## 목표

고객이 자료를 저장/제출하면(급여명세·원천세 거래·PPN faktur·월납부) 해당 `(customer × 세목 × 월)` 큐 행이 자동 생성되어 **담당 상담원의 업무함에 즉시 노출**된다. 지금은 큐 행이 있어야 워크큐에 뜨는데, 데모는 수동 생성이었다 — 이걸 자동화한다.

## 아키텍처 원칙

- **공유 헬퍼** 1개 (`ensureQueueForActivity`) — best-effort idempotent upsert. 신규 테이블 0.
- **best-effort**: 큐 생성 실패가 고객 write 를 절대 실패시키지 않는다(try/catch 또는 결과 무시).
- **멱등**: quick-create 와 동일한 유니크 `(customer_id, tax_type, tax_period_month, tax_period_year)` 기반 — 이미 있으면 skip.
- **operator_id**: `operator_client_assignments`(is_active, 최신 assigned_date)에서 고객 담당 operator 조회 → 큐 행에 세팅. 미배정 고객이면 null(미배정 큐 = supervisor auto-assign fallback 과 동일 취급).
- 큐 상태기계·워크큐 소비자 변경 0 (신규 행은 기존 PENDING 상태로 진입).

## 데이터 흐름

```
고객 write (payslip/pph23/ppn/월납부 저장)
   └─ 성공 후 best-effort:
        ensureQueueForActivity(admin, customerId, taxType, period)
           1. period 'YYYY-MM' → month/year 파싱 (실패 시 no-op)
           2. taxType ∈ {PPh21, PPh23, PPN, PPh_FINAL} 검증
           3. 기존 (customer×taxType×month×year) 행 있으면 return
           4. operator_client_assignments(is_active desc) → operator_id
           5. djp_submission_queue insert(status=PENDING, operator_id)
              — 23505(race) 는 무시
```

## 세목 매핑 (훅 → 큐 tax_type)

| 세목 | write 엔드포인트 | ensureQueue taxType |
|---|---|---|
| PPh21 | `POST/PUT /api/tax/monthly-payslip` (급여명세 저장) | PPh21 |
| 원천세 | `POST /api/tax/pph23-transactions` (단건) + `/api/tax/pph23-transactions/import` (일괄) | PPh23 |
| PPN | `POST /api/tax/ppn-faktur-monthly` (단건) + `/api/tax/ppn-bulk-import` (일괄) | PPN |
| 선납법인세 | `tax_monthly_payment` write 경로 (`/api/tax/monthly-payments`) | PPh_FINAL |

> PPh4(2) 거래도 pph23_transaction 이므로 taxType='PPh23' (워크큐 원천세 뷰가 두 regime 함께 표시 — 반복 #1과 일치).

## 구성 단위

### 1. 공유 헬퍼 — `src/lib/operator/ensure-queue-item.ts`
```ts
import type { SupabaseClient } from '@supabase/supabase-js';

const AUTO_QUEUE_TAX_TYPES = ['PPh21', 'PPh23', 'PPN', 'PPh_FINAL'];

// 'YYYY-MM' → { month, year } | null
export function parsePeriod(period: string): { month: number; year: number } | null;

// best-effort: 큐 행 없으면 생성. 예외를 던지지 않는다.
export async function ensureQueueForActivity(
  admin: SupabaseClient, customerId: string, taxType: string, period: string,
): Promise<{ created: boolean; reason?: string }>;
```
- `parsePeriod` 순수 — 유닛(정상/월경계/잘못된 형식 null).
- `ensureQueueForActivity` — taxType 미허용/period 파싱 실패 시 `{created:false, reason}` 반환(no-op). 내부 try/catch 로 어떤 예외도 삼킴.

### 2. 훅 삽입 (4세목 write 엔드포인트)
각 성공 write 직후 `void ensureQueueForActivity(admin, customerId, taxType, period).catch(()=>{})` 또는 `try { await … } catch {}`. 응답 지연 최소화를 위해 await 하되 실패는 무시. bulk 경로는 write 된 distinct period 집합에 대해 각각 호출.

### 3. prod smoke — `scripts/test-auto-queue-creation.ts`
- 고객(customer.test) 토큰으로 sentinel period(2099-12) pph23 거래 1건 POST.
- `djp_submission_queue` 에 (customer×PPh23×2099-12) 행 자동 생성 확인.
- operator_id 가 고객 담당 operator(있으면)로 세팅됐는지 확인(또는 null 허용).
- cleanup: 큐 행 + sentinel 거래 삭제. runner non-optional step.

## 비범위

AI 사전검토 게이트, 승인 반려 루프, 연신고 자동 큐(연 모델 별도), 자동 재배정. 큐 상태 전이/알림 변경 없음.

## 알려진 확인 지점 (구현 중)

1. monthly-payslip 저장 엔드포인트의 정확한 경로/period 필드.
2. pph23 import / ppn-bulk-import 의 write 후 period 집합 추출 지점.
3. tax_monthly_payment write 경로가 `/api/tax/monthly-payments` POST 인지.
4. operator_client_assignments 최신 active row 선택(assigned_date desc) 컬럼명.
