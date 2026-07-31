# 상담원 통합 업무함 (PPh21 골든 패턴) — 설계 문서

- **작성일**: 2026-07-31
- **상태**: 승인됨 (브레인스토밍 완료, 구현 계획 대기)
- **원본 디자인**: `ai_pajak_counselor_workqueue_v19.html` (사용자 제공 목업, v18 스크린샷 기준)

## 배경 / 전체 개념

Assisted DIY 흐름: 고객이 자료를 입력 → AI가 만족 수준까지 반복 추가입력 요청(게이트) → 통과분이 상담원 검토 대상 → 상담원이 고객 자료 + AI 계산을 검토하고 부족분은 고객에게 요청 → 수퍼바이저에게 승인요청(메시지 포함) → 수퍼바이저가 승인/수정반려 → 상담원 반영 후 재요청.

이 전체는 **독립적으로 만들 수 있는 4개 서브시스템**으로 분해된다:

- **A. 고객측 AI 완결형 입력 게이트** (개념 1·2) — 신규, 가장 무거움. 나머지의 토대.
- **B. 상담원 통합 업무함** (개념 3·4) — 사용자 제공 목업 화면. **본 문서의 대상.**
- **C. 상담원↔수퍼바이저 승인 루프** (개념 5·6) — 대부분 존재, 배선 위주.
- **D. 수퍼바이저 콘솔** (개념 7) — 거의 다 존재.

각 서브시스템은 자체 spec → plan → 구현 사이클을 따로 돈다. 본 문서는 **B**만 다루며, 그 중에서도 **PPh21 한 세목**을 끝까지 완성해 "골든 패턴"을 확립한다. 나머지 5개 세목은 동일 틀로 후속 spec에서 반복한다.

## 확정 사항 (브레인스토밍 결정)

1. **범위**: 서브프로젝트 B, 세목은 PPh21 하나만 완성. 나머지 세목 뷰는 사이드바에 자리만 두고 "준비 중" 스텁.
2. **자리매김**: 기존 상담원 화면(`my-work`/`review-case`)을 흡수하는 **통합 메인 화면**. (추후 기존 라우트는 새 업무함으로 리다이렉트)
3. **미러링(개념 4)**: 상담원용 검토 표(목업)를 **기본**으로 하고, "고객이 보는 그대로 보기" 토글로 read-only 고객 화면(`MonthlyPayslipTab`)을 추가 제공. **둘 다.**
4. **업무 단위**: **(고객 × 세목 × 귀속월)** = `djp_submission_queue` row 하나. (이 테이블이 이미 `UNIQUE(customer_id, tax_type, tax_period_month, tax_period_year)`)
5. **데이터 백엔드(접근 A)**: 신규 상태 테이블을 만들지 않고 `djp_submission_queue`를 업무 단위로 재사용. 배정(`operator_id`)·상태기계·수퍼바이저 승인전이·ID Billing 연결을 그대로 활용.
6. **큐 row 생성**: B에는 **상담원 수동 생성(quick-create)만** 포함. 고객 입력→AI 게이트 통과 시 **자동 생성 트리거는 서브프로젝트 A로 미룸**.
7. **레이아웃**: 목업 v19의 **자체 전체 화면(어두운 사이드바 + 상단바)을 그대로 채택**. 이 업무함 화면에서는 앱 공용 대시보드 사이드바를 걷어낸다. 결과는 목업과 100% 동일해야 한다.

## 기존 자산 매핑 (재사용)

| 개념/요소 | 기존 자산 | 재사용 방식 |
|---|---|---|
| 업무 단위 (고객×세목×월) | `djp_submission_queue` (별칭 뷰 `operator_submission_queue`) | 그대로 |
| 리스트/필터 | `GET /api/operator/queue` (`status`/`taxType`/`year`/`month` 지원) | 그대로 |
| 상태 전이 | `PUT /api/operator/queue` (`review`, `request-approval` 등) | 그대로 |
| PPh21 직원 상세 | `monthly_payslip ⋈ employee_payroll` (NPWP/PTKP/이름) | 신규 GET에서 join |
| AI 계산값 | `monthly_payslip.pph21_tax`, `.ter_rate` | 표시 |
| 고객 화면 미러 | `MonthlyPayslipTab` 컴포넌트 | read-only 임베드 |
| 고객에게 요청 | customer-inbox threads/templates | 메시지 생성 |
| ID Billing 발행 | `id_billing_issuance` 보드 | 링크 위임 |
| 운영팀 게이트 | `operator/layout` (role + MFA gate) | 패턴 재사용 |

## 화면 구조 (3-pane, 목업 그대로)

- **좌측 사이드바**: 상태 필터(전체/미검토/검토중/수정작업중/검토완료 + 카운트) · 세목 뷰 6개(PPh21만 활성) · "ID Billing 발행" 링크(기존 보드로).
- **중앙 "고객 업무함"**: 선택된 세목·상태·귀속월에 해당하는 큐 row 리스트(회사명·NPWP·담당·마감·상태 badge). 페이징 + 요청현황 패널.
- **우측 메인**: 선택된 큐 건 상세 — 상단 요약 4카드(직원 수/총 지급/PPh21 합계/미완료 건수) + **직원별 검토 표**(직원·NPWP·PTKP·총지급·BPJS·THR·TER·PPH21·이슈·[요청]) + 선택 직원 상세.
- **우하단 플로팅**: 메신저/요청함(customer-inbox 재사용).

### 상태 라벨 매핑 (표시 전용)

