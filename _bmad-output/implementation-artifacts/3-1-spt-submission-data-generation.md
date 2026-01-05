# Story 3.1: SPT 제출 데이터 생성 서비스

Status: draft

## Story

As a **Developer**,
I want SPT 제출 데이터 생성 서비스가 구현되도록,
So that 수동 제출에 필요한 모든 데이터를 자동 생성할 수 있습니다.

## Acceptance Criteria

1. **Given** APPROVED 상태의 세금 케이스가 있을 때
   **When** SptGeneratorService.generate()를 호출하면
   **Then** PPh 21, PPh 23, PPh Final, PPN 제출 데이터가 생성됩니다

2. **Given** SPT 데이터가 생성될 때
   **When** 데이터가 처리되면
   **Then** 데이터 유효성 검증이 수행됩니다

3. **Given** 유효성 검증이 실패할 때
   **When** 오류가 발생하면
   **Then** 검증 실패 시 상세 오류 메시지가 반환됩니다

4. **Given** SPT 데이터 생성이 성공할 때
   **When** 데이터가 저장되면
   **Then** 생성된 데이터가 submission_prep 테이블에 저장됩니다

## Tasks / Subtasks

- [ ] Task 1: SubmissionPrep Repository 생성 (AC: #4)
  - [ ] 1.1: `apps/api/src/repository/repositories/submission-prep.repository.ts` 생성
  - [ ] 1.2: `create(data)` 메서드 - SubmissionPrep 레코드 생성
  - [ ] 1.3: `findByTaxCaseId(taxCaseId)` 메서드
  - [ ] 1.4: `update(taxCaseId, data)` 메서드 - sptData, status 업데이트
  - [ ] 1.5: `repository.module.ts`에 provider 등록

- [ ] Task 2: SPT 데이터 타입 및 인터페이스 정의 (AC: #1, #2)
  - [ ] 2.1: `apps/api/src/submission-prep/types/spt-data.types.ts` 생성
  - [ ] 2.2: `SptPph21Data` 인터페이스 정의 (급여, 공제, 세액 필드)
  - [ ] 2.3: `SptPph23Data` 인터페이스 정의 (서비스 대가, 원천징수 필드)
  - [ ] 2.4: `SptVatData` 인터페이스 정의 (매출/매입 세금계산서 필드)
  - [ ] 2.5: `SptAnnualData` 인터페이스 정의 (연간 종합 필드)
  - [ ] 2.6: `SptData` 통합 유니온 타입 정의

- [ ] Task 3: 유효성 검증 로직 구현 (AC: #2, #3)
  - [ ] 3.1: `apps/api/src/submission-prep/validators/spt-validator.ts` 생성
  - [ ] 3.2: `SptValidationResult` 인터페이스 (isValid, errors, warnings)
  - [ ] 3.3: `validatePph21(data)` 검증 함수 (필수 필드, 계산 정합성)
  - [ ] 3.4: `validatePph23(data)` 검증 함수
  - [ ] 3.5: `validateVat(data)` 검증 함수 (매출/매입 균형)
  - [ ] 3.6: `validateAnnual(data)` 검증 함수
  - [ ] 3.7: `validateSptData(taxType, data)` 라우터 함수

- [ ] Task 4: SptGeneratorService 구현 (AC: #1, #2, #3, #4)
  - [ ] 4.1: `apps/api/src/submission-prep/spt-generator.service.ts` 생성
  - [ ] 4.2: Repository, TaxCaseRepository, WorkflowRepository 주입
  - [ ] 4.3: `generate(taxCaseId)` 메서드 - 메인 생성 로직
  - [ ] 4.4: APPROVED 상태 검증 로직
  - [ ] 4.5: `generatePph21Data(taxCase)` - PPh 21 데이터 생성
  - [ ] 4.6: `generatePph23Data(taxCase)` - PPh 23 데이터 생성
  - [ ] 4.7: `generateVatData(taxCase)` - PPN 데이터 생성
  - [ ] 4.8: `generateAnnualData(taxCase)` - 연간 데이터 생성
  - [ ] 4.9: 유효성 검증 호출 및 결과 처리
  - [ ] 4.10: SubmissionPrep 레코드 저장 (status: GENERATED 또는 VALIDATION_FAILED)

- [ ] Task 5: DTOs 정의 (AC: #1, #3)
  - [ ] 5.1: `apps/api/src/submission-prep/dto/generate-spt.dto.ts` - 요청 DTO
  - [ ] 5.2: `apps/api/src/submission-prep/dto/spt-result.dto.ts` - 응답 DTO
  - [ ] 5.3: `apps/api/src/submission-prep/dto/validation-error.dto.ts` - 검증 오류 DTO
  - [ ] 5.4: `apps/api/src/submission-prep/dto/index.ts` - barrel export

- [ ] Task 6: SubmissionPrep 모듈 생성 (AC: 전체)
  - [ ] 6.1: `apps/api/src/submission-prep/submission-prep.module.ts` 생성
  - [ ] 6.2: SptGeneratorService provider 등록
  - [ ] 6.3: RepositoryModule import
  - [ ] 6.4: `app.module.ts`에 SubmissionPrepModule 등록

- [ ] Task 7: SubmissionPrep Controller 생성 (AC: #1, #3)
  - [ ] 7.1: `apps/api/src/submission-prep/submission-prep.controller.ts` 생성
  - [ ] 7.2: `POST /api/submission-prep/:taxCaseId/generate` 엔드포인트
  - [ ] 7.3: `GET /api/submission-prep/:taxCaseId` 조회 엔드포인트
  - [ ] 7.4: Swagger 문서화 (@ApiTags, @ApiOperation, @ApiResponse)
  - [ ] 7.5: 에러 핸들링 (NotFoundException, BadRequestException)

- [ ] Task 8: 단위 테스트 작성 (AC: 전체)
  - [ ] 8.1: `spt-generator.service.spec.ts` - 생성 로직 테스트
  - [ ] 8.2: `spt-validator.spec.ts` - 검증 로직 테스트
  - [ ] 8.3: `submission-prep.controller.spec.ts` - 컨트롤러 테스트
  - [ ] 8.4: 각 세금 유형별 테스트 케이스 (PPh21, PPh23, VAT, Annual)
  - [ ] 8.5: 검증 실패 케이스 테스트

## Dev Notes

### Architecture Compliance

**프로젝트 구조 - 신규 파일:**
```
apps/api/src/
├── repository/
│   └── repositories/
│       └── submission-prep.repository.ts    # 신규
├── submission-prep/                          # 신규 모듈
│   ├── submission-prep.module.ts
│   ├── submission-prep.controller.ts
│   ├── spt-generator.service.ts
│   ├── dto/
│   │   ├── generate-spt.dto.ts
│   │   ├── spt-result.dto.ts
│   │   ├── validation-error.dto.ts
│   │   └── index.ts
│   ├── types/
│   │   └── spt-data.types.ts
│   └── validators/
│       └── spt-validator.ts
```

**아키텍처 문서 참조:**
- [Source: architecture.md#Backend Architecture: NestJS]
- [Source: architecture.md#API Module Structure]
- [Source: architecture.md#Database Schema - SubmissionPrep]

### Technical Requirements

**세금 유형별 데이터 구조 (Prisma Schema 기반):**
```typescript
// TaxType enum (prisma/schema.prisma)
enum TaxType {
  PPh21   // 급여 원천징수
  PPh23   // 서비스 원천징수
  VAT     // 부가가치세 (PPN)
  ANNUAL  // 연간 종합 (PPh Final 포함)
}

// SubmissionPrepStatus enum
enum SubmissionPrepStatus {
  GENERATED          // SPT 데이터 생성됨
  VALIDATED          // 검증 통과
  READY_TO_FILE      // 제출 준비 완료
  MANUALLY_SUBMITTED // 수동 제출 완료
  VALIDATION_FAILED  // 검증 실패
}
```

**SPT 데이터 타입 예시:**
```typescript
// PPh 21 (급여 원천징수)
interface SptPph21Data {
  period: string;                    // 과세 기간 (YYYY-MM)
  employeeCount: number;             // 직원 수
  grossSalary: number;               // 총 급여
  taxableIncome: number;             // 과세 소득
  taxWithheld: number;               // 원천징수 세액
  deductions: {
    jht: number;                     // 고용보험
    pension: number;                 // 연금
    healthInsurance: number;         // 건강보험
  };
  ptkpStatus: string;                // 비과세 기준 (TK/K/K1/K2/K3)
}

// PPh 23 (서비스 원천징수)
interface SptPph23Data {
  period: string;
  transactions: Array<{
    vendorNpwp: string;              // 공급자 NPWP
    vendorName: string;              // 공급자명
    serviceType: string;             // 서비스 유형
    grossAmount: number;             // 총액
    taxRate: number;                 // 세율 (2% 또는 15%)
    taxAmount: number;               // 세액
  }>;
  totalGross: number;
  totalTax: number;
}

// VAT (PPN)
interface SptVatData {
  period: string;
  outputTax: {                       // 매출세
    invoices: Array<{
      fakturNumber: string;          // 세금계산서 번호
      customerNpwp: string;
      customerName: string;
      dpp: number;                   // 과세표준
      ppn: number;                   // 부가세
    }>;
    totalDpp: number;
    totalPpn: number;
  };
  inputTax: {                        // 매입세
    invoices: Array<{
      fakturNumber: string;
      vendorNpwp: string;
      vendorName: string;
      dpp: number;
      ppn: number;
    }>;
    totalDpp: number;
    totalPpn: number;
  };
  netTax: number;                    // 납부/환급 세액
}
```

**유효성 검증 규칙:**
```typescript
interface SptValidationResult {
  isValid: boolean;
  errors: ValidationError[];         // 치명적 오류 (제출 불가)
  warnings: ValidationWarning[];     // 경고 (제출 가능하나 확인 권장)
}

interface ValidationError {
  field: string;                     // 오류 필드
  code: string;                      // 오류 코드 (E001, E002, ...)
  message: string;                   // 상세 메시지
  value?: unknown;                   // 실제 값
}

// 검증 규칙 예시
const PPH21_VALIDATION_RULES = {
  // 필수 필드 검증
  REQUIRED_FIELDS: ['period', 'employeeCount', 'grossSalary', 'taxWithheld'],
  // 계산 정합성 (오차 허용: 1원)
  TAX_CALCULATION_TOLERANCE: 1,
  // PTKP 유효 값
  VALID_PTKP_STATUS: ['TK', 'K', 'K1', 'K2', 'K3'],
};
```

### Code Patterns (기존 코드 참조)

**Repository 패턴 (기존 패턴 따름):**
```typescript
// apps/api/src/repository/repositories/submission-prep.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { SubmissionPrep, SubmissionPrepStatus, Prisma } from '@prisma/client';

@Injectable()
export class SubmissionPrepRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.SubmissionPrepCreateInput): Promise<SubmissionPrep> {
    return this.prisma.submissionPrep.create({ data });
  }

  async findByTaxCaseId(taxCaseId: bigint): Promise<SubmissionPrep | null> {
    return this.prisma.submissionPrep.findUnique({
      where: { taxCaseId },
    });
  }

  async update(
    taxCaseId: bigint,
    data: Prisma.SubmissionPrepUpdateInput,
  ): Promise<SubmissionPrep> {
    return this.prisma.submissionPrep.update({
      where: { taxCaseId },
      data,
    });
  }

  async upsert(
    taxCaseId: bigint,
    data: Omit<Prisma.SubmissionPrepCreateInput, 'taxCase'>,
  ): Promise<SubmissionPrep> {
    return this.prisma.submissionPrep.upsert({
      where: { taxCaseId },
      create: { ...data, taxCase: { connect: { id: taxCaseId } } },
      update: data,
    });
  }
}
```

**Service 패턴 (ReviewWorkflowService 참조):**
```typescript
// apps/api/src/submission-prep/spt-generator.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { WorkflowStage, TaxType, SubmissionPrepStatus } from '@prisma/client';

import { TaxCaseRepository } from '../repository/repositories/taxcase.repository';
import { WorkflowRepository } from '../repository/repositories/workflow.repository';
import { SubmissionPrepRepository } from '../repository/repositories/submission-prep.repository';
import { AuditLogRepository } from '../repository/repositories/audit-log.repository';

import { validateSptData } from './validators/spt-validator';
import { SptData } from './types/spt-data.types';

@Injectable()
export class SptGeneratorService {
  constructor(
    private readonly taxCaseRepo: TaxCaseRepository,
    private readonly workflowRepo: WorkflowRepository,
    private readonly submissionPrepRepo: SubmissionPrepRepository,
    private readonly auditLogRepo: AuditLogRepository,
  ) {}

  async generate(taxCaseId: bigint, userId?: bigint) {
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

    // 2. 세금 유형별 SPT 데이터 생성
    const sptData = await this.generateSptData(taxCase);

    // 3. 유효성 검증
    const validationResult = validateSptData(taxCase.taxType, sptData);

    // 4. SubmissionPrep 저장
    const status = validationResult.isValid
      ? SubmissionPrepStatus.GENERATED
      : SubmissionPrepStatus.VALIDATION_FAILED;

    const submissionPrep = await this.submissionPrepRepo.upsert(taxCaseId, {
      sptData: sptData as any,
      status,
      validationErrors: validationResult.isValid ? null : validationResult.errors,
      preparedByConsultantId: userId,
    });

    // 5. Audit log
    await this.auditLogRepo.create({
      taxCaseId,
      actorId: userId,
      action: validationResult.isValid ? 'SPT_GENERATED' : 'SPT_VALIDATION_FAILED',
    });

    return {
      id: submissionPrep.id.toString(),
      taxCaseId: taxCaseId.toString(),
      status,
      sptData,
      validationResult,
    };
  }

  private async generateSptData(taxCase: { taxType: TaxType; /* ... */ }): Promise<SptData> {
    switch (taxCase.taxType) {
      case TaxType.PPh21:
        return this.generatePph21Data(taxCase);
      case TaxType.PPh23:
        return this.generatePph23Data(taxCase);
      case TaxType.VAT:
        return this.generateVatData(taxCase);
      case TaxType.ANNUAL:
        return this.generateAnnualData(taxCase);
      default:
        throw new BadRequestException(`Unsupported tax type: ${taxCase.taxType}`);
    }
  }

  // 각 세금 유형별 생성 메서드는 AIResult 데이터를 기반으로 구현
}
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/submission-prep/:taxCaseId/generate` | SPT 데이터 생성 |
| GET | `/api/submission-prep/:taxCaseId` | SubmissionPrep 조회 |

### Dependencies

**기존 모듈 의존:**
- `RepositoryModule` - 데이터베이스 접근
- `TaxCaseRepository` - TaxCase 조회
- `WorkflowRepository` - 워크플로우 상태 확인
- `AuditLogRepository` - 감사 로그

**Prisma Schema (이미 정의됨):**
```prisma
model SubmissionPrep {
  id                     BigInt               @id @default(autoincrement())
  taxCaseId              BigInt               @unique
  sptData                Json
  operatorHelperData     Json?
  status                 SubmissionPrepStatus @default(GENERATED)
  validatedAt            DateTime?
  validationErrors       Json?
  preparedByConsultantId BigInt?
  manuallySubmittedAt    DateTime?
  djpReferenceId         String?              @db.VarChar(100)
  createdAt              DateTime             @default(now())

  taxCase    TaxCase @relation(fields: [taxCaseId], references: [id], onDelete: Cascade)
  preparedBy User?   @relation("PreparedSubmissions", fields: [preparedByConsultantId], references: [id], onDelete: SetNull)
}
```

### Out of Scope

- Operator Helper 데이터 포맷팅 (Story 3.2)
- 제출 준비 완료 UI (Story 3.3)
- 수동 제출 완료 기록 (Story 3.4)
- 프론트엔드 UI 구현

### Testing Considerations

**단위 테스트 케이스:**
1. PPh21 데이터 생성 - 정상 케이스
2. PPh23 데이터 생성 - 정상 케이스
3. VAT 데이터 생성 - 정상 케이스
4. ANNUAL 데이터 생성 - 정상 케이스
5. APPROVED 아닌 상태에서 생성 시도 - BadRequestException
6. 존재하지 않는 TaxCase - NotFoundException
7. 유효성 검증 실패 - VALIDATION_FAILED 상태 저장
8. 유효성 검증 성공 - GENERATED 상태 저장

### Learnings from Previous Stories

**Story 2-5 (OCR Review UI) 패턴 적용:**
- Repository 패턴 준수 (PrismaService 주입)
- DTO 기반 요청/응답 구조화
- Swagger 문서화 필수
- 상태 기반 비즈니스 로직 검증

**BigInt 직렬화:**
```typescript
// main.ts에 이미 적용됨
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};
```

## References

- Epic 3: 단일 케이스 제출 준비 (epics.md)
- PRD FR-1.1: SPT 제출 데이터 준비
- Architecture: Backend Architecture, Database Schema
- Prisma Schema: SubmissionPrep, SubmissionPrepStatus
