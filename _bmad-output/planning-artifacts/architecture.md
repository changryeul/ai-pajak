---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
workflowType: 'architecture'
lastStep: 8
status: 'complete'
completedAt: '2026-01-03'
project_name: 'ai-pajak'
user_name: 'Chrishan'
date: '2026-01-03'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
  - docs/project-documentation/architecture-api.md
  - docs/project-documentation/architecture-web.md
  - docs/project-documentation/integration-architecture.md
  - docs/PRD/features/mvp-scope.md
---

# Architecture Decision Document - AI Pajak Phase 2

**Author:** Chrishan (with Winston the Architect)
**Date:** 2026-01-03
**Version:** 1.0
**Project Type:** Brownfield - Phase 1 확장
**Phase:** Phase 2 - DJP API 자동화 & 고급 문서 처리

---

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**

AI Pajak Phase 2는 기존 Phase 1의 세금 계산 자동화 플랫폼을 DJP(인도네시아 국세청) API와 직접 통합하는 것이 핵심입니다.

| FR ID | 기능 | 우선순위 | 아키텍처 영향 |
|-------|------|---------|--------------|
| FR-1 | DJP e-Filing API 통합 | P0 | 새 모듈 생성, OAuth 2.0, 큐 시스템 |
| FR-2 | PaddleOCR 통합 | P0 | Python 서비스 분리, 하이브리드 처리 |
| FR-3 | e-Faktur PPN 지원 | P0 | DJP e-Faktur API 추가 통합 |
| FR-4 | 워크플로우 자동화 | P1 | 스케줄러 모듈, 알림 시스템 확장 |
| FR-5 | Audit & Compliance | P0 | 불변 로그, POA 검증 |

**Non-Functional Requirements:**

| NFR | 요구사항 | 아키텍처 결정 |
|-----|---------|--------------|
| 성능 | DJP API 5초 이내, OCR 3초/페이지 | 비동기 처리, 큐 시스템 |
| 보안 | AES-256 암호화, TLS 1.3 | HSM 권장, 암호화 서비스 |
| 확장성 | 500+ 동시 사용자 | 수평 확장 가능 설계 |
| 가용성 | 99.9% 가동률 | 장애 복구 전략 |

**Scale & Complexity:**

- **Primary domain:** Full-stack SaaS B2B Platform
- **Complexity level:** High (외부 API 통합, OCR 처리, 규제 준수)
- **Estimated architectural components:** 8개 주요 모듈

### Technical Constraints & Dependencies

| 제약 사항 | 영향 |
|----------|------|
| DJP API 계약 필요 | Jakarta Tax Consulting 자격증명 사용 |
| PJAP 인증 | Jakarta Tax Consulting 주도 |
| Rate Limit (100 req/min) | 지능적 스로틀링 필수 |
| 기존 NestJS/React 스택 | 확장, 신규 모듈 추가 방식 |

### Cross-Cutting Concerns Identified

1. **법적 귀속 (Legal Attribution):** 모든 DJP 제출은 Jakarta Tax Consulting 명의
2. **Audit Trail:** 불변 로그, 완전 추적
3. **POA 검증:** 위임장 유효성 자동 확인
4. **에러 처리:** DJP API 장애 시 graceful degradation

---

## Starter Template Evaluation

### Primary Technology Domain

**Brownfield 프로젝트** - 기존 스택 확장

기존 스택:
- **Backend:** NestJS 10.x + Prisma 5.x + PostgreSQL
- **Frontend:** React + Vite + TailwindCSS
- **Infrastructure:** 모노레포 (npm workspaces)

### Selected Approach: Module Extension

**Rationale:**
- Phase 1 코드베이스가 안정적으로 운영 중
- 새로운 스타터 대신 기존 아키텍처 확장
- 신규 모듈 추가 방식으로 기능 확장

**Technical Preferences Confirmed:**

| 카테고리 | 결정 | 근거 |
|---------|------|------|
| Language | TypeScript 5.4+ | 기존 스택 유지 |
| Backend | NestJS 10.x | 모듈러 아키텍처 활용 |
| ORM | Prisma 5.10+ | 기존 스키마 확장 |
| Frontend | React 18 + shadcn/ui | UX 설계 반영 |
| OCR Service | Python FastAPI + PaddleOCR | GPU 활용, 독립 서비스 |

---

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**

1. DJP API 통합 패턴 선택
2. PaddleOCR 서비스 배포 전략
3. 일괄 제출 큐 시스템 선택
4. 암호화 및 자격증명 관리

**Important Decisions (Shape Architecture):**

