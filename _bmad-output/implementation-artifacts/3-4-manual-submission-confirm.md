# Story 3.4: 수동 제출 완료 확인

## Status: ready-for-dev

## Story

- **As a** Tax Advisor
- **I want** 수동 제출 후 시스템에 완료를 기록하도록
- **So that** 제출 상태가 정확히 추적됩니다

## Acceptance Criteria (ACs)

### AC 3.4.1: 수동 제출 완료 기록
**Given** READY_TO_FILE 상태의 케이스가 있을 때
**When** "수동 제출 완료" 버튼을 클릭하면
**Then** DJP 참조 번호 입력 필드가 표시됩니다 (선택)
**And** 제출 일시가 기록됩니다
**And** 케이스 상태가 FILED로 변경됩니다
**And** submission_prep에 수동 제출 완료로 기록됩니다

## Technical Notes

### Architecture Context

이 스토리는 Story 3-3 (SubmissionPrepService)의 연장선상에 있습니다:
- SubmissionPrep 엔티티에 수동 제출 완료 상태를 기록
- WorkflowStage를 READY_TO_FILE → FILED로 전환
- AuditLog에 제출 완료 이벤트 기록

### Key Components

1. **Backend (NestJS)**
   - `SubmissionPrepService.markAsSubmitted()` - 수동 제출 완료 처리
   - `SubmissionPrepController` - POST endpoint 추가
   - POA 유효성 재검증 (제출 시점 기준)

2. **Frontend (React)**
   - `MarkSubmittedDialog` - 제출 완료 확인 다이얼로그
   - `SubmissionStatusCard` - 상태 표시 컴포넌트 업데이트
   - React Query mutation hook

### Database Changes

기존 SubmissionPrep 테이블 활용:
- `status`: 'READY' → 'SUBMITTED'
- `submittedAt`: 제출 일시 기록
- `djpReferenceNumber`: DJP 참조 번호 (선택)
- `submittedBy`: 제출 처리한 Tax Advisor ID

### API Endpoint

```
POST /api/submission-prep/:taxCaseId/mark-submitted
Body: {
  djpReferenceNumber?: string  // 선택적 DJP 참조 번호
  submittedAt?: string         // ISO datetime, 기본값 now()
}
Response: {
  success: boolean
  submissionPrep: SubmissionPrepDto
  taxCase: { id, stage: 'FILED' }
}
```

### Workflow State Transition

```
READY_TO_FILE (submission_prep.status = 'READY')
    ↓ markAsSubmitted()
FILED (submission_prep.status = 'SUBMITTED')
```

## Tasks

### Task 1: SubmissionPrepService.markAsSubmitted() 구현
- [ ] Subtask 1.1: `markAsSubmitted(taxCaseId, dto)` 메서드 구현
- [ ] Subtask 1.2: POA 유효성 재검증 로직 추가
- [ ] Subtask 1.3: SubmissionPrep status를 'SUBMITTED'로 업데이트
- [ ] Subtask 1.4: submittedAt, submittedBy 필드 기록
- [ ] Subtask 1.5: djpReferenceNumber 저장 (선택적)
- [ ] Subtask 1.6: WorkflowStage를 FILED로 전환

### Task 2: DTO 정의
- [ ] Subtask 2.1: `MarkSubmittedDto` 생성 (djpReferenceNumber, submittedAt)
- [ ] Subtask 2.2: `MarkSubmittedResultDto` 생성 (submissionPrep, taxCase)
- [ ] Subtask 2.3: class-validator 데코레이터 적용

### Task 3: Controller Endpoint 구현
- [ ] Subtask 3.1: POST `/api/submission-prep/:taxCaseId/mark-submitted` 엔드포인트 추가
- [ ] Subtask 3.2: @Roles('TAX_ADVISOR_JTC') 권한 검사 적용
- [ ] Subtask 3.3: Swagger 문서화 추가

### Task 4: AuditLog 기록
- [ ] Subtask 4.1: SUBMISSION_COMPLETED 이벤트 타입 정의
- [ ] Subtask 4.2: 제출 완료 시 AuditLog 자동 생성
- [ ] Subtask 4.3: djpReferenceNumber를 metadata에 포함

### Task 5: 프론트엔드 MarkSubmittedDialog 컴포넌트
- [ ] Subtask 5.1: `MarkSubmittedDialog` 컴포넌트 생성
- [ ] Subtask 5.2: DJP 참조 번호 입력 필드 (선택적)
- [ ] Subtask 5.3: 제출 일시 선택 (기본값: 현재 시간)
- [ ] Subtask 5.4: 확인/취소 버튼 구현
- [ ] Subtask 5.5: 로딩 상태 및 에러 처리

### Task 6: SubmissionStatusCard 업데이트
- [ ] Subtask 6.1: FILED 상태 표시 UI 추가
- [ ] Subtask 6.2: 제출 일시 및 DJP 참조 번호 표시
- [ ] Subtask 6.3: 제출자 정보 표시

### Task 7: React Query Hook 구현
- [ ] Subtask 7.1: `useMarkAsSubmitted` mutation hook 생성
- [ ] Subtask 7.2: 성공 시 TaxCase 쿼리 무효화
- [ ] Subtask 7.3: 에러 핸들링 및 토스트 알림

### Task 8: 단위 테스트
- [ ] Subtask 8.1: SubmissionPrepService.markAsSubmitted() 테스트
- [ ] Subtask 8.2: POA 검증 실패 케이스 테스트
- [ ] Subtask 8.3: 잘못된 상태에서의 호출 테스트 (READY_TO_FILE이 아닐 때)
- [ ] Subtask 8.4: Controller 엔드포인트 E2E 테스트

## Dependencies

- **Story 3-3**: SubmissionPrepService, POA validation service
- **Story 3-1**: SPT submission data generation (SubmissionPrep 엔티티)
- **Existing**: WorkflowService for stage transition

## Dev Notes

### 참고: Story 3-3 패턴 활용

Story 3-3에서 구현된 패턴을 따릅니다:
- SubmissionPrepService의 기존 메서드 구조 참조
- POA 검증 로직 재사용
- WorkflowStage 전환 패턴 일관성 유지

### 에러 핸들링

```typescript
// 예상되는 에러 케이스
- POA_EXPIRED: POA 만료됨
- INVALID_STATE: READY_TO_FILE 상태가 아님
- SUBMISSION_PREP_NOT_FOUND: SubmissionPrep 레코드 없음
```

### UI/UX 고려사항

- "수동 제출 완료" 버튼은 READY_TO_FILE 상태에서만 활성화
- 제출 완료 전 확인 다이얼로그 필수 표시
- DJP 참조 번호는 나중에도 수정 가능하도록 설계

## Story Progress Notes

### Agent Model Used: `Claude`

### Change Log

| Change | Date | Version | Description | Author |
| ------ | ---- | ------- | ----------- | ------ |
| Created | 2026-01-06 | 0.1.0 | 초기 스토리 생성 | SM Agent |
