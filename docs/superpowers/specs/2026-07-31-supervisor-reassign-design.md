# 수퍼바이저 재배정 + 역할 인식 (워크큐) 설계

> 서브프로젝트 D(일부). 워크큐에서 (1) 상단 역할 바를 실제 역할로 표시, (2) 수퍼바이저가 큐 건을 다른 상담원에게 재배정. 백엔드(queue PUT reassign)는 이미 존재.

## 목표

- 워크큐 상단 역할 배지를 하드코딩 "상담원" → 실제 역할("수퍼바이저"/"상담원")로 표시.
- 수퍼바이저는 각 세목 패널에서 해당 큐 건을 **다른 상담원에게 재배정**(대상 선택 + 사유). reassign 백엔드(용량·상태 검증·이력) 재사용.

## 아키텍처 원칙

- 백엔드 재사용: `PUT /api/operator/queue` `reassign`(targetOperatorId=tax_operators.id, reassignmentReason, supervisor 전용, capacity/active 검증 + `queue_reassignment_history` 기록). 신규 상태 0.
- 재사용: 재배정 컨트롤은 `ApprovalActions`(이미 canApprove 보유)에 추가 — canApprove(=supervisor) 일 때만 노출.
- 역할은 서버(page)에서 resolve → WorkqueueClient 로 전달(클라 재조회 없음).

## 구성 단위

### 1. 역할 전달 + 나가기 링크 — page → WorkqueueClient
- `src/app/[locale]/(fullscreen)/operator/workqueue/page.tsx` async 화: `assertOperatorAccess(supabase, locale)` 반환 role 을 `WorkqueueClient` 에 `role` prop 전달.
- `WorkqueueClient` `role?: string` prop 추가. 상단 `styles.role` 배지 텍스트를 `SUPERVISOR_ROLES.includes(role) ? '수퍼바이저' : '상담원'`. (SUPERVISOR_ROLES = LEAD/SUPERVISOR/MASTER.)
- **나가기 링크 (사용자 요청, 필수)**: 풀스크린 워크큐는 일반 대시보드로 돌아갈 방법이 없음. 상단 바 우측(tools 옆)에 `← 나가기` 링크 추가 → `../dashboard`(= `/[locale]/operator/dashboard`) 로 이동. 앱 셸(사이드바) 있는 일반 화면으로 복귀.

### 2. 상담원 목록 — `GET /api/operator/workqueue/operators`
- operator 게이트(4계). `tax_operators` 에서 `status='active'` 인 `{id, name}` 목록 반환(재배정 대상 후보).
- 응답 `{ success, data: { operators: [{id, name}] } }`. no-store.

### 3. 재배정 컨트롤 — `ApprovalActions` 확장
- canApprove 일 때 버튼군에 "재배정" 추가 → `ReassignModal`:
  - 마운트 시 `GET /workqueue/operators` → 드롭다운(현재 담당 제외는 서버가 아닌 UI 편의; 선택 자유).
  - 대상 operator select + 사유 textarea. 둘 다 있어야 제출 활성.
  - 제출 → `PUT /api/operator/queue` {id, action:'reassign', targetOperatorId, reassignmentReason} → 성공 시 onChanged + 닫기. 400(용량초과 등) 시 에러 표시.

### 4. smoke — `scripts/test-workqueue-reassign.ts` + runner
- sentinel PPh23 큐 생성.
- `GET /workqueue/operators` as operator → 200 + operators 배열(각 {id,name}).
- supervisor reassign(대상 = 목록 첫 active operator, 사유) → 200 + 큐 operator_id 변경 확인(DB).
- operator reassign → 403(supervisor-only).
- reassign 사유 누락 → 400.
- cleanup. runner non-optional.

## 비범위

재배정 이력 뷰, 팀 워크로드 오버뷰, 자동 재배정, 기존 supervisor 콘솔(`/operator/supervisor/*`) 변경.

## 알려진 확인 지점 (구현 중)

1. WorkqueueClient 상단 배지 위치(현 `styles.role` 하드코딩 "상담원").
2. tax_operators.status 값('active') + name 컬럼.
3. reassign 대상 capacity 초과 시 400 → 모달 에러 표시 경로.