1. 스케줄러 구현 방식
2. 알림 시스템 확장
3. 프론트엔드 상태 관리

**Deferred Decisions (Post-MVP):**

1. 마이크로서비스 분리 여부
2. 멀티 리전 배포

### Data Architecture

#### Database: PostgreSQL (기존 확장)

**Version:** PostgreSQL 15+
**Rationale:** 기존 Phase 1 데이터베이스 확장, Prisma 호환성

**신규 테이블:**

```sql
-- DJP Submission Log
CREATE TABLE djp_submission (
  id BIGSERIAL PRIMARY KEY,
  tax_case_id BIGINT REFERENCES tax_cases(id),
  submission_type VARCHAR(20) NOT NULL,
  djp_reference_id VARCHAR(100),
  status VARCHAR(20) NOT NULL,
  request_payload JSONB,
  response_payload JSONB,
  error_message TEXT,
  submitted_at TIMESTAMPTZ,
  submitted_by_consultant_id BIGINT,
  retry_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- BPE Documents
CREATE TABLE bpe_documents (
  id BIGSERIAL PRIMARY KEY,
  tax_case_id BIGINT REFERENCES tax_cases(id),
  bpe_number VARCHAR(50) UNIQUE NOT NULL,
  file_url TEXT NOT NULL,
  file_size INT,
  received_at TIMESTAMPTZ NOT NULL,
  sent_to_customer_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- POA Validation Cache
CREATE TABLE poa_validation_cache (
  id BIGSERIAL PRIMARY KEY,
  poa_id BIGINT REFERENCES power_of_attorney(id),
  validated_at TIMESTAMPTZ NOT NULL,
  is_valid BOOLEAN NOT NULL,
  expiry_warning_sent BOOLEAN DEFAULT FALSE,
  next_validation_at TIMESTAMPTZ
);
```

**OCR 테이블 확장:**

```sql
ALTER TABLE ocr_results ADD COLUMN ocr_engine VARCHAR(20);
ALTER TABLE ocr_results ADD COLUMN confidence_score DECIMAL(5,2);
ALTER TABLE ocr_results ADD COLUMN processing_time_ms INT;
ALTER TABLE ocr_results ADD COLUMN fallback_used BOOLEAN DEFAULT FALSE;
```

#### Data Validation Strategy

- **Prisma Validation:** 스키마 레벨 제약조건
- **DTO Validation:** class-validator 데코레이터
- **Business Rules:** Service 레이어에서 검증

### Authentication & Security

#### Authentication: TBD (검토 중)

**Method:** TBD (AWS Cognito / Supabase Auth / Clerk 검토 중) + JWT
**Rationale:** 인증 솔루션 결정 보류 - AWS 인프라와의 통합성, 비용, 기능 비교 후 결정 예정
**Status:** 🟡 결정 필요

**DJP API 자격증명 관리:**

| 항목 | 결정 |
|------|------|
| 저장 | AES-256 암호화, 환경 변수 또는 Secrets Manager |
| 접근 | DJP 서비스만 접근 가능 |
| 갱신 | OAuth 2.0 refresh token 자동 갱신 |

#### Authorization: RBAC 유지

**기존 5-Role 시스템:**

1. `CUSTOMER` - 자사 데이터만 접근
2. `CONSULTANT_JTC` - 담당 고객 데이터
3. `TAX_ADVISOR_JTC` - 모든 고객 + 제출 권한
4. `PLATFORM_ADMIN` - 세금 데이터 접근 불가
5. `SYSTEM` - 빌링만, 세금 데이터 접근 불가

**신규 권한:**

| 권한 | 역할 |
|------|------|
| `djp:submit` | TAX_ADVISOR_JTC |
| `djp:bulk-submit` | TAX_ADVISOR_JTC |
| `ocr:manual-review` | CONSULTANT_JTC, TAX_ADVISOR_JTC |

### API & Communication Patterns

#### API Design: REST (기존 패턴 유지)

**Rationale:** NestJS 표준, Swagger 문서화 호환

