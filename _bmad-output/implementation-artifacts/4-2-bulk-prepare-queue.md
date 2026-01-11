# Story 4.2: 일괄 제출 준비 처리

Status: ready-for-dev

## Story

- **As a** System
- **I want** 일괄 제출 준비가 Bull Queue로 처리되도록
- **So that** 안정적으로 대량 준비 작업을 처리할 수 있습니다

## Acceptance Criteria (ACs)

### AC 4.2.1: Bull Queue 작업 추가
**Given** 35개 케이스가 일괄 준비 요청될 때
**When** bulk-prepare 큐에 작업이 추가되면
**Then** 각 케이스별로 개별 작업이 생성됩니다

### AC 4.2.2: SPT 데이터 생성
**Given** 일괄 준비 작업이 큐에서 처리될 때
**When** 각 케이스의 SPT 데이터가 생성되면
**Then** PPh 21, PPh 23, PPh Final, PPN 제출 데이터가 생성됩니다

### AC 4.2.3: 데이터 검증
**Given** SPT 데이터가 생성되었을 때
**When** 데이터 검증이 수행되면
**Then** 필수 필드 유효성이 확인됩니다
**And** 검증 실패 시 상세 오류 메시지가 기록됩니다

### AC 4.2.4: 병렬 처리
**Given** 35개 이상의 케이스가 일괄 준비될 때
**When** Bull Queue 프로세서가 실행되면
**Then** 동시 10건 병렬 처리가 적용됩니다

### AC 4.2.5: 상태 변경
**Given** 각 케이스의 SPT 데이터 준비가 완료되었을 때
**When** 작업이 성공하면
**Then** 케이스 상태가 READY_TO_FILE로 변경됩니다
**And** SubmissionPrep 레코드가 생성됩니다

## Technical Notes

### Architecture Context

이 스토리는 Epic 4 (일괄 제출 준비 및 체크리스트)의 두 번째 스토리입니다.
**FRs covered:** FR-1.4 (일괄 제출 준비 - 35+ 고객 제출 데이터 일괄 준비)

**Epic 4 스토리 시퀀스:**
1. Story 4-1: 일괄 선택 UI - BulkPreparePanel ✅ (ready-for-dev)
2. **Story 4-2** (현재): 일괄 제출 준비 처리 (Bull Queue)
3. Story 4-3: 일괄 준비 진행률 표시
4. Story 4-4: 마감일별 제출 체크리스트
5. Story 4-5: 제출 준비 데이터 일괄 내보내기

### Key Components

1. **Backend (NestJS)**
   - `SubmissionPrepModule` - 제출 준비 자동화 모듈
   - `BulkPrepareProcessor` - Bull Queue 프로세서 (동시 10건 처리)
   - `SptGeneratorService` - SPT 데이터 생성 서비스
   - `SubmissionPrepController` - REST API 컨트롤러
   - `SubmissionPrepRepository` - 데이터 접근 레이어

2. **Queue Configuration**
   - `bulk-prepare` 큐 등록 (QueueModule)
   - 동시성: 10 (concurrency)
   - 재시도: 3회 (exponential backoff)

3. **API Endpoints**
   - `POST /api/submission-prep/bulk-prepare` - 일괄 준비 시작
   - `GET /api/submission-prep/bulk-status/:batchId` - 일괄 준비 상태 조회

### Database Context

**사용할 테이블:**
```typescript
// SubmissionPrep (Phase 2에서 이미 정의됨)
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
  djpReferenceId         String?
  createdAt              DateTime             @default(now())
}

enum SubmissionPrepStatus {
  GENERATED
  VALIDATED
  READY_TO_FILE
  MANUALLY_SUBMITTED
  VALIDATION_FAILED
}

// WorkflowState 상태 추가 필요: READY_TO_FILE
// 현재 enum에 없으므로 APPROVED 상태를 유지하고 SubmissionPrep.status로 관리
```

### Workflow Context

