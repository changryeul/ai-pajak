# Story 1.4: 신규 DB 스키마 마이그레이션

Status: done

## Story

As a **Developer**,
I want Phase 2에 필요한 신규 테이블이 생성되도록,
So that DJP 제출 준비, BPE, POA 데이터를 저장할 수 있습니다.

## Acceptance Criteria

1. **Given** prisma/schema.prisma가 존재할 때
   **When** 신규 테이블 스키마를 추가하면
   **Then** submission_prep 테이블 모델이 정의됩니다

2. **Given** submission_prep 모델이 정의될 때
   **When** 스키마를 확인하면
   **Then** taxCaseId, sptData (Json), operatorHelperData (Json), status, validatedAt, validationErrors (Json), preparedByConsultantId, manuallySubmittedAt, djpReferenceId 필드가 포함됩니다

3. **Given** 추가 테이블 모델이 필요할 때
   **When** 스키마를 추가하면
   **Then** bpe_documents 테이블이 생성됩니다 (taxCaseId, bpeNumber, fileUrl, fileSize, uploadedByConsultantId, uploadedAt, sentToCustomerAt)
   **And** efaktur_files 테이블이 생성됩니다 (taxCaseId, fileUrl, status, downloadedAt, manuallyUploadedAt, djpReferenceId)
   **And** billing_prep 테이블이 생성됩니다 (taxCaseId, billingData (Json), amount, ntpn, paidAt)
   **And** poa_validation_cache 테이블이 생성됩니다 (poaId, validatedAt, isValid, expiryWarningSent, nextValidationAt)

4. **Given** OcrResult 모델이 존재할 때
   **When** 컬럼을 확장하면
   **Then** ocrEngine (OcrEngine enum), confidenceScore (Decimal), processingTimeMs (Int), fallbackUsed (Boolean) 컬럼이 추가됩니다

5. **Given** 모든 스키마 변경이 완료될 때
   **When** `npx prisma migrate dev`를 실행하면
   **Then** 마이그레이션이 성공적으로 적용됩니다
   **And** `npx prisma generate`로 클라이언트가 생성됩니다

6. **Given** 마이그레이션이 적용될 때
   **When** 인덱스를 확인하면
   **Then** 자주 조회되는 컬럼에 적절한 인덱스가 생성됩니다

## Tasks / Subtasks