**신규 엔드포인트:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/djp/efiling/submit` | SPT 제출 |
| POST | `/api/djp/efiling/bulk-submit` | SPT 일괄 제출 |
| GET | `/api/djp/efiling/status/:submissionId` | 제출 상태 조회 |
| POST | `/api/djp/ebilling/create` | ID Billing 생성 |
| GET | `/api/djp/bpe/:taxCaseId` | BPE 조회 |
| POST | `/api/djp/efaktur/create` | e-Faktur 생성 |
| POST | `/api/ocr/process` | 문서 OCR 처리 |
| GET | `/api/ocr/status/:jobId` | OCR 상태 조회 |

#### Error Handling Standards

```typescript
// 표준 에러 응답 형식
interface ApiErrorResponse {
  statusCode: number;
  message: string;
  error: string;
  details?: {
    field?: string;
    reason?: string;
    djpErrorCode?: string; // DJP API 에러 시
  };
  timestamp: string;
  path: string;
}
```

#### Communication Between Services

**NestJS → PaddleOCR Service:**
- Protocol: HTTP REST
- Port: 8080
- Timeout: 30초
- Retry: 3회 (지수 백오프)

**Queue System: Bull (Redis)**

```typescript
// Bull Queue 설정
const djpSubmissionQueue = new Bull('djp-submission', {
  redis: { host: 'localhost', port: 6379 },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});
```

### Frontend Architecture

#### State Management: React Query + Zustand

**Rationale:**
- React Query: 서버 상태 캐싱, 자동 갱신
- Zustand: UI 상태 (선택, 모달 등)

**구현 패턴:**

```typescript
// React Query - 서버 상태
const { data: taxCases } = useQuery({
  queryKey: ['taxCases', filters],
  queryFn: () => fetchTaxCases(filters),
});

// Zustand - UI 상태
const useBulkSubmitStore = create((set) => ({
  selectedIds: [],
  toggleSelect: (id) => set((s) => ({
    selectedIds: s.selectedIds.includes(id)
      ? s.selectedIds.filter(x => x !== id)
      : [...s.selectedIds, id]
  })),
}));
```

#### Component Architecture: shadcn/ui + Domain Components

UX 설계에 따른 컴포넌트 구조:

```
components/
├── ui/                    # shadcn/ui (auto-generated)
├── common/                # 공통 래퍼
├── layout/                # 레이아웃
├── taxcase/               # TaxCase 도메인
├── filing/                # Filing 도메인
├── ocr/                   # OCR 도메인
└── audit/                 # Audit 도메인
```

### Infrastructure & Deployment

#### Hosting Strategy

**Cloud Provider:** Amazon Web Services (AWS)
**Infrastructure as Code:** Terraform

| 컴포넌트 | 배포 | 근거 |
|---------|------|------|
| Web (Frontend) | ECS Fargate + CloudFront | Docker 컨테이너, 자동 스케일링, CDN 연동 |
| API (NestJS) | ECS Fargate + ALB | Docker 컨테이너, 자동 스케일링, 서버리스 |
| PaddleOCR | ECS Fargate (GPU) | GPU 지원 컨테이너 |
| PostgreSQL | RDS PostgreSQL | 완전 관리형 DB |
| Redis | ElastiCache Redis | Bull Queue 용 |
| Storage | S3 | 파일 저장소 |
| Auth | TBD (Cognito / Supabase Auth / Clerk) | 🟡 결정 필요 |

**ECS Fargate 선택 이유:**
- 서버리스 컨테이너 플랫폼 (인프라 관리 불필요)
- Docker 이미지 기반 배포
- 트래픽 기반 자동 스케일링
- 사용량 기반 과금으로 비용 효율적
- CodePipeline/CodeBuild와 통합된 CI/CD

#### Infrastructure as Code (Terraform)

```
infra/
├── terraform/
│   ├── main.tf                 # 메인 설정
│   ├── variables.tf            # 변수 정의
│   ├── outputs.tf              # 출력값
│   ├── versions.tf             # Provider 버전
│   │
│   ├── modules/
│   │   ├── ecs/                # ECS Fargate 서비스
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   └── outputs.tf
│   │   ├── rds/                # RDS PostgreSQL 인스턴스
│   │   ├── elasticache/        # ElastiCache Redis
│   │   ├── s3/                 # S3 버킷
│   │   ├── iam/                # IAM 정책
│   │   ├── alb/                # Application Load Balancer
│   │   └── vpc/                # VPC, 서브넷
│   │
│   └── environments/
│       ├── dev/
│       │   ├── main.tf
│       │   └── terraform.tfvars
│       ├── staging/
│       └── prod/
```

**Terraform 리소스:**

```hcl
# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "ai-pajak-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# ECS Fargate - API 서비스
resource "aws_ecs_service" "api" {
  name            = "ai-pajak-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnets
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "ai-pajak-api"
    container_port   = 3000
  }
}

resource "aws_ecs_task_definition" "api" {
  family                   = "ai-pajak-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name  = "ai-pajak-api"
    image = "${aws_ecr_repository.api.repository_url}:${var.image_tag}"
    portMappings = [{
      containerPort = 3000
      protocol      = "tcp"
    }]
    secrets = [{
      name      = "DATABASE_URL"
      valueFrom = aws_secretsmanager_secret.db_url.arn
    }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/ai-pajak-api"
        "awslogs-region"        = var.region
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])
}