| 목업 라벨 | `djp_submission_queue.status` |
|---|---|
| 미검토 | `PENDING` |
| 검토중 | `DATA_REVIEW` |
| 수정작업중 | `PENDING_DOCS` |
| 검토완료 | `PENDING_APPROVAL` |
| (승인됨 = 발행대기) | `APPROVED` / `EBILLING_GENERATED` / `PAYMENT_PENDING` |

## 액션 (전부 기존 API 배선, 신규 최소)

- **[요청]**(직원 행별 / 건별 → 고객): customer-inbox thread에 메시지 생성. 이슈 프리셋("NPWP 확인 필요" 등) 템플릿 사용. 건 상태 → `PENDING_DOCS`(수정작업중).
- **검토 진행**: `PENDING`→`DATA_REVIEW` (`PUT /api/operator/queue` action=review).
- **승인요청**(→수퍼바이저): `action=request-approval` → `PENDING_APPROVAL`. (수퍼바이저 메시지·반려 루프의 정교화는 서브프로젝트 C.)
- **ID Billing 발행**: 승인완료 건은 기존 발행 보드로.
- **"고객이 보는 그대로 보기" 토글**: 우측 메인에서 read-only `MonthlyPayslipTab` 임베드(개념 4 미러).
- **수동 생성(quick-create)**: (고객×세목×월) 큐 row 없을 때 상담원이 생성. 자동 트리거는 A로 미룸.

## 컴포넌트 분리 (각 단일 책임)

- `WorkqueueShell` — 어두운 사이드바 + 상단바(역할 pill·검색·기간·정렬·언어) 프레임.
- `WorkqueueSidebar` — 상태 필터(카운트) + 세목 뷰 6(PPh21 활성/나머지 스텁) + ID Billing 링크.
- `CustomerWorklist` — 중앙 큐 리스트 + 페이징 + 요청현황 패널.
- `Pph21ReviewPanel` — 우측: 요약 4카드 + `EmployeeReviewTable`.
- `EmployeeReviewTable` / `EmployeeDetail` — 직원별 행(이슈 플래그·[요청]) + 선택 직원 상세.
- `CustomerMirrorToggle` — "고객이 보는 그대로 보기" → read-only `MonthlyPayslipTab` 임베드.
- `RequestDrawer` — 플로팅 메신저/요청함(customer-inbox 재사용).

## 레이아웃 처리 (목업 100% 재현)

- `/operator/workqueue`는 **전용 full-bleed 레이아웃** — 앱 공용 대시보드 사이드바를 걷어내고 v19의 어두운 사이드바+상단바를 렌더.
- v19의 CSS는 **그대로 CSS Module로 이식**(Tailwind 재작성 대신)해 색·간격·radius 픽셀 일치를 보장. 클래스명 그대로(`.side`, `.cust`, `.tbl`, `.wa-bubble` 등) → 목업과 diff 최소.
- 운영팀 레이어 게이트(role 검증 + operator MFA gate)는 기존 `operator/layout` 패턴 재사용.

## 신규 백엔드 (최소)

- `GET /api/operator/workqueue/[queueId]/pph21` — 큐 건의 (고객×귀속월) `monthly_payslip ⋈ employee_payroll` + 요약 + 이슈 플래그 반환.
- `POST /api/operator/queue` (quick-create, 없으면 신설) — (고객×세목×월) row 생성. idempotent(UNIQUE 충돌 시 기존 반환).
- `src/lib/operator/pph21-review-flags.ts` — **순수 함수** 이슈 판정(NPWP 없음 / BPJS 미입력 / THR 확인 등). 유닛 테스트 대상.
- 나머지(리스트·review·request-approval·요청 메시지)는 **기존 API 재사용**.

## 에러 / 엣지

- payslip 0건 → "고객 자료 미입력" 빈 상태 + [요청] 노출.
- 큐 row 없는 (고객×세목×월) → quick-create 유도.
- RLS/권한: 상담원은 배정된 건만(`operator_id`). 로딩/실패 토스트.
- 상태-라벨 매핑에 없는 상태(`COMPLETED`/`FAILED`)는 리스트 기본 필터에서 제외(별도 뷰).

## 테스트

- **유닛**: `pph21-review-flags.test.ts` (플래그 판정 케이스: NPWP 없음/BPJS 미입력/THR/정상).
- **smoke** (`SEED_TARGET=prod`): `GET /workqueue/[id]/pph21` shape + queue 필터 + RBAC 403 + quick-create round-trip. 통합 runner(`test-smoke-all.ts`)에 1 step 추가.
- **e2e**: 업무함 렌더 + 세목/상태 전환 + 접근 게이트(operator 200 / customer 403).
- **i18n**: ko/en/id 키.

## 명시적 비범위 (Out of Scope)

- 서브프로젝트 A(고객측 AI 완결형 입력 게이트) 및 큐 row 자동 생성 트리거.
- PPh21 외 5개 세목의 상세 뷰 구현(스텁만).
- 수퍼바이저 승인/반려 메시지 루프의 정교화(서브프로젝트 C).
- 수퍼바이저 콘솔(서브프로젝트 D) — 이미 대부분 존재.

## 후속 서브프로젝트 (순서 제안)

1. **B** (본 문서) — PPh21 골든 패턴.
2. **A** — AI 완결형 입력 게이트 + 큐 row 자동 생성. (세목별 "만족 기준" 정의 필요)
3. B 반복 — 원천세/PPN/선납법인세/연신고/직원인사 각 세목 뷰.
4. **C** — 승인 루프 정교화 (수퍼바이저 메시지/반려).
5. **D** — 수퍼바이저 콘솔 잔여.