```
Story 4-1: UI에서 케이스 선택
        ↓
"일괄 제출 준비" 버튼 클릭
        ↓
POST /api/submission-prep/bulk-prepare
        ↓
Bull Queue에 작업 추가 (배치 ID 반환)
        ↓
BulkPrepareProcessor가 각 케이스 처리
        ↓
SptGeneratorService.generate(taxCaseId)
        ↓
데이터 검증
        ↓
SubmissionPrep 레코드 저장
        ↓
Story 4-3: 진행률 UI 업데이트
```

### API Endpoints

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| POST | `/api/submission-prep/bulk-prepare` | 일괄 준비 시작 | 신규 |
| GET | `/api/submission-prep/bulk-status/:batchId` | 일괄 준비 상태 조회 | 신규 |
| GET | `/api/submission-prep/:taxCaseId` | 개별 준비 상태 조회 | 신규 |

## Tasks

### Task 1: SubmissionPrep Repository 생성 (AC: #2, #5)
- [ ] Subtask 1.1: `apps/api/src/repository/repositories/submission-prep.repository.ts` 생성
- [ ] Subtask 1.2: `findByTaxCaseId(taxCaseId)` 메서드 구현
- [ ] Subtask 1.3: `create(data)` 메서드 구현
- [ ] Subtask 1.4: `updateStatus(id, status)` 메서드 구현
- [ ] Subtask 1.5: `findByBatchId(batchId)` 메서드 구현 (일괄 조회)
- [ ] Subtask 1.6: `repository.module.ts`에 export 추가

### Task 2: SptGeneratorService 구현 (AC: #2, #3)
- [ ] Subtask 2.1: `apps/api/src/submission-prep/spt-generator.service.ts` 생성
- [ ] Subtask 2.2: `generate(taxCaseId)` 메서드 구현 - PPh21 데이터 생성
- [ ] Subtask 2.3: `generate(taxCaseId)` 메서드 확장 - PPh23 데이터 생성
- [ ] Subtask 2.4: `generate(taxCaseId)` 메서드 확장 - VAT 데이터 생성
- [ ] Subtask 2.5: `validateSptData(sptData)` 메서드 구현
- [ ] Subtask 2.6: `formatForOperatorHelper(sptData)` 메서드 구현
- [ ] Subtask 2.7: 검증 오류 상세 메시지 정의

### Task 3: Bull Queue 설정 (AC: #1, #4)
- [ ] Subtask 3.1: `apps/api/src/queue/queue.module.ts` 수정 - `bulk-prepare` 큐 등록
- [ ] Subtask 3.2: `apps/api/src/queue/bulk-prepare.processor.ts` 생성
- [ ] Subtask 3.3: 동시성 10 설정 (`concurrency: 10`)
- [ ] Subtask 3.4: 재시도 로직 구현 (3회, exponential backoff)
- [ ] Subtask 3.5: 작업 완료 콜백 구현
- [ ] Subtask 3.6: 작업 실패 콜백 구현

### Task 4: SubmissionPrepModule 생성 (AC: 전체)
- [ ] Subtask 4.1: `apps/api/src/submission-prep/submission-prep.module.ts` 생성
- [ ] Subtask 4.2: RepositoryModule, QueueModule 임포트
- [ ] Subtask 4.3: SptGeneratorService 프로바이더 등록
- [ ] Subtask 4.4: BulkPrepareProcessor 프로바이더 등록
- [ ] Subtask 4.5: `app.module.ts`에 SubmissionPrepModule 임포트

### Task 5: SubmissionPrepController 구현 (AC: #1)
- [ ] Subtask 5.1: `apps/api/src/submission-prep/submission-prep.controller.ts` 생성
- [ ] Subtask 5.2: `POST /bulk-prepare` 엔드포인트 구현
- [ ] Subtask 5.3: `GET /bulk-status/:batchId` 엔드포인트 구현
- [ ] Subtask 5.4: `GET /:taxCaseId` 엔드포인트 구현
- [ ] Subtask 5.5: Swagger 문서화 추가