# RDS - PostgreSQL
resource "aws_db_instance" "main" {
  identifier             = "ai-pajak-db"
  engine                 = "postgres"
  engine_version         = "16"
  instance_class         = "db.t3.medium"  # 2 vCPU, 4GB RAM
  allocated_storage      = 100
  storage_type           = "gp3"

  db_name  = "aipajak"
  username = var.db_username
  password = var.db_password

  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name

  backup_retention_period = 7
  skip_final_snapshot     = false
}

# ElastiCache - Redis
resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "ai-pajak-redis"
  engine               = "redis"
  node_type            = "cache.t3.micro"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379
  security_group_ids   = [aws_security_group.redis.id]
  subnet_group_name    = aws_elasticache_subnet_group.main.name
}
```

#### CI/CD Pipeline

```yaml
# GitHub Actions + AWS ECR/ECS
name: Deploy to ECS Fargate
on:
  push:
    branches: [main]

env:
  AWS_REGION: ap-southeast-1
  ECR_REPOSITORY_API: ai-pajak-api
  ECR_REPOSITORY_WEB: ai-pajak-web
  ECS_CLUSTER: ai-pajak-cluster
  ECS_SERVICE_API: ai-pajak-api
  ECS_SERVICE_WEB: ai-pajak-web

jobs:
  deploy-api:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build, tag, and push API image to ECR
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY_API:$IMAGE_TAG -f apps/api/Dockerfile .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY_API:$IMAGE_TAG

      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster $ECS_CLUSTER \
            --service $ECS_SERVICE_API \
            --force-new-deployment

  deploy-web:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build Web
        run: |
          npm ci
          npm run build:web

      - name: Build, tag, and push Web image to ECR
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY_WEB:$IMAGE_TAG -f apps/web/Dockerfile .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY_WEB:$IMAGE_TAG

      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster $ECS_CLUSTER \
            --service $ECS_SERVICE_WEB \
            --force-new-deployment

  terraform-apply:
    runs-on: ubuntu-latest
    needs: [deploy-api, deploy-web]
    if: github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3

      - name: Terraform Apply
        working-directory: infra/terraform/environments/prod
        run: |
          terraform init
          terraform apply -auto-approve
```

#### Environment Configuration

```
# .env.example
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# DJP API
DJP_API_URL=https://api.djp.go.id
DJP_CLIENT_ID=<encrypted>
DJP_CLIENT_SECRET=<encrypted>
DJP_OAUTH_TOKEN_URL=https://api.djp.go.id/oauth/token

# PaddleOCR
PADDLEOCR_SERVICE_URL=http://localhost:8080
PADDLEOCR_TIMEOUT_MS=30000

# Fallback
GEMINI_API_KEY=<encrypted>
GEMINI_FALLBACK_THRESHOLD=0.85
```

---

## Implementation Patterns & Consistency Rules

### Naming Patterns

#### Database Naming Conventions

| 대상 | 패턴 | 예시 |
|------|------|------|
| 테이블 | snake_case, 복수형 | `tax_cases`, `djp_submissions` |
| 컬럼 | snake_case | `created_at`, `tax_case_id` |
| 외래키 | `{table}_id` | `tax_case_id`, `consultant_id` |
| 인덱스 | `idx_{table}_{column}` | `idx_djp_submission_status` |

#### API Naming Conventions

| 대상 | 패턴 | 예시 |
|------|------|------|
| 엔드포인트 | kebab-case, 복수형 | `/api/tax-cases`, `/api/djp/bulk-submit` |
| 쿼리 파라미터 | camelCase | `?taxType=PPh21&pageSize=20` |
| JSON 필드 | camelCase | `{ "taxCaseId": 123, "submittedAt": "..." }` |

#### Code Naming Conventions

| 대상 | 패턴 | 예시 |
|------|------|------|
| 클래스 | PascalCase | `DjpService`, `TaxCaseRepository` |
| 함수/메서드 | camelCase | `submitToEfiling`, `validatePoa` |
| 상수 | SCREAMING_SNAKE_CASE | `DJP_RATE_LIMIT`, `OCR_CONFIDENCE_THRESHOLD` |
| 파일 | kebab-case | `djp.service.ts`, `bulk-submit.dto.ts` |
| 컴포넌트 파일 | PascalCase | `BulkSubmitPanel.tsx`, `StageBadge.tsx` |

### Structure Patterns

#### Module Structure (NestJS)

```
apps/api/src/{module}/
├── {module}.module.ts        # 모듈 정의
├── {module}.controller.ts    # HTTP 라우트
├── {module}.service.ts       # 비즈니스 로직
├── dto/                      # Data Transfer Objects
│   ├── create-{entity}.dto.ts
│   └── update-{entity}.dto.ts
└── types/                    # 타입 정의
```

#### Repository Pattern

모든 데이터베이스 접근은 `repository/repositories/` 레이어를 통해:

```typescript
// Good
const taxCase = await this.taxCaseRepository.findById(id);

