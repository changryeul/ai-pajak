# Story 3.3: 제출 준비 완료 기능

Status: ready-for-dev

## Story

As a **Tax Advisor**,
I want 승인된 세금 케이스를 제출 준비 완료 상태로 변경하도록,
So that 수동 제출할 건을 쉽게 파악할 수 있습니다.

## Acceptance Criteria

1. **Given** APPROVED 상태의 세금 케이스가 있을 때
   **When** "제출 준비 완료" 버튼을 클릭하면
   **Then** POA 유효성이 먼저 확인됩니다

2. **Given** POA가 유효할 때
   **When** 제출 준비 프로세스가 실행되면
   **Then** SPT 제출 데이터가 생성 및 검증됩니다

3. **Given** SPT 데이터 생성이 성공할 때
   **When** 검증이 통과하면
   **Then** 케이스 상태가 READY_TO_FILE로 변경됩니다

4. **Given** 제출 준비가 완료될 때
   **When** UI가 업데이트되면
   **Then** Operator Helper 데이터가 표시됩니다

5. **Given** 제출 준비 프로세스가 완료/실패할 때
   **When** 결과가 반환되면
   **Then** 성공/실패 Toast 알림이 표시됩니다

## Tasks / Subtasks

- [ ] Task 1: SubmissionPrepService 생성 - 통합 워크플로우 (AC: #1, #2, #3)
  - [ ] 1.1: `apps/api/src/submission-prep/submission-prep.service.ts` 생성
  - [ ] 1.2: `prepareForSubmission(taxCaseId, userId)` 메인 메서드
  - [ ] 1.3: APPROVED 상태 검증 로직
  - [ ] 1.4: POA 유효성 검증 호출 (PoaValidationService)
  - [ ] 1.5: SptGeneratorService.generate() 호출
  - [ ] 1.6: OperatorHelperService.format() 호출
  - [ ] 1.7: WorkflowRepository를 통한 READY_TO_FILE 상태 전이
  - [ ] 1.8: 트랜잭션 처리 (Prisma $transaction)

- [ ] Task 2: POA 검증 서비스 기본 구현 (AC: #1)
  - [ ] 2.1: `apps/api/src/poa/poa.module.ts` 생성
  - [ ] 2.2: `apps/api/src/poa/poa-validation.service.ts` 생성
  - [ ] 2.3: `validate(customerId)` - POA 만료일 확인
  - [ ] 2.4: `isExpired(poaId)` - 만료 여부 체크
  - [ ] 2.5: POA 없는 경우 예외 처리
  - [ ] 2.6: `app.module.ts`에 PoaModule 등록

- [ ] Task 3: Workflow 상태 전이 확장 (AC: #3)
  - [ ] 3.1: `WorkflowStage` enum에 `READY_TO_FILE` 확인 (이미 있으면 스킵)
  - [ ] 3.2: `workflow-actions.ts`에 READY_TO_FILE 액션 추가
  - [ ] 3.3: `ReviewWorkflowService`에 `moveToReadyToFile(taxCaseId)` 메서드 추가
  - [ ] 3.4: APPROVED → READY_TO_FILE 전이 규칙 추가

- [ ] Task 4: Controller 엔드포인트 (AC: #1, #2, #3)
  - [ ] 4.1: `POST /api/submission-prep/:taxCaseId/prepare` 엔드포인트
  - [ ] 4.2: `PrepareSubmissionDto` 요청 DTO
  - [ ] 4.3: `PrepareSubmissionResultDto` 응답 DTO (상태, operatorHelperData 포함)
  - [ ] 4.4: Swagger 문서화
  - [ ] 4.5: 권한 검증 (TAX_ADVISOR_JTC 역할)

- [ ] Task 5: 프론트엔드 API 클라이언트 (AC: #4, #5)
  - [ ] 5.1: `apps/web/src/api/submission-prep.api.ts` 확장
  - [ ] 5.2: `prepareForSubmission(taxCaseId)` 함수 추가
  - [ ] 5.3: React Query mutation hook: `usePrepareSubmission`

- [ ] Task 6: TaxCaseDetail 페이지 통합 (AC: #4, #5)
  - [ ] 6.1: `apps/web/src/views/TaxCaseDetail.tsx` 수정
  - [ ] 6.2: APPROVED 상태일 때 "제출 준비 완료" 버튼 표시
  - [ ] 6.3: 버튼 클릭 시 `prepareForSubmission` API 호출
  - [ ] 6.4: 로딩 상태 표시 (스피너)
  - [ ] 6.5: 성공 시 OperatorHelperPanel 표시
  - [ ] 6.6: 성공/실패 Toast 알림

- [ ] Task 7: PrepareSubmissionButton 컴포넌트 (AC: #4, #5)
  - [ ] 7.1: `apps/web/src/components/filing/PrepareSubmissionButton.tsx` 생성
  - [ ] 7.2: APPROVED 상태 검증
  - [ ] 7.3: 확인 다이얼로그 (POA 검증 안내)
  - [ ] 7.4: 로딩/성공/실패 상태 UI
  - [ ] 7.5: sonner Toast 통합

- [ ] Task 8: 단위 테스트 (AC: 전체)
  - [ ] 8.1: `submission-prep.service.spec.ts` - 통합 워크플로우 테스트
  - [ ] 8.2: POA 유효 → 성공 케이스
  - [ ] 8.3: POA 만료 → 실패 케이스
  - [ ] 8.4: SPT 검증 실패 → 실패 케이스
  - [ ] 8.5: 상태 전이 테스트 (APPROVED → READY_TO_FILE)
  - [ ] 8.6: `poa-validation.service.spec.ts` - POA 검증 테스트

## Dev Notes

### Architecture Compliance

**프로젝트 구조 - 신규/수정 파일:**
```
apps/api/src/
├── submission-prep/
│   ├── submission-prep.module.ts           # 수정 (imports 추가)
│   ├── submission-prep.controller.ts       # 수정 (엔드포인트 추가)
│   ├── submission-prep.service.ts          # 신규 - 통합 워크플로우
│   ├── spt-generator.service.ts            # 기존 (Story 3-1)
│   ├── operator-helper.service.ts          # 기존 (Story 3-2)
│   └── dto/
│       ├── prepare-submission.dto.ts       # 신규
│       └── prepare-submission-result.dto.ts # 신규
│
├── poa/                                     # 신규 모듈
│   ├── poa.module.ts
│   └── poa-validation.service.ts
│
├── taxcase/
│   ├── review-workflow.service.ts          # 수정 (READY_TO_FILE 전이)
│   └── utils/
│       └── workflow-actions.ts             # 수정 (READY_TO_FILE 액션)

apps/web/src/
├── api/
│   └── submission-prep.api.ts              # 수정 (prepareForSubmission 추가)
├── views/
│   └── TaxCaseDetail.tsx                   # 수정 (버튼 및 패널 통합)
├── components/
│   └── filing/
│       ├── PrepareSubmissionButton.tsx     # 신규
│       └── OperatorHelperPanel.tsx         # 기존 (Story 3-2)
└── hooks/
    └── usePrepareSubmission.ts             # 신규
```

**아키텍처 문서 참조:**
- [Source: architecture.md#Process Patterns - 제출 준비 처리 패턴]
- [Source: architecture.md#API & Communication Patterns]
- [Source: architecture.md#Authentication & Security - Authorization]

### Technical Requirements

**통합 워크플로우 흐름:**
```
┌─────────────────────────────────────────────────────────────┐
│                    prepareForSubmission()                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. ┌─────────────┐    2. ┌─────────────┐                   │
│     │ Check Stage │───────│ Validate    │                   │
│     │ (APPROVED)  │       │ POA         │                   │
│     └─────────────┘       └──────┬──────┘                   │
│                                  │                          │
│                           POA Valid?                        │
│                          /         \                        │
│                        Yes          No                      │
│                        │            │                       │
│                        ▼            ▼                       │
│  3. ┌─────────────┐    ┌─────────────────┐                 │
│     │ Generate    │    │ Throw           │                 │
│     │ SPT Data    │    │ BadRequestError │                 │
│     └──────┬──────┘    └─────────────────┘                 │
│            │                                                │
│     Validation?                                             │
│    /         \                                              │
│  Pass        Fail                                           │
│   │            │                                            │
│   ▼            ▼                                            │
│  4. ┌─────────────┐    ┌─────────────────┐                 │
│     │ Format      │    │ Return          │                 │
│     │ Operator    │    │ Validation Err  │                 │
│     │ Helper      │    └─────────────────┘                 │
│     └──────┬──────┘                                        │
│            │                                                │
│            ▼                                                │
│  5. ┌─────────────┐                                        │
│     │ Update      │                                        │
│     │ Status to   │                                        │
│     │ READY_TO_   │                                        │
│     │ FILE        │                                        │
│     └──────┬──────┘                                        │
│            │                                                │
│            ▼                                                │
│  6. ┌─────────────┐                                        │
│     │ Return      │                                        │
│     │ Success +   │                                        │
│     │ Operator    │                                        │
│     │ Helper Data │                                        │
│     └─────────────┘                                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**SubmissionPrepService 구현:**
```typescript
// apps/api/src/submission-prep/submission-prep.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { WorkflowStage, SubmissionPrepStatus } from '@prisma/client';

import { TaxCaseRepository } from '../repository/repositories/taxcase.repository';
import { WorkflowRepository } from '../repository/repositories/workflow.repository';
import { SubmissionPrepRepository } from '../repository/repositories/submission-prep.repository';
import { AuditLogRepository } from '../repository/repositories/audit-log.repository';
import { PrismaService } from '../repository/prisma.service';

import { SptGeneratorService } from './spt-generator.service';
import { OperatorHelperService } from './operator-helper.service';
import { PoaValidationService } from '../poa/poa-validation.service';

import { PrepareSubmissionResultDto } from './dto/prepare-submission-result.dto';

@Injectable()
export class SubmissionPrepService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taxCaseRepo: TaxCaseRepository,
    private readonly workflowRepo: WorkflowRepository,
    private readonly submissionPrepRepo: SubmissionPrepRepository,
    private readonly auditLogRepo: AuditLogRepository,
    private readonly sptGeneratorService: SptGeneratorService,
    private readonly operatorHelperService: OperatorHelperService,
    private readonly poaValidationService: PoaValidationService,
  ) {}

  async prepareForSubmission(
    taxCaseId: bigint,
    userId: bigint,
  ): Promise<PrepareSubmissionResultDto> {
    // 1. TaxCase 조회 및 APPROVED 상태 확인
    const taxCase = await this.taxCaseRepo.findById(taxCaseId);
    if (!taxCase) {
      throw new NotFoundException('Tax case not found');
    }

    const workflow = await this.workflowRepo.findByTaxCaseId(taxCaseId);
    if (!workflow || workflow.stage !== WorkflowStage.APPROVED) {
      throw new BadRequestException(
        `Tax case must be in APPROVED stage. Current: ${workflow?.stage}`,
      );
    }

    // 2. POA 유효성 검증
    const poaValidation = await this.poaValidationService.validate(taxCase.companyId);
    if (!poaValidation.isValid) {
      throw new BadRequestException({
        code: 'POA_INVALID',
        message: poaValidation.reason || 'POA is expired or invalid',
        expiryDate: poaValidation.expiryDate,
      });
    }

    // 트랜잭션으로 처리
    return this.prisma.$transaction(async (tx) => {
      // 3. SPT 데이터 생성
      const sptResult = await this.sptGeneratorService.generate(taxCaseId, userId);

      if (sptResult.status === SubmissionPrepStatus.VALIDATION_FAILED) {
        // 검증 실패 시 상태는 유지하고 에러 반환
        return {
          success: false,
          taxCaseId: taxCaseId.toString(),
          status: SubmissionPrepStatus.VALIDATION_FAILED,
          validationErrors: sptResult.validationResult.errors,
          operatorHelperData: null,
        };
      }

      // 4. Operator Helper 데이터 생성
      const operatorHelperData = await this.operatorHelperService.format(taxCaseId);

      // 5. 상태를 READY_TO_FILE로 업데이트
      await this.workflowRepo.updateStage(taxCaseId, WorkflowStage.READY_TO_FILE);

      // 6. SubmissionPrep 상태 업데이트
      await this.submissionPrepRepo.update(taxCaseId, {
        status: SubmissionPrepStatus.READY_TO_FILE,
      });

      // 7. Audit Log 기록
      await this.auditLogRepo.create({
        taxCaseId,
        actorId: userId,
        action: 'SUBMISSION_PREPARED',
        details: {
          previousStage: WorkflowStage.APPROVED,
          newStage: WorkflowStage.READY_TO_FILE,
        },
      });

      return {
        success: true,
        taxCaseId: taxCaseId.toString(),
        status: SubmissionPrepStatus.READY_TO_FILE,
        validationErrors: null,
        operatorHelperData,
      };
    });
  }
}
```

**POA 검증 서비스:**
```typescript
// apps/api/src/poa/poa-validation.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../repository/prisma.service';

export interface PoaValidationResult {
  isValid: boolean;
  reason?: string;
  expiryDate?: Date;
  poaId?: bigint;
}

@Injectable()
export class PoaValidationService {
  constructor(private readonly prisma: PrismaService) {}

  async validate(companyId: bigint): Promise<PoaValidationResult> {
    // 회사의 유효한 POA 조회
    const poa = await this.prisma.powerOfAttorney.findFirst({
      where: {
        companyId,
        isActive: true,
      },
      orderBy: {
        expiryDate: 'desc',
      },
    });

    if (!poa) {
      return {
        isValid: false,
        reason: 'No active POA found for this company',
      };
    }

    const now = new Date();
    if (poa.expiryDate < now) {
      return {
        isValid: false,
        reason: 'POA has expired',
        expiryDate: poa.expiryDate,
        poaId: poa.id,
      };
    }

    // 만료 30일 전 경고 (경고만, 유효함)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    return {
      isValid: true,
      expiryDate: poa.expiryDate,
      poaId: poa.id,
      reason: poa.expiryDate < thirtyDaysFromNow
        ? 'POA expires within 30 days'
        : undefined,
    };
  }

  async isExpired(poaId: bigint): Promise<boolean> {
    const poa = await this.prisma.powerOfAttorney.findUnique({
      where: { id: poaId },
    });

    if (!poa) return true;
    return poa.expiryDate < new Date();
  }
}
```

**Workflow Actions 확장:**
```typescript
// apps/api/src/taxcase/utils/workflow-actions.ts (수정)

// READY_TO_FILE 상태 액션 추가
export function getWorkflowActions(stage: WorkflowStage): WorkflowAction[] {
  switch (stage) {
    // ... 기존 케이스들 ...

    case WorkflowStage.APPROVED:
      return [
        {
          action: 'prepare-submission',
          label: 'Prepare for Submission',
          labelKo: '제출 준비 완료',
          nextStage: WorkflowStage.READY_TO_FILE,
        },
      ];

    case WorkflowStage.READY_TO_FILE:
      return [
        {
          action: 'mark-submitted',
          label: 'Mark as Submitted',
          labelKo: '수동 제출 완료',
          nextStage: WorkflowStage.FILED,
        },
      ];

    case WorkflowStage.FILED:
      return []; // Terminal state

    default:
      return [];
  }
}
```

**DTOs:**
```typescript
// apps/api/src/submission-prep/dto/prepare-submission.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean } from 'class-validator';

export class PrepareSubmissionDto {
  @ApiPropertyOptional({ description: 'Skip POA validation (for testing)' })
  @IsOptional()
  @IsBoolean()
  skipPoaValidation?: boolean;
}

// apps/api/src/submission-prep/dto/prepare-submission-result.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SubmissionPrepStatus } from '@prisma/client';
import { OperatorHelperData } from '../types/operator-helper.types';

export class PrepareSubmissionResultDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  taxCaseId: string;

  @ApiProperty({ enum: SubmissionPrepStatus })
  status: SubmissionPrepStatus;

  @ApiPropertyOptional()
  validationErrors?: any[];

  @ApiPropertyOptional()
  operatorHelperData?: OperatorHelperData | null;
}
```

**Controller 확장:**
```typescript
// apps/api/src/submission-prep/submission-prep.controller.ts (추가)

@Post(':taxCaseId/prepare')
@ApiOperation({ summary: '제출 준비 완료 - POA 검증 후 SPT 생성 및 상태 전이' })
@ApiResponse({ status: 200, type: PrepareSubmissionResultDto })
@ApiResponse({ status: 400, description: 'POA 만료 또는 검증 실패' })
@UseGuards(AuthGuard, RolesGuard)
@Roles('TAX_ADVISOR_JTC')
async prepareForSubmission(
  @Param('taxCaseId') taxCaseId: string,
  @Body() dto: PrepareSubmissionDto,
  @CurrentUser() user: { id: bigint },
): Promise<PrepareSubmissionResultDto> {
  return this.submissionPrepService.prepareForSubmission(
    BigInt(taxCaseId),
    user.id,
  );
}
```

**프론트엔드 Hook:**
```typescript
// apps/web/src/hooks/usePrepareSubmission.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { prepareForSubmission } from '@/api/submission-prep.api';
import { toast } from 'sonner';

export function usePrepareSubmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taxCaseId: string) => prepareForSubmission(taxCaseId),
    onSuccess: (data) => {
      if (data.success) {
        toast.success('제출 준비가 완료되었습니다');
        queryClient.invalidateQueries({ queryKey: ['taxCase'] });
      } else {
        toast.error('데이터 검증에 실패했습니다', {
          description: '상세 오류를 확인하세요',
        });
      }
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || '제출 준비에 실패했습니다';
      if (error.response?.data?.code === 'POA_INVALID') {
        toast.error('POA가 만료되었습니다', {
          description: message,
        });
      } else {
        toast.error(message);
      }
    },
  });
}
```

**PrepareSubmissionButton 컴포넌트:**
```tsx
// apps/web/src/components/filing/PrepareSubmissionButton.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { FileCheck, Loader2 } from 'lucide-react';
import { usePrepareSubmission } from '@/hooks/usePrepareSubmission';

interface PrepareSubmissionButtonProps {
  taxCaseId: string;
  disabled?: boolean;
  onSuccess?: (data: any) => void;
}

export function PrepareSubmissionButton({
  taxCaseId,
  disabled,
  onSuccess,
}: PrepareSubmissionButtonProps) {
  const [open, setOpen] = useState(false);
  const { mutate, isPending } = usePrepareSubmission();

  const handleConfirm = () => {
    mutate(taxCaseId, {
      onSuccess: (data) => {
        setOpen(false);
        onSuccess?.(data);
      },
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button disabled={disabled || isPending}>
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <FileCheck className="h-4 w-4 mr-2" />
          )}
          제출 준비 완료
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>제출 준비를 진행하시겠습니까?</AlertDialogTitle>
          <AlertDialogDescription>
            다음 작업이 수행됩니다:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>POA (위임장) 유효성 확인</li>
              <li>SPT 제출 데이터 생성 및 검증</li>
              <li>Operator Helper 데이터 생성</li>
              <li>케이스 상태 변경 (READY_TO_FILE)</li>
            </ul>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>취소</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={isPending}>
            {isPending ? '처리 중...' : '확인'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/submission-prep/:taxCaseId/prepare` | 제출 준비 완료 (POA 검증 → SPT 생성 → 상태 전이) |

### Dependencies

**Story 3-1 의존성:**
- `SptGeneratorService` - SPT 데이터 생성
- `SubmissionPrepRepository` - 데이터 접근

**Story 3-2 의존성:**
- `OperatorHelperService` - Operator Helper 포맷팅
- `OperatorHelperPanel` - UI 컴포넌트

**신규 의존성:**
- `PoaValidationService` - POA 검증 (신규 모듈)
- `ReviewWorkflowService` - 상태 전이 (확장)

**기존 모듈:**
- `TaxCaseRepository` - TaxCase 조회
- `WorkflowRepository` - Workflow 상태 관리
- `AuditLogRepository` - 감사 로그

### Prisma Schema 확인

**WorkflowStage enum (확인 필요):**
```prisma
enum WorkflowStage {
  UPLOADED
  AI_ANALYZED
  HUMAN_REVIEW
  APPROVED
  READY_TO_FILE   // 이 값이 없으면 마이그레이션 필요
  FILED
}
```

**PowerOfAttorney 모델 (기존):**
```prisma
model PowerOfAttorney {
  id          BigInt    @id @default(autoincrement())
  companyId   BigInt
  expiryDate  DateTime
  isActive    Boolean   @default(true)
  // ...
}
```

### Out of Scope

- 수동 제출 완료 확인 (Story 3.4)
- 제출 상태 조회 UI (Story 3.5)
- 일괄 제출 준비 (Epic 4)
- POA 만료 알림 (Epic 8)

### Testing Considerations

**단위 테스트 케이스:**
1. APPROVED 상태 → 제출 준비 성공
2. APPROVED 아닌 상태 → BadRequestException
3. POA 유효 → 성공 진행
4. POA 만료 → BadRequestException (POA_INVALID)
5. POA 없음 → BadRequestException
6. SPT 검증 실패 → VALIDATION_FAILED 상태 반환
7. 상태 전이 → APPROVED → READY_TO_FILE
8. Audit Log 기록 확인

**통합 테스트:**
1. 전체 워크플로우 E2E 테스트
2. 트랜잭션 롤백 테스트 (중간 실패 시)

### Previous Story Intelligence

**Story 3-1 학습:**
- `SptGeneratorService` 구조 및 호출 방식
- `SubmissionPrepRepository` 메서드
- 상태 기반 비즈니스 로직 검증

**Story 3-2 학습:**
- `OperatorHelperService.format()` 호출
- 프론트엔드 컴포넌트 통합 방식
- Toast 알림 패턴 (sonner)

### Git Intelligence

**관련 파일 패턴:**
- `apps/api/src/taxcase/review-workflow.service.ts` - 상태 전이 로직
- `apps/api/src/taxcase/utils/workflow-actions.ts` - 액션 정의

### References

- Epic 3: 단일 케이스 제출 준비 [Source: epics.md#Epic 3]
- PRD FR-1.1: SPT 제출 데이터 준비 [Source: prd.md#FR-1]
- Architecture: Process Patterns [Source: architecture.md#Process Patterns]
- Story 3-1: SPT 제출 데이터 생성 서비스 [Source: 3-1-spt-submission-data-generation.md]
- Story 3-2: Operator Helper 데이터 포맷팅 [Source: 3-2-operator-helper-formatting.md]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