### Task 6: DTO 정의 (AC: 전체)
- [ ] Subtask 6.1: `apps/api/src/submission-prep/dto/bulk-prepare.dto.ts` 생성
- [ ] Subtask 6.2: `BulkPrepareRequestDto` 정의 (taxCaseIds, consultantId)
- [ ] Subtask 6.3: `BulkPrepareResponseDto` 정의 (batchId, totalCount)
- [ ] Subtask 6.4: `BulkStatusResponseDto` 정의 (진행률, 성공/실패 건수)
- [ ] Subtask 6.5: `SptDataDto` 정의 (SPT 데이터 구조)

### Task 7: 상태 변경 로직 (AC: #5)
- [ ] Subtask 7.1: TaxCase 상태 업데이트 로직 구현 (APPROVED 유지)
- [ ] Subtask 7.2: SubmissionPrep 상태 READY_TO_FILE로 변경
- [ ] Subtask 7.3: Audit Log 기록 추가
- [ ] Subtask 7.4: 트랜잭션 처리

### Task 8: 프론트엔드 API 클라이언트 (AC: #1)
- [ ] Subtask 8.1: `apps/web/src/api/submission-prep.api.ts` 생성
- [ ] Subtask 8.2: `bulkPrepare(taxCaseIds)` 함수 구현
- [ ] Subtask 8.3: `getBulkStatus(batchId)` 함수 구현
- [ ] Subtask 8.4: Story 4-1의 `BulkPrepareButton` 연결

### Task 9: 단위 테스트 (AC: 전체)
- [ ] Subtask 9.1: `spt-generator.service.spec.ts` - SPT 데이터 생성 테스트
- [ ] Subtask 9.2: `bulk-prepare.processor.spec.ts` - 프로세서 테스트
- [ ] Subtask 9.3: `submission-prep.controller.spec.ts` - API 테스트
- [ ] Subtask 9.4: 검증 실패 케이스 테스트
- [ ] Subtask 9.5: 병렬 처리 테스트

## Dev Notes

### Architecture Compliance

**프로젝트 구조 - 신규/수정 파일:**
```
apps/api/src/
├── repository/
│   └── repositories/
│       ├── submission-prep.repository.ts  # 신규 (Task 1)
│       └── index.ts                       # 수정 - export 추가
├── submission-prep/                       # 신규 디렉토리
│   ├── submission-prep.module.ts          # 신규 (Task 4)
│   ├── submission-prep.controller.ts      # 신규 (Task 5)
│   ├── spt-generator.service.ts           # 신규 (Task 2)
│   ├── dto/
│   │   ├── bulk-prepare.dto.ts            # 신규 (Task 6)
│   │   └── spt-data.dto.ts                # 신규 (Task 6)
│   └── types/
│       └── submission-prep.types.ts       # 신규
├── queue/
│   ├── queue.module.ts                    # 수정 - bulk-prepare 큐 추가
│   └── bulk-prepare.processor.ts          # 신규 (Task 3)
└── app.module.ts                          # 수정 - SubmissionPrepModule 추가

apps/web/src/
├── api/
│   └── submission-prep.api.ts             # 신규 (Task 8)
└── components/filing/
    └── BulkPrepareButton.tsx              # 수정 - API 연결
```