// Bad - 직접 Prisma 호출
const taxCase = await this.prisma.taxCase.findUnique({ where: { id } });
```

### Format Patterns

#### API Response Format

```typescript
// 성공 응답 - 직접 데이터 반환
{
  "id": 123,
  "status": "APPROVED",
  "submittedAt": "2026-01-03T10:00:00Z"
}

// 목록 응답 - 페이지네이션 포함
{
  "data": [...],
  "meta": {
    "total": 100,
    "page": 1,
    "pageSize": 20,
    "totalPages": 5
  }
}

// 에러 응답
{
  "statusCode": 400,
  "message": "Invalid tax case ID",
  "error": "Bad Request",
  "timestamp": "2026-01-03T10:00:00Z",
  "path": "/api/djp/efiling/submit"
}
```

#### Date/Time Format

- **API:** ISO 8601 (`2026-01-03T10:00:00Z`)
- **DB:** TIMESTAMPTZ
- **Display:** 로케일 기반 (한국어: `2026년 1월 3일 오후 7:00`)

### Process Patterns

#### DJP API 호출 패턴

```typescript
// 1. POA 유효성 검증
const isPoaValid = await this.poaService.validate(taxCase.customerId);
if (!isPoaValid) throw new BadRequestException('POA expired or invalid');

// 2. 큐에 제출 작업 추가
await this.djpQueue.add('submit-efiling', {
  taxCaseId: taxCase.id,
  consultantId: consultant.id,
  submittedBy: 'JAKARTA_TAX_CONSULTING', // 법적 귀속
});