- [x] Task 1: Prisma 스키마 - Enum 정의 (AC: #1, #2, #3)
  - [x] 1.1: SubmissionPrepStatus enum 추가 (GENERATED, VALIDATED, READY_TO_FILE, MANUALLY_SUBMITTED, VALIDATION_FAILED)
  - [x] 1.2: EfakturStatus enum 추가 (GENERATED, DOWNLOADED, UPLOADED)
  - [x] 1.3: OcrEngine enum 추가 (PADDLEOCR, GEMINI, MANUAL)

- [x] Task 2: Prisma 스키마 - SubmissionPrep 모델 (AC: #1, #2)
  - [x] 2.1: SubmissionPrep 모델 정의 (id, taxCaseId, sptData, operatorHelperData, status, validatedAt, validationErrors, preparedByConsultantId, manuallySubmittedAt, djpReferenceId, createdAt)
  - [x] 2.2: TaxCase와 관계 설정 (TaxCase.submissionPrep)
  - [x] 2.3: User(Consultant)와 관계 설정 (preparedBy)
  - [x] 2.4: @@index([taxCaseId]), @@index([status]) 추가

- [x] Task 3: Prisma 스키마 - BpeDocument 모델 (AC: #3)
  - [x] 3.1: BpeDocument 모델 정의 (id, taxCaseId, bpeNumber, fileUrl, fileSize, uploadedByConsultantId, uploadedAt, sentToCustomerAt, createdAt)
  - [x] 3.2: TaxCase와 관계 설정 (TaxCase.bpeDocuments)
  - [x] 3.3: User와 관계 설정 (uploadedBy)
  - [x] 3.4: @@index([taxCaseId]) 추가, bpeNumber @unique

- [x] Task 4: Prisma 스키마 - EfakturFile 모델 (AC: #3)
  - [x] 4.1: EfakturFile 모델 정의 (id, taxCaseId, fileUrl, status, downloadedAt, manuallyUploadedAt, djpReferenceId, createdAt)
  - [x] 4.2: TaxCase와 관계 설정 (TaxCase.efakturFiles)
  - [x] 4.3: @@index([taxCaseId]), @@index([status]) 추가

- [x] Task 5: Prisma 스키마 - BillingPrep 모델 (AC: #3)
  - [x] 5.1: BillingPrep 모델 정의 (id, taxCaseId, billingData, amount, ntpn, paidAt, createdAt)
  - [x] 5.2: TaxCase와 관계 설정 (TaxCase.billingPrep)
  - [x] 5.3: @@index([taxCaseId]) 추가

- [x] Task 6: Prisma 스키마 - PoaValidationCache 모델 (AC: #3)
  - [x] 6.1: PowerOfAttorney 모델 추가 (아직 없다면 - id, customerId, startDate, endDate, documentUrl, createdAt)
  - [x] 6.2: PoaValidationCache 모델 정의 (id, poaId, validatedAt, isValid, expiryWarningSent, nextValidationAt)
  - [x] 6.3: PowerOfAttorney와 관계 설정
  - [x] 6.4: @@index([poaId]) 추가

- [x] Task 7: 기존 모델 확장 - AIResult/OcrResult (AC: #4)
  - [x] 7.1: AIResult 모델에 ocrEngine, confidenceScore, processingTimeMs, fallbackUsed 필드 추가
  - [x] 7.2: @@index([taxCaseId, ocrEngine]) 복합 인덱스 추가

- [x] Task 8: TaxCase 모델 관계 업데이트 (AC: #2, #3)
  - [x] 8.1: TaxCase에 submissionPrep, bpeDocuments[], efakturFiles[], billingPrep 관계 추가
  - [x] 8.2: 기존 filings → 신규 관계 정리 확인

- [x] Task 9: 마이그레이션 실행 및 검증 (AC: #5, #6)
  - [x] 9.1: `npx prisma migrate dev --name add_phase2_tables` 실행
  - [x] 9.2: 마이그레이션 파일 생성 확인
  - [x] 9.3: `npx prisma generate` 실행하여 클라이언트 생성
  - [x] 9.4: 스키마 유효성 확인 (Prisma Studio로 테이블 확인)

## Dev Notes

### Architecture Compliance

**프로젝트 구조:**
```
prisma/
├── schema.prisma          # 스키마 파일 (수정)
└── migrations/
    └── 20260103_add_phase2_tables/  # 신규 마이그레이션
        └── migration.sql
```

**Architecture 문서 참조 (architecture.md#Data Architecture):**
- 테이블 네이밍: snake_case, 복수형 (Prisma는 자동 변환)
- 외래키: `{table}_id` 패턴
- 인덱스: 자주 조회되는 컬럼에 추가

### Current Schema Analysis

**기존 TaxCase 모델:**
```prisma
model TaxCase {
  id        BigInt   @id @default(autoincrement())
  companyId BigInt
  taxType   TaxType
  period    String
  status    String   @default("OPEN")
  createdAt DateTime @default(now())

  company   Company       @relation(fields: [companyId], references: [id])
  workflow  WorkflowState?
  aiResults AIResult[]
  reviews   HumanReview[]
  filings   TaxFiling[]
  messages  Communication[]
  audits    AuditLog[]
}
```

**기존 AIResult 모델 (OcrResult 역할):**
```prisma
model AIResult {
  id           BigInt   @id @default(autoincrement())
  taxCaseId    BigInt
  suggestedTax String
  confidence   Float
  rawResponse  Json
  createdAt    DateTime @default(now())

  taxCase TaxCase @relation(fields: [taxCaseId], references: [id])
}
```

### Prisma Schema Updates

**신규 Enum 정의:**
```prisma
enum SubmissionPrepStatus {
  GENERATED
  VALIDATED
  READY_TO_FILE
  MANUALLY_SUBMITTED
  VALIDATION_FAILED
}

enum EfakturStatus {
  GENERATED
  DOWNLOADED
  UPLOADED
}

enum OcrEngine {
  PADDLEOCR
  GEMINI
  MANUAL
}
```

**SubmissionPrep 모델:**
```prisma
model SubmissionPrep {
  id                      BigInt                @id @default(autoincrement())
  taxCaseId               BigInt                @unique
  sptData                 Json                  // SPT 제출 데이터
  operatorHelperData      Json?                 // Operator Helper용 데이터
  status                  SubmissionPrepStatus  @default(GENERATED)
  validatedAt             DateTime?
  validationErrors        Json?                 // 검증 실패 시 상세 에러
  preparedByConsultantId  BigInt?
  manuallySubmittedAt     DateTime?             // 수동 제출 완료 시간
  djpReferenceId          String?               @db.VarChar(100)
  createdAt               DateTime              @default(now())

  taxCase    TaxCase @relation(fields: [taxCaseId], references: [id])
  preparedBy User?   @relation("PreparedSubmissions", fields: [preparedByConsultantId], references: [id])

  @@index([taxCaseId])
  @@index([status])
}
```

**BpeDocument 모델:**
```prisma
model BpeDocument {
  id                    BigInt    @id @default(autoincrement())
  taxCaseId             BigInt
  bpeNumber             String?   @unique @db.VarChar(50)
  fileUrl               String    // S3 URL
  fileSize              Int?
  uploadedByConsultantId BigInt?
  uploadedAt            DateTime
  sentToCustomerAt      DateTime?
  createdAt             DateTime  @default(now())

  taxCase    TaxCase @relation(fields: [taxCaseId], references: [id])
  uploadedBy User?   @relation("UploadedBpes", fields: [uploadedByConsultantId], references: [id])

  @@index([taxCaseId])
}
```

**EfakturFile 모델:**
```prisma
model EfakturFile {
  id                 BigInt        @id @default(autoincrement())
  taxCaseId          BigInt
  fileUrl            String        // 생성된 CSV 파일 URL
  status             EfakturStatus @default(GENERATED)
  downloadedAt       DateTime?
  manuallyUploadedAt DateTime?
  djpReferenceId     String?       @db.VarChar(100)
  createdAt          DateTime      @default(now())

  taxCase TaxCase @relation(fields: [taxCaseId], references: [id])

  @@index([taxCaseId])
  @@index([status])
}
```

**BillingPrep 모델:**
```prisma
model BillingPrep {
  id          BigInt   @id @default(autoincrement())
  taxCaseId   BigInt   @unique
  billingData Json     // e-Billing 생성용 데이터
  amount      Decimal  @db.Decimal(15, 2)
  ntpn        String?  @db.VarChar(50)  // 납부 후 수동 입력
  paidAt      DateTime?
  createdAt   DateTime @default(now())

  taxCase TaxCase @relation(fields: [taxCaseId], references: [id])

  @@index([taxCaseId])
}
```

**PowerOfAttorney 모델 (신규):**
```prisma
model PowerOfAttorney {
  id          BigInt    @id @default(autoincrement())
  customerId  BigInt    // Company 또는 별도 Customer 모델
  companyId   BigInt
  startDate   DateTime
  endDate     DateTime
  documentUrl String?
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  company          Company              @relation(fields: [companyId], references: [id])
  validationCache  PoaValidationCache[]

  @@index([companyId])
  @@index([endDate])
}
```

**PoaValidationCache 모델:**
```prisma
model PoaValidationCache {
  id                BigInt    @id @default(autoincrement())
  poaId             BigInt
  validatedAt       DateTime
  isValid           Boolean
  expiryWarningSent Boolean   @default(false)
  nextValidationAt  DateTime?

  poa PowerOfAttorney @relation(fields: [poaId], references: [id])

  @@index([poaId])
}
```

**AIResult 확장 (OCR 필드 추가):**
```prisma
model AIResult {
  id              BigInt     @id @default(autoincrement())
  taxCaseId       BigInt
  suggestedTax    String
  confidence      Float
  rawResponse     Json
  createdAt       DateTime   @default(now())

  // Phase 2 OCR 필드 추가
  ocrEngine       OcrEngine?
  confidenceScore Decimal?   @db.Decimal(5, 2)
  processingTimeMs Int?
  fallbackUsed    Boolean    @default(false)

  taxCase TaxCase @relation(fields: [taxCaseId], references: [id])

  @@index([taxCaseId])
  @@index([ocrEngine])
}
```

**TaxCase 관계 업데이트:**
```prisma
model TaxCase {
  id        BigInt   @id @default(autoincrement())
  companyId BigInt
  taxType   TaxType
  period    String
  status    String   @default("OPEN")
  createdAt DateTime @default(now())

  company        Company          @relation(fields: [companyId], references: [id])
  workflow       WorkflowState?
  aiResults      AIResult[]
  reviews        HumanReview[]
  filings        TaxFiling[]
  messages       Communication[]
  audits         AuditLog[]

  // Phase 2 관계 추가
  submissionPrep SubmissionPrep?
  bpeDocuments   BpeDocument[]
  efakturFiles   EfakturFile[]
  billingPrep    BillingPrep?
}
```

**Company 관계 업데이트:**
```prisma
model Company {
  id        BigInt   @id @default(autoincrement())
  name      String
  npwp      String   @unique
  createdAt DateTime @default(now())

  users     CompanyUser[]
  taxCases  TaxCase[]
  poas      PowerOfAttorney[]  // Phase 2 추가
}
```

**User 관계 업데이트:**
```prisma
model User {
  id        BigInt   @id @default(autoincrement())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())

  companyUsers         CompanyUser[]
  auditLogs            AuditLog[]   @relation("AuditActor")
  reviews              HumanReview[]

  // Phase 2 관계 추가
  preparedSubmissions  SubmissionPrep[]  @relation("PreparedSubmissions")
  uploadedBpes         BpeDocument[]     @relation("UploadedBpes")
}
```

### Technical Requirements

**Prisma 마이그레이션 명령어:**
```bash
# 개발 환경에서 마이그레이션 생성 및 적용
npx prisma migrate dev --name add_phase2_tables

# 클라이언트 재생성
npx prisma generate

# 스키마 확인 (Prisma Studio)
npx prisma studio
```

**Prisma 버전:**
- Prisma CLI: 5.10+
- Prisma Client: 5.10+
- 데이터베이스: PostgreSQL 15+

### File Structure Notes

**수정 파일:**
- `prisma/schema.prisma` - 스키마 업데이트

**생성 파일:**
- `prisma/migrations/[timestamp]_add_phase2_tables/migration.sql` - 자동 생성

### Critical Implementation Rules

1. **BigInt 사용**: 모든 ID 필드는 BigInt (기존 패턴 유지)
2. **@unique 제약**: bpeNumber, submission_prep.taxCaseId (1:1 관계)
3. **Optional 관계**: preparedByConsultantId, uploadedByConsultantId는 nullable (시스템 자동 생성 가능)
4. **Json 필드**: sptData, operatorHelperData, billingData, validationErrors - Prisma Json 타입 사용
5. **Decimal 정밀도**: 금액 필드는 Decimal(15,2) - 인도네시아 루피아 기준
6. **인덱스 전략**: 자주 조회되는 외래키와 상태 필드에 인덱스 추가

### Previous Story Learnings (Story 1-2, 1-3)

**적용할 패턴:**
- 상세한 Given/When/Then Acceptance Criteria
- Task별 AC 매핑 명시
- 코드 예시 포함한 Dev Notes
- 명확한 파일 목록 (New/Modified 구분)

**Story 1-2 학습:**
- ConfigService 사용 패턴
- 환경변수 기본값 설정
- 빌드 검증 단계 포함

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture - Database: PostgreSQL]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture - 신규 테이블]
- [Source: _bmad-output/planning-artifacts/prd.md#Technical Considerations - Database Schema Changes]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.4: 신규 DB 스키마 마이그레이션]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- 스키마 검증: `npx prisma validate` - 성공
- 마이그레이션: `npx prisma migrate dev --name add_phase2_tables` - 성공
- 클라이언트 생성: 마이그레이션 중 자동 실행 - 성공

### Completion Notes List

1. **Enum 정의 완료**: SubmissionPrepStatus, EfakturStatus, OcrEngine 3개 enum 추가
2. **Phase 2 테이블 생성 완료**:
   - SubmissionPrep: SPT 제출 준비 데이터 저장 (1:1 with TaxCase)
   - BpeDocument: BPE 문서 저장 (1:N with TaxCase)
   - EfakturFile: e-Faktur 파일 저장 (1:N with TaxCase)
   - BillingPrep: e-Billing 준비 데이터 저장 (1:1 with TaxCase)
   - PowerOfAttorney: POA 문서 저장 (1:N with Company)
   - PoaValidationCache: POA 검증 캐시 (1:N with PowerOfAttorney)
3. **AIResult 모델 확장 완료**: ocrEngine, confidenceScore, processingTimeMs, fallbackUsed 필드 추가
4. **관계 설정 완료**: TaxCase, User, Company 모델에 Phase 2 관계 추가
5. **인덱스 추가 완료**: 자주 조회되는 외래키 및 상태 필드에 인덱스 생성

### File List

**Modified Files:**
- prisma/schema.prisma (Phase 2 enum, 모델, 관계 추가)

**Generated Files (자동):**
- prisma/migrations/20260103150000_add_phase2_tables_with_cr_fixes/migration.sql

## Change Log

- 2026-01-03: Story 1-4 생성 - ready-for-dev 상태로 설정
- 2026-01-03: Phase 2 DB 스키마 마이그레이션 완료 - review 상태로 변경
- 2026-01-03: 코드 리뷰 수정 완료:
  - [HIGH] AIResult 복합 인덱스 `@@index([taxCaseId, ocrEngine])` 추가
  - [MEDIUM] PowerOfAttorney.customerId → User 관계 설정
  - [MEDIUM] PoaValidationCache.createdAt 필드 추가
  - [MEDIUM] confidence 필드 deprecation 주석 추가
  - [LOW] 스키마 상단에 삭제 정책 문서화
  - [LOW] Phase 2 테이블에 onDelete 정책 명시 (Cascade/SetNull)
  - [LOW] AC #4 문서 업데이트 (ocrEngine: String → OcrEngine enum)