**아키텍처 문서 참조:**
- [Source: architecture.md#Implementation Patterns - 제출 준비 처리 패턴]
- [Source: architecture.md#API & Communication Patterns - Queue System: Bull (Redis)]
- [Source: architecture.md#Project Structure - submission-prep 모듈]

### Code Patterns

**QueueModule 수정:**
```typescript
// apps/api/src/queue/queue.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TestQueueProcessor } from './test-queue.processor';
import { TestQueueService } from './test-queue.service';
import { QueueController } from './queue.controller';
// 신규 추가
import { BulkPrepareProcessor } from './bulk-prepare.processor';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      { name: 'test-queue' },
      { name: 'ocr-processing' },
      { name: 'bulk-prepare' }, // 신규 추가
    ),
  ],
  controllers: [QueueController],
  providers: [TestQueueProcessor, TestQueueService, BulkPrepareProcessor],
  exports: [BullModule, TestQueueService],
})
export class QueueModule {}
```

**BulkPrepareProcessor 구현:**
```typescript
// apps/api/src/queue/bulk-prepare.processor.ts
import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bull';
import { SptGeneratorService } from '../submission-prep/spt-generator.service';
import { SubmissionPrepRepository } from '../repository/repositories/submission-prep.repository';
import { TaxCaseRepository } from '../repository/repositories/taxcase.repository';
import { AuditLogRepository } from '../repository/repositories/audit-log.repository';

interface BulkPrepareJobData {
  taxCaseId: bigint;
  consultantId: bigint;
  batchId: string;
}

@Injectable()
@Processor('bulk-prepare')
export class BulkPrepareProcessor {
  private readonly logger = new Logger(BulkPrepareProcessor.name);

  constructor(
    private readonly sptGeneratorService: SptGeneratorService,
    private readonly submissionPrepRepository: SubmissionPrepRepository,
    private readonly taxCaseRepository: TaxCaseRepository,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  @Process({ concurrency: 10 })
  async handleBulkPrepare(job: Job<BulkPrepareJobData>) {
    const { taxCaseId, consultantId, batchId } = job.data;
    this.logger.log(`Processing bulk prepare for taxCaseId: ${taxCaseId}, batch: ${batchId}`);

    try {
      // 1. TaxCase 조회 및 상태 확인
      const taxCase = await this.taxCaseRepository.findById(taxCaseId);
      if (!taxCase) {
        throw new Error(`TaxCase not found: ${taxCaseId}`);
      }

      // 2. SPT 데이터 생성
      const sptData = await this.sptGeneratorService.generate(taxCaseId);

      // 3. 데이터 검증
      const validationResult = await this.sptGeneratorService.validateSptData(sptData);
      if (!validationResult.isValid) {
        // 검증 실패
        await this.submissionPrepRepository.create({
          taxCaseId,
          sptData,
          status: 'VALIDATION_FAILED',
          validationErrors: validationResult.errors,
          preparedByConsultantId: consultantId,
        });
        throw new Error(`Validation failed: ${JSON.stringify(validationResult.errors)}`);
      }

      // 4. Operator Helper 형식 변환
      const operatorHelperData = await this.sptGeneratorService.formatForOperatorHelper(sptData);

      // 5. SubmissionPrep 저장
      await this.submissionPrepRepository.create({
        taxCaseId,
        sptData,
        operatorHelperData,
        status: 'READY_TO_FILE',
        validatedAt: new Date(),
        preparedByConsultantId: consultantId,
      });

      // 6. Audit Log 기록
      await this.auditLogRepository.create({
        taxCaseId,
        actorId: consultantId,
        action: `BULK_PREPARE_COMPLETED: Batch ${batchId}`,
      });

      this.logger.log(`Bulk prepare completed for taxCaseId: ${taxCaseId}`);
      return { success: true, taxCaseId };
    } catch (error) {
      this.logger.error(`Bulk prepare failed for taxCaseId: ${taxCaseId}`, error);

      // 실패 Audit Log
      await this.auditLogRepository.create({
        taxCaseId,
        actorId: consultantId,
        action: `BULK_PREPARE_FAILED: ${error.message}`,
      });

      throw error; // Bull Queue 재시도 로직 트리거
    }
  }
}
```

**SptGeneratorService 구현:**
```typescript
// apps/api/src/submission-prep/spt-generator.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { TaxCaseRepository } from '../repository/repositories/taxcase.repository';
import { TaxType } from '@prisma/client';

interface SptData {
  taxCaseId: bigint;
  taxType: TaxType;
  period: string;
  companyNpwp: string;
  companyName: string;
  taxAmount: number;
  // PPh21 specific
  employeeCount?: number;
  grossSalary?: number;
  taxableIncome?: number;
  // PPh23 specific
  serviceType?: string;
  grossAmount?: number;
  // VAT specific
  outputVat?: number;
  inputVat?: number;
  netVat?: number;
}

interface ValidationResult {
  isValid: boolean;
  errors: { field: string; message: string }[];
}

interface OperatorHelperData {
  sections: {
    label: string;
    value: string;
    copyable: boolean;
  }[];
}

@Injectable()
export class SptGeneratorService {
  private readonly logger = new Logger(SptGeneratorService.name);

  constructor(private readonly taxCaseRepository: TaxCaseRepository) {}

  async generate(taxCaseId: bigint): Promise<SptData> {
    const taxCase = await this.taxCaseRepository.findById(taxCaseId, {
      include: {
        company: true,
        aiResults: { orderBy: { createdAt: 'desc' }, take: 1 },
        reviews: { orderBy: { reviewedAt: 'desc' }, take: 1 },
      },
    });

    if (!taxCase) {
      throw new Error(`TaxCase not found: ${taxCaseId}`);
    }

    // AI 분석 결과 또는 Human Review 결과에서 세금 데이터 추출
    const taxData = taxCase.reviews?.[0]?.finalTax
      ? JSON.parse(taxCase.reviews[0].finalTax)
      : taxCase.aiResults?.[0]?.rawResponse;

    const baseSptData: SptData = {
      taxCaseId,
      taxType: taxCase.taxType,
      period: taxCase.period,
      companyNpwp: taxCase.company.npwp,
      companyName: taxCase.company.name,
      taxAmount: taxData?.taxAmount || 0,
    };

    // 세금 유형별 추가 데이터
    switch (taxCase.taxType) {
      case 'PPh21':
        return this.generatePPh21Data(baseSptData, taxData);
      case 'PPh23':
        return this.generatePPh23Data(baseSptData, taxData);
      case 'VAT':
        return this.generateVatData(baseSptData, taxData);
      default:
        return baseSptData;
    }
  }

  private generatePPh21Data(base: SptData, taxData: any): SptData {
    return {
      ...base,
      employeeCount: taxData?.employeeCount || 0,
      grossSalary: taxData?.grossSalary || 0,
      taxableIncome: taxData?.taxableIncome || 0,
    };
  }

  private generatePPh23Data(base: SptData, taxData: any): SptData {
    return {
      ...base,
      serviceType: taxData?.serviceType || '',
      grossAmount: taxData?.grossAmount || 0,
    };
  }

  private generateVatData(base: SptData, taxData: any): SptData {
    return {
      ...base,
      outputVat: taxData?.outputVat || 0,
      inputVat: taxData?.inputVat || 0,
      netVat: (taxData?.outputVat || 0) - (taxData?.inputVat || 0),
    };
  }

  async validateSptData(sptData: SptData): Promise<ValidationResult> {
    const errors: { field: string; message: string }[] = [];

    // 필수 필드 검증
    if (!sptData.companyNpwp) {
      errors.push({ field: 'companyNpwp', message: 'NPWP is required' });
    } else if (!this.isValidNpwp(sptData.companyNpwp)) {
      errors.push({ field: 'companyNpwp', message: 'Invalid NPWP format' });
    }

    if (!sptData.period) {
      errors.push({ field: 'period', message: 'Tax period is required' });
    }

    if (sptData.taxAmount < 0) {
      errors.push({ field: 'taxAmount', message: 'Tax amount cannot be negative' });
    }

    // 세금 유형별 추가 검증
    if (sptData.taxType === 'VAT' && sptData.netVat === undefined) {
      errors.push({ field: 'netVat', message: 'Net VAT is required for VAT type' });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private isValidNpwp(npwp: string): boolean {
    // NPWP format: XX.XXX.XXX.X-XXX.XXX (15 digits)
    const cleanNpwp = npwp.replace(/[.\-]/g, '');
    return /^\d{15}$/.test(cleanNpwp);
  }

  async formatForOperatorHelper(sptData: SptData): Promise<OperatorHelperData> {
    const sections = [
      { label: 'NPWP', value: sptData.companyNpwp, copyable: true },
      { label: '회사명', value: sptData.companyName, copyable: true },
      { label: '과세 기간', value: sptData.period, copyable: true },
      { label: '세금 유형', value: sptData.taxType, copyable: true },
      { label: '납부 세액', value: `Rp ${sptData.taxAmount.toLocaleString('id-ID')}`, copyable: true },
    ];

    // 세금 유형별 추가 필드
    if (sptData.taxType === 'PPh21') {
      sections.push(
        { label: '직원 수', value: String(sptData.employeeCount || 0), copyable: true },
        { label: '총 급여', value: `Rp ${(sptData.grossSalary || 0).toLocaleString('id-ID')}`, copyable: true },
      );
    } else if (sptData.taxType === 'VAT') {
      sections.push(
        { label: 'Output VAT', value: `Rp ${(sptData.outputVat || 0).toLocaleString('id-ID')}`, copyable: true },
        { label: 'Input VAT', value: `Rp ${(sptData.inputVat || 0).toLocaleString('id-ID')}`, copyable: true },
        { label: 'Net VAT', value: `Rp ${(sptData.netVat || 0).toLocaleString('id-ID')}`, copyable: true },
      );
    }

    return { sections };
  }
}
```

**SubmissionPrepController 구현:**
```typescript
// apps/api/src/submission-prep/submission-prep.controller.ts
import { Controller, Post, Get, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { v4 as uuidv4 } from 'uuid';
import { BulkPrepareRequestDto, BulkPrepareResponseDto, BulkStatusResponseDto } from './dto/bulk-prepare.dto';
import { SubmissionPrepRepository } from '../repository/repositories/submission-prep.repository';

@ApiTags('submission-prep')
@Controller('api/submission-prep')
export class SubmissionPrepController {
  constructor(
    @InjectQueue('bulk-prepare') private readonly bulkPrepareQueue: Queue,
    private readonly submissionPrepRepository: SubmissionPrepRepository,
  ) {}

  @Post('bulk-prepare')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: '일괄 제출 준비 시작' })
  @ApiResponse({ status: 202, description: '일괄 준비 작업이 큐에 추가됨', type: BulkPrepareResponseDto })
  async bulkPrepare(@Body() dto: BulkPrepareRequestDto): Promise<BulkPrepareResponseDto> {
    const batchId = uuidv4();

    // 각 케이스별로 큐에 작업 추가
    const jobs = await Promise.all(
      dto.taxCaseIds.map((taxCaseId) =>
        this.bulkPrepareQueue.add(
          {
            taxCaseId: BigInt(taxCaseId),
            consultantId: BigInt(dto.consultantId),
            batchId,
          },
          {
            jobId: `${batchId}-${taxCaseId}`,
          },
        ),
      ),
    );

    return {
      batchId,
      totalCount: jobs.length,
      status: 'PROCESSING',
    };
  }

  @Get('bulk-status/:batchId')
  @ApiOperation({ summary: '일괄 준비 상태 조회' })
  @ApiResponse({ status: 200, description: '일괄 준비 상태', type: BulkStatusResponseDto })
  async getBulkStatus(@Param('batchId') batchId: string): Promise<BulkStatusResponseDto> {
    // Bull Queue에서 배치 작업 상태 조회
    const jobs = await this.bulkPrepareQueue.getJobs(['completed', 'failed', 'active', 'waiting']);
    const batchJobs = jobs.filter((job) => job.id?.toString().startsWith(batchId));

    const completed = batchJobs.filter((job) => job.finishedOn && !job.failedReason).length;
    const failed = batchJobs.filter((job) => job.failedReason).length;
    const processing = batchJobs.filter((job) => job.processedOn && !job.finishedOn).length;
    const waiting = batchJobs.filter((job) => !job.processedOn).length;

    const total = batchJobs.length;
    const progress = total > 0 ? Math.round(((completed + failed) / total) * 100) : 0;

    return {
      batchId,
      totalCount: total,
      completed,
      failed,
      processing,
      waiting,
      progress,
      status: progress === 100 ? 'COMPLETED' : 'PROCESSING',
    };
  }

  @Get(':taxCaseId')
  @ApiOperation({ summary: '개별 준비 상태 조회' })
  async getSubmissionPrep(@Param('taxCaseId') taxCaseId: string) {
    return this.submissionPrepRepository.findByTaxCaseId(BigInt(taxCaseId));
  }
}
```

**SubmissionPrepRepository 구현:**
```typescript
// apps/api/src/repository/repositories/submission-prep.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma, SubmissionPrep, SubmissionPrepStatus } from '@prisma/client';

@Injectable()
export class SubmissionPrepRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByTaxCaseId(taxCaseId: bigint): Promise<SubmissionPrep | null> {
    return this.prisma.submissionPrep.findUnique({
      where: { taxCaseId },
    });
  }

  async create(data: Prisma.SubmissionPrepCreateInput): Promise<SubmissionPrep> {
    return this.prisma.submissionPrep.create({ data });
  }

  async updateStatus(taxCaseId: bigint, status: SubmissionPrepStatus): Promise<SubmissionPrep> {
    return this.prisma.submissionPrep.update({
      where: { taxCaseId },
      data: { status },
    });
  }

  async upsert(
    taxCaseId: bigint,
    createData: Prisma.SubmissionPrepCreateInput,
    updateData: Prisma.SubmissionPrepUpdateInput,
  ): Promise<SubmissionPrep> {
    return this.prisma.submissionPrep.upsert({
      where: { taxCaseId },
      create: createData,
      update: updateData,
    });
  }
}
```

**DTO 정의:**
```typescript
// apps/api/src/submission-prep/dto/bulk-prepare.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, ArrayMinSize, IsString } from 'class-validator';

export class BulkPrepareRequestDto {
  @ApiProperty({ description: '준비할 TaxCase ID 목록', example: ['1', '2', '3'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsNotEmpty({ each: true })
  taxCaseIds: string[];

  @ApiProperty({ description: '준비 담당 Consultant ID', example: '1' })
  @IsString()
  @IsNotEmpty()
  consultantId: string;
}

export class BulkPrepareResponseDto {
  @ApiProperty({ description: '배치 ID', example: 'abc123-def456' })
  batchId: string;

  @ApiProperty({ description: '총 작업 수', example: 35 })
  totalCount: number;

  @ApiProperty({ description: '상태', example: 'PROCESSING' })
  status: string;
}

export class BulkStatusResponseDto {
  @ApiProperty({ description: '배치 ID' })
  batchId: string;

  @ApiProperty({ description: '총 작업 수' })
  totalCount: number;

  @ApiProperty({ description: '완료된 작업 수' })
  completed: number;

  @ApiProperty({ description: '실패한 작업 수' })
  failed: number;

  @ApiProperty({ description: '처리 중인 작업 수' })
  processing: number;

  @ApiProperty({ description: '대기 중인 작업 수' })
  waiting: number;

  @ApiProperty({ description: '진행률 (0-100)' })
  progress: number;

  @ApiProperty({ description: '상태', example: 'PROCESSING' })
  status: string;
}
```

**프론트엔드 API 클라이언트:**
```typescript
// apps/web/src/api/submission-prep.api.ts
import { apiClient } from './client';

interface BulkPrepareRequest {
  taxCaseIds: string[];
  consultantId: string;
}

interface BulkPrepareResponse {
  batchId: string;
  totalCount: number;
  status: string;
}

interface BulkStatusResponse {
  batchId: string;
  totalCount: number;
  completed: number;
  failed: number;
  processing: number;
  waiting: number;
  progress: number;
  status: string;
}

export async function bulkPrepare(request: BulkPrepareRequest): Promise<BulkPrepareResponse> {
  const response = await apiClient.post('/api/submission-prep/bulk-prepare', request);
  return response.data;
}

export async function getBulkStatus(batchId: string): Promise<BulkStatusResponse> {
  const response = await apiClient.get(`/api/submission-prep/bulk-status/${batchId}`);
  return response.data;
}

export async function getSubmissionPrep(taxCaseId: string) {
  const response = await apiClient.get(`/api/submission-prep/${taxCaseId}`);
  return response.data;
}
```

### Dependencies

**Story 4-1 의존성:**
- BulkPreparePanel UI가 구현되어 있음
- `useBulkSelectStore`가 구현되어 있음
- `BulkPrepareButton.onPrepare` 콜백 연결 필요

**기존 모듈:**
- QueueModule (Bull + Redis 설정 완료)
- RepositoryModule (Prisma Service)
- TaxCaseRepository

**외부 라이브러리:**
- `@nestjs/bull` - Bull Queue NestJS 통합
- `bull` - Redis 기반 작업 큐
- `uuid` - 배치 ID 생성

### Out of Scope

- 진행률 실시간 표시 UI (Story 4-3)
- 마감일별 체크리스트 (Story 4-4)
- 엑셀 내보내기 (Story 4-5)
- POA 유효성 검증 (Epic 8에서 구현)
- 알림 발송 (Epic 7에서 구현)

### Testing Considerations

**단위 테스트 케이스:**
1. SPT 데이터 생성 - PPh21 케이스
2. SPT 데이터 생성 - PPh23 케이스
3. SPT 데이터 생성 - VAT 케이스
4. NPWP 형식 검증 성공/실패
5. 필수 필드 누락 시 검증 실패
6. Operator Helper 데이터 포맷팅
7. Bull Queue 작업 추가
8. 동시성 10 처리 확인
9. 재시도 로직 (exponential backoff)
10. 배치 상태 조회

**통합 테스트:**
```typescript
// apps/api/src/submission-prep/submission-prep.controller.spec.ts
describe('SubmissionPrepController', () => {
  it('should create bulk prepare jobs', async () => {
    const dto = {
      taxCaseIds: ['1', '2', '3'],
      consultantId: '1',
    };

    const response = await controller.bulkPrepare(dto);

    expect(response.batchId).toBeDefined();
    expect(response.totalCount).toBe(3);
    expect(response.status).toBe('PROCESSING');
  });

  it('should return bulk status', async () => {
    const response = await controller.getBulkStatus('test-batch-id');

    expect(response.progress).toBeGreaterThanOrEqual(0);
    expect(response.progress).toBeLessThanOrEqual(100);
  });
});
```

### Previous Story Intelligence

**Story 4-1에서 학습:**
- Zustand store 패턴 (`useBulkSelectStore`)
- React Query 패턴 (useQuery, queryKey 구조)
- shadcn/ui 컴포넌트 활용
- BigInt ID 처리 패턴

**Epic 2 (OCR 처리)에서 학습:**
- Bull Queue 설정 패턴 (ocr-processing 큐)
- 프로세서 구현 패턴
- 비동기 작업 상태 추적

### Git Intelligence

**최근 커밋 패턴:**
- `d4a842e` - Epic 2 버그 수정
- `481c1d3` - Epic 2-4 완료

**기존 Queue 설정:**
- `apps/api/src/queue/queue.module.ts` - Bull Queue 기본 설정 존재
- `test-queue`, `ocr-processing` 큐 등록됨
- 재시도 로직 (3회, exponential backoff) 기본 설정됨

### References

- Epic 4: 일괄 제출 준비 및 체크리스트 [Source: epics.md#Epic 4]
- PRD FR-1.4: 일괄 제출 준비 [Source: prd.md#FR-1]
- Architecture: Queue System [Source: architecture.md#API & Communication Patterns - Queue System: Bull (Redis)]
- Architecture: 제출 준비 처리 패턴 [Source: architecture.md#Implementation Patterns - 제출 준비 처리 패턴]
- Architecture: submission-prep 모듈 [Source: architecture.md#Project Structure]

## Story Progress Notes

### Agent Model Used: `Claude`

### Change Log

| Change | Date | Version | Description | Author |
| ------ | ---- | ------- | ----------- | ------ |
| Created | 2026-01-06 | 0.1.0 | Ultimate context engine analysis - 일괄 제출 준비 처리 스토리 생성 | SM Agent |

### Completion Notes List

### File List