// 3. 비동기 처리 (Worker)
@Processor('djp-submission')
async handleSubmission(job: Job<SubmissionPayload>) {
  try {
    const result = await this.djpClient.submitEfiling(job.data);
    await this.updateSubmissionStatus(job.data.taxCaseId, 'SUBMITTED', result);
    await this.notificationService.sendSuccess(job.data);
  } catch (error) {
    if (job.attemptsMade < 3) throw error; // 재시도
    await this.updateSubmissionStatus(job.data.taxCaseId, 'FAILED', error);
    await this.notificationService.sendFailure(job.data, error);
  }
}
```

#### OCR 처리 패턴

```typescript
async processDocument(file: Buffer, mimeType: string): Promise<OcrResult> {
  // 1. PaddleOCR 시도
  const paddleResult = await this.paddleOcrClient.process(file);

  // 2. 신뢰도 확인
  if (paddleResult.confidence >= OCR_CONFIDENCE_THRESHOLD) {
    return {
      ...paddleResult,
      engine: 'PADDLEOCR',
      fallbackUsed: false,
    };
  }

  // 3. Gemini Fallback
  const geminiResult = await this.geminiClient.processWithVision(file);
  return {
    ...geminiResult,
    engine: 'GEMINI',
    fallbackUsed: true,
    originalConfidence: paddleResult.confidence,
  };
}
```

#### Error Handling Pattern

```typescript
// Global Exception Filter
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorResponse: ApiErrorResponse = {
      statusCode: status,
      message: this.getMessage(exception),
      error: HttpStatus[status],
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // DJP 에러 상세 추가
    if (exception instanceof DjpApiException) {
      errorResponse.details = {
        djpErrorCode: exception.djpCode,
        reason: exception.djpMessage,
      };
    }

    response.status(status).json(errorResponse);
  }
}
```

### Enforcement Guidelines

**All AI Agents MUST:**

1. 모든 DJP 제출은 `submitted_by: 'JAKARTA_TAX_CONSULTING'` 로깅
2. POA 검증 없이 DJP 제출 금지
3. 암호화된 자격증명만 사용 (평문 금지)
4. 모든 API 응답에 표준 에러 형식 적용
5. BigInt ID는 JSON 직렬화 시 문자열 변환

---

## Project Structure & Boundaries

### Complete Project Directory Structure

```
ai-pajak/
├── README.md
├── package.json
├── turbo.json                      # Turborepo (모노레포)
├── .env.example
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
│
├── apps/
│   ├── api/                        # NestJS Backend
│   │   ├── package.json
│   │   ├── nest-cli.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   │
│   │   │   ├── repository/         # 중앙 데이터 접근
│   │   │   │   ├── prisma.service.ts
│   │   │   │   ├── repository.module.ts
│   │   │   │   └── repositories/
│   │   │   │       ├── taxcase.repository.ts
│   │   │   │       ├── djp-submission.repository.ts   # 신규
│   │   │   │       ├── bpe.repository.ts               # 신규
│   │   │   │       └── ...
│   │   │   │
│   │   │   ├── taxcase/            # 기존 도메인
│   │   │   │   ├── taxcase.module.ts
│   │   │   │   ├── taxcase.controller.ts
│   │   │   │   ├── taxcase.service.ts
│   │   │   │   ├── review-workflow.service.ts
│   │   │   │   ├── dto/
│   │   │   │   ├── types/
│   │   │   │   └── utils/
│   │   │   │       └── workflow-actions.ts
│   │   │   │
│   │   │   ├── djp/                # 신규 - DJP API 통합
│   │   │   │   ├── djp.module.ts
│   │   │   │   ├── djp.controller.ts
│   │   │   │   ├── djp.service.ts           # DJP API 클라이언트
│   │   │   │   ├── efiling.service.ts       # e-Filing 제출
│   │   │   │   ├── ebilling.service.ts      # e-Billing 생성
│   │   │   │   ├── efaktur.service.ts       # e-Faktur 처리
│   │   │   │   ├── bpe.service.ts           # BPE 다운로드
│   │   │   │   ├── dto/
│   │   │   │   │   ├── submit-spt.dto.ts
│   │   │   │   │   ├── bulk-submit.dto.ts
│   │   │   │   │   ├── create-billing.dto.ts
│   │   │   │   │   └── efaktur.dto.ts
│   │   │   │   └── types/
│   │   │   │       └── djp-response.types.ts
│   │   │   │
│   │   │   ├── ocr/                # 리팩토링 - OCR 모듈
│   │   │   │   ├── ocr.module.ts
│   │   │   │   ├── ocr.controller.ts
│   │   │   │   ├── ocr.service.ts           # OCR 오케스트레이터
│   │   │   │   ├── paddleocr.client.ts      # PaddleOCR 클라이언트
│   │   │   │   ├── gemini.client.ts         # Gemini Fallback
│   │   │   │   └── dto/
│   │   │   │       ├── process-document.dto.ts
│   │   │   │       └── ocr-result.dto.ts
│   │   │   │
│   │   │   ├── scheduler/          # 신규 - 스케줄러
│   │   │   │   ├── scheduler.module.ts
│   │   │   │   ├── deadline-reminder.service.ts
│   │   │   │   ├── bulk-submit.processor.ts
│   │   │   │   └── bpe-polling.service.ts
│   │   │   │
│   │   │   ├── notification/       # 확장 - 알림
│   │   │   │   ├── notification.module.ts
│   │   │   │   ├── notification.service.ts
│   │   │   │   ├── email.service.ts
│   │   │   │   ├── whatsapp.service.ts      # 신규
│   │   │   │   └── templates/
│   │   │   │
│   │   │   ├── poa/                # 신규 - POA 관리
│   │   │   │   ├── poa.module.ts
│   │   │   │   ├── poa.service.ts
│   │   │   │   └── poa-validation.service.ts
│   │   │   │
│   │   │   ├── queue/              # 신규 - Bull Queue
│   │   │   │   ├── queue.module.ts
│   │   │   │   ├── djp-submission.queue.ts
│   │   │   │   └── ocr-processing.queue.ts
│   │   │   │
│   │   │   ├── company/            # 기존
│   │   │   ├── filing/             # 기존
│   │   │   ├── communication/      # 기존
│   │   │   └── common/             # 기존
│   │   │       ├── auth.guard.ts
│   │   │       ├── http-exception.filter.ts
│   │   │       └── decorators/
│   │   │
│   │   └── test/
│   │       ├── unit/
│   │       ├── integration/
│   │       └── e2e/
│   │
│   └── web/                        # React Frontend
│       ├── package.json
│       ├── vite.config.ts
│       ├── tsconfig.json
│       ├── tailwind.config.cjs
│       ├── index.html
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   │
│       │   ├── components/
│       │   │   ├── ui/             # shadcn/ui
│       │   │   │   ├── button.tsx
│       │   │   │   ├── card.tsx
│       │   │   │   └── ...
│       │   │   │
│       │   │   ├── common/         # 공통 래퍼
│       │   │   │   ├── PageHeader.tsx
│       │   │   │   ├── DataCard.tsx
│       │   │   │   ├── ConfirmDialog.tsx
│       │   │   │   └── LoadingOverlay.tsx
│       │   │   │
│       │   │   ├── layout/         # 레이아웃
│       │   │   │   ├── MainLayout.tsx
│       │   │   │   ├── DashboardLayout.tsx
│       │   │   │   ├── Sidebar.tsx
│       │   │   │   └── Header.tsx
│       │   │   │
│       │   │   ├── taxcase/        # TaxCase 도메인
│       │   │   │   ├── StageBadge.tsx
│       │   │   │   ├── StageProgress.tsx
│       │   │   │   ├── StageActions.tsx
│       │   │   │   ├── WorkflowTimeline.tsx
│       │   │   │   └── TaxCaseCard.tsx
│       │   │   │
│       │   │   ├── filing/         # Filing 도메인
│       │   │   │   ├── BulkSubmitPanel.tsx
│       │   │   │   ├── SubmissionProgress.tsx
│       │   │   │   ├── FilingStatusBadge.tsx
│       │   │   │   └── BPEDownloadCard.tsx
│       │   │   │
│       │   │   ├── ocr/            # OCR 도메인
│       │   │   │   ├── DocumentPreview.tsx
│       │   │   │   ├── OCRConfidenceIndicator.tsx
│       │   │   │   ├── ExtractedDataTable.tsx
│       │   │   │   └── OCRReviewPanel.tsx
│       │   │   │
│       │   │   └── audit/          # Audit 도메인
│       │   │       ├── AuditTimeline.tsx
│       │   │       └── AuditLogEntry.tsx
│       │   │
│       │   ├── pages/              # 라우트 페이지
│       │   │   ├── Dashboard.tsx
│       │   │   ├── TaxCaseList.tsx
│       │   │   ├── TaxCaseDetail.tsx
│       │   │   ├── BulkSubmit.tsx
│       │   │   └── OCRReview.tsx
│       │   │
│       │   ├── api/                # API 클라이언트
│       │   │   ├── client.ts
│       │   │   ├── taxcase.api.ts
│       │   │   ├── djp.api.ts
│       │   │   └── ocr.api.ts
│       │   │
│       │   ├── hooks/              # Custom Hooks
│       │   │   ├── useTaxCases.ts
│       │   │   ├── useBulkSubmit.ts
│       │   │   └── useOcrResult.ts
│       │   │
│       │   ├── stores/             # Zustand Stores
│       │   │   ├── bulkSubmitStore.ts
│       │   │   └── uiStore.ts
│       │   │
│       │   ├── types/              # TypeScript 타입
│       │   │   ├── taxcase.types.ts
│       │   │   ├── djp.types.ts
│       │   │   └── ocr.types.ts
│       │   │
│       │   ├── lib/
│       │   │   └── utils.ts
│       │   │
│       │   └── styles/
│       │       └── globals.css
│       │
│       └── tests/
│           └── components/
│
├── services/
│   └── paddleocr/                  # PaddleOCR Python 서비스
│       ├── Dockerfile
│       ├── requirements.txt
│       ├── main.py                 # FastAPI 엔트리포인트
│       ├── ocr_processor.py
│       └── models/
│
├── prisma/
│   ├── schema.prisma               # 공유 스키마
│   └── migrations/
│
├── docs/
│   ├── PRD/
│   ├── ERD/
│   └── project-documentation/
│
└── _bmad-output/
    └── planning-artifacts/
