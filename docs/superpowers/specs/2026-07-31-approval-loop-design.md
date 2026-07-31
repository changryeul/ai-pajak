# 승인 반려 루프 (워크큐 인패널) 설계

> 서브프로젝트 C. 워크큐에서 상담원 검토완료 → 수퍼바이저 승인/반려 → 반려 시 상담원 재작업. 백엔드(queue PUT approve/reject)는 이미 존재 — UI 배선만.

## 목표

각 세목 패널에서 큐 상태·역할에 맞는 승인 액션을 노출한다. 상담원은 "고객 검토완료"로 승인 요청, 수퍼바이저는 같은 워크큐에서 "승인"/"반려(사유)"를 처리하고, 반려된 건은 상담원이 사유 배너를 보고 재작업한다.

## 아키텍처 원칙

- **백엔드 재사용**: `PUT /api/operator/queue` 의 request-approval/approve/reject. 신규 상태·전이 0. reject 는 `rejectedReason` 필수, `rejected_reason` 저장, approve 시 클리어(기존 동작).
- **역할**: approve/reject 는 SUPERVISOR_ROLES(LEAD/SUPERVISOR/MASTER) 전용(기존 게이트). 워크큐는 assertOperatorAccess 로 supervisor 도 진입.
- **공용 컴포넌트** 1개를 4패널에 삽입(AiPreReviewBox 패턴). 승인상태 GET 1개.
- **인패널만**: 별도 수퍼바이저 리스트 뷰 없음. 수퍼바이저는 사이드바 status 필터 "검토완료"(=PENDING_APPROVAL)로 목록을 보고 건별 처리.

## 상태·역할 → 액션 매트릭스

| 큐 status | 상담원(non-supervisor) | 수퍼바이저 |
|---|---|---|
| PENDING / DATA_REVIEW | "고객 검토완료"(request-approval) | 동일 |
| PENDING_APPROVAL | "승인 대기 중"(disabled) | "승인"(approve) + "반려"(reject+사유 모달) |
| APPROVED | "승인 완료" badge | 동일 |
| (rejected_reason 존재 시) | 상단 red 배너 "반려 사유: …" + 재요청 가능 | 동일 |

## 구성 단위

### 1. 승인상태 GET — `GET /api/operator/workqueue/[queueId]/approval`
- operator 게이트(4계). 요청자 role 조회.
- 큐 row → `{ status, rejectedReason, approvedAt, approvalNotes }`.
- `canApprove` = role ∈ ['TAX_OPERATOR_LEAD','TAX_OPERATOR_SUPERVISOR','TAX_OPERATOR_MASTER'].
- 응답 `{ success, data: { status, rejectedReason, approvedAt, canApprove } }`. no-store.

### 2. 공용 컴포넌트 — `src/components/operator/workqueue/ApprovalActions.tsx`
- props `{ queueId, onChanged }`.
- 마운트 시 approval GET → 상태 보관. `act(action, extra?)` = PUT `/api/operator/queue` {id, action, ...extra} → 성공 시 approval 재조회 + onChanged().
- 렌더:
  - rejectedReason 있으면 상단 red 배너(`styles.blocked`) "반려 사유: {reason}".
  - status APPROVED → "✅ 승인 완료" badge(+ approvedAt).
  - status PENDING_APPROVAL:
    - canApprove → [승인](approve) + [반려](reject → 사유 textarea 모달, 빈 사유 disabled).
    - else → "승인 대기 중"(disabled).
  - status PENDING/DATA_REVIEW → [고객 검토완료](request-approval).
- 로딩/에러 최소 처리.

### 3. 4패널 수정
`Pph21ReviewPanel`/`WithholdingReviewPanel`/`PpnReviewPanel`/`UmkmReviewPanel` 헤더의 인라인 "고객 검토완료"(`act('request-approval')`) 버튼을 `<ApprovalActions queueId={queueId} onChanged={load} />` 로 교체. (PPh21 은 헤더 우측 버튼군, 나머지는 헤더 우측 "고객 검토완료" 자리.) 각 패널의 `act` 로컬 함수는 ApprovalActions 로 이관되므로 미사용 시 제거.

### 4. smoke — `scripts/test-workqueue-approval-loop.ts` + runner
- sentinel PPh23 큐 생성(quick-create).
- operator: PUT request-approval → PENDING_APPROVAL 확인(단, operator 가 PENDING 이면 먼저 review). 실제로는 supervisor 로 walk: review→request-approval→PENDING_APPROVAL.
- GET approval as supervisor → canApprove=true; as operator → canApprove=false.
- supervisor reject(rejectedReason='[APPRLOOP-E2E] 사유') → status DATA_REVIEW + GET approval.rejectedReason 반영.
- operator approve(권한 없음) → 403(SUPERVISOR_ACTIONS 게이트).
- cleanup. runner non-optional.

## 비범위

수퍼바이저 전용 리스트 뷰, 반려 사유 프리셋, 승인 이력 타임라인, consultant_session ERP 승인(별도 `/operator/supervisor/approval`).

## 알려진 확인 지점 (구현 중)

1. 각 패널의 "고객 검토완료" 버튼 위치/문구(교체 지점).
2. approval GET 의 role 조회가 4계 전부 통과하는지(operator 도 GET 은 허용, canApprove만 false).
3. reject 후 rejected_reason 이 GET approval 에 노출되는지(DATA_REVIEW 로 돌아가도 reason 유지, 다음 approve 시 클리어).