```

### Architectural Boundaries

**API Boundaries:**

| 경계 | 통신 방식 | 인증 |
|------|----------|------|
| Web → API | REST (Vite Proxy) | JWT |
| API → PostgreSQL | Prisma | 연결 문자열 |
| API → PaddleOCR | HTTP REST | 내부 네트워크 |
| API → DJP | HTTPS REST | OAuth 2.0 |
| API → Redis | Redis Protocol | 연결 문자열 |

**Service Boundaries:**

| 서비스 | 책임 | 의존성 |
|--------|------|--------|
| `DjpModule` | DJP API 통합 | TaxCaseModule, QueueModule |
| `OcrModule` | OCR 처리 | PaddleOCR Service, GeminiClient |
| `SchedulerModule` | 스케줄 작업 | QueueModule, NotificationModule |
| `QueueModule` | 비동기 작업 | Redis |

### Integration Points

**External Services:**

```
┌─────────────────────────────────────────────────────────────────┐
│                        AI Pajak Platform                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────┐     ┌─────────────┐     ┌──────────────────────┐  │
│   │   Web   │────▶│     API     │────▶│     PostgreSQL       │  │
│   │ (React) │     │  (NestJS)   │     │                      │  │
│   └─────────┘     └──────┬──────┘     └──────────────────────┘  │
│                          │                                       │
│              ┌───────────┼───────────┐                          │
│              │           │           │                          │
│              ▼           ▼           ▼                          │
│       ┌──────────┐ ┌──────────┐ ┌──────────┐                   │
│       │  Redis   │ │PaddleOCR │ │  DJP API │                   │
│       │ (Queue)  │ │ (Python) │ │ (외부)    │                   │
│       └──────────┘ └──────────┘ └──────────┘                   │
│                          │           │                          │
│                          │           ▼                          │
│                          │     ┌──────────┐                     │
│                          └────▶│  Gemini  │ (Fallback)         │
│                                │  (외부)   │                     │
│                                └──────────┘                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
- NestJS + Prisma + PostgreSQL: 기존 스택, 완벽 호환
- Bull Queue + Redis: NestJS 공식 지원
- React Query + Zustand: 서버/클라이언트 상태 분리

**Pattern Consistency:**
- REST API 패턴 일관성 유지
- 에러 처리 표준화
- 명명 규칙 통일

**Structure Alignment:**
- 모듈러 아키텍처 확장
- 도메인별 컴포넌트 분리

### Requirements Coverage Validation ✅

**Functional Requirements Coverage:**

| FR | 아키텍처 지원 |
|----|-------------|
| FR-1: DJP API 통합 | DjpModule, QueueModule |
| FR-2: PaddleOCR | OcrModule, PaddleOCR Service |
| FR-3: e-Faktur | DjpModule.efakturService |
| FR-4: 워크플로우 자동화 | SchedulerModule |
| FR-5: Audit & Compliance | 기존 AuditLog + 확장 |

**Non-Functional Requirements Coverage:**

| NFR | 아키텍처 지원 |
|-----|-------------|
| 성능 | Bull Queue 비동기 처리, 캐싱 |
| 보안 | AES-256, RBAC, Audit Log |
| 확장성 | 수평 확장 가능 설계 |
| 가용성 | 큐 기반 재시도, Fallback |

### Architecture Completeness Checklist

**✅ Requirements Analysis**

- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**✅ Architectural Decisions**

- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**✅ Implementation Patterns**

- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**✅ Project Structure**

- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION ✅

**Confidence Level:** High

**Key Strengths:**

1. 기존 Phase 1 아키텍처 기반으로 안정적 확장
2. 외부 API 통합을 위한 Queue 기반 비동기 처리
3. 하이브리드 OCR 전략으로 정확도와 비용 최적화
4. 법적 귀속 및 Audit 요구사항 충족

**Areas for Future Enhancement:**

1. 마이크로서비스 분리 (10,000+ 고객 시)
2. 멀티 리전 배포
3. GraphQL 도입 검토

---

## Architecture Completion Summary

### Workflow Completion

**Architecture Decision Workflow:** COMPLETED ✅
**Total Steps Completed:** 8
**Date Completed:** 2026-01-03
**Document Location:** _bmad-output/planning-artifacts/architecture.md

### Final Architecture Deliverables

**📋 Complete Architecture Document**

- 모든 아키텍처 결정사항 버전과 함께 문서화
- AI 에이전트 일관성 보장을 위한 구현 패턴
- 모든 파일과 디렉토리를 포함한 완전한 프로젝트 구조
- 요구사항-아키텍처 매핑

**🏗️ Implementation Ready Foundation**

- 30+ 아키텍처 결정사항
- 15+ 구현 패턴
- 8개 주요 아키텍처 컴포넌트
- 모든 요구사항 지원 확인

### Implementation Handoff

**AI Agent Guidelines:**

- 이 아키텍처 문서의 모든 결정사항을 정확히 따르세요
- 모든 컴포넌트에서 구현 패턴을 일관되게 사용하세요
- 프로젝트 구조와 경계를 준수하세요
- 아키텍처 관련 질문은 이 문서를 참조하세요

**First Implementation Priority:**

1. DJP 모듈 기본 구조 생성
2. PaddleOCR 서비스 Docker 설정
3. Bull Queue + Redis 통합
4. shadcn/ui 컴포넌트 마이그레이션

---

**Architecture Status:** READY FOR IMPLEMENTATION ✅

**Next Phase:** Epic/Story 생성 → Sprint Planning → 구현

**Document Maintenance:** 구현 중 주요 기술 결정 시 이 아키텍처 문서 업데이트
