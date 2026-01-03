# Story 1.2: Bull Queue + Redis 통합

Status: ready-for-dev

## Story

As a **Developer**,
I want Bull Queue와 Redis가 NestJS에 통합되도록,
So that 비동기 작업(DJP 제출, OCR 처리)을 큐로 처리할 수 있습니다.

## Acceptance Criteria

1. **Given** apps/api 프로젝트가 존재할 때
   **When** @nestjs/bull과 bull 패키지를 설치하면
   **Then** package.json에 의존성이 추가됩니다

2. **Given** Bull 패키지가 설치되었을 때
   **When** QueueModule을 생성하면
   **Then** apps/api/src/queue/queue.module.ts가 생성됩니다
   **And** BullModule.forRoot()로 Redis 연결이 설정됩니다

3. **Given** QueueModule이 생성되었을 때
   **When** Redis 연결 설정을 확인하면
   **Then** REDIS_HOST, REDIS_PORT 환경변수로 구성됩니다
   **And** 로컬 개발용 기본값이 설정됩니다 (localhost:6379)

4. **Given** Redis 연결이 설정되었을 때
   **When** 테스트용 큐(test-queue)를 생성하면
   **Then** 큐에 작업을 추가할 수 있습니다
   **And** 작업이 정상적으로 처리됩니다

5. **Given** 큐 처리가 동작할 때
   **When** 작업 추가/처리가 발생하면
   **Then** 로그에 작업 시작/완료가 기록됩니다

6. **Given** 모든 설정이 완료되었을 때
   **When** `npm run dev:api`를 실행하면
   **Then** Redis 연결 성공 로그가 출력됩니다
   **And** 빌드 에러 없이 정상 동작합니다

## Tasks / Subtasks

- [ ] Task 1: Bull Queue 의존성 설치 (AC: #1)
  - [ ] 1.1: @nestjs/bull 설치 (`npm install @nestjs/bull bull --save`)
  - [ ] 1.2: @types/bull 설치 (`npm install @types/bull --save-dev`)
  - [ ] 1.3: ioredis 설치 (`npm install ioredis --save`) - Bull 5.x 권장

- [ ] Task 2: Redis 환경변수 설정 (AC: #3)
  - [ ] 2.1: .env.example에 REDIS_HOST, REDIS_PORT 추가
  - [ ] 2.2: .env (로컬)에 localhost:6379 기본값 설정
  - [ ] 2.3: apps/api/src/config/ 디렉토리에 redis.config.ts 생성 (ConfigService 연동)

- [ ] Task 3: QueueModule 생성 (AC: #2)
  - [ ] 3.1: apps/api/src/queue/queue.module.ts 생성
  - [ ] 3.2: BullModule.forRootAsync() 설정 (ConfigService 사용)
  - [ ] 3.3: app.module.ts에 QueueModule import

- [ ] Task 4: 테스트 큐 구현 (AC: #4)
  - [ ] 4.1: apps/api/src/queue/test-queue.processor.ts 생성
  - [ ] 4.2: @Processor('test-queue') 데코레이터로 프로세서 등록
  - [ ] 4.3: @Process() 핸들러 구현 (간단한 로그 출력)
  - [ ] 4.4: apps/api/src/queue/test-queue.service.ts 생성 (작업 추가 메서드)

- [ ] Task 5: 로깅 설정 (AC: #5)
  - [ ] 5.1: 작업 시작 시 `Job started: {jobId}` 로그
  - [ ] 5.2: 작업 완료 시 `Job completed: {jobId}` 로그
  - [ ] 5.3: 작업 실패 시 `Job failed: {jobId}, error: {message}` 로그

- [ ] Task 6: 테스트 엔드포인트 생성 (AC: #4, #6)
  - [ ] 6.1: apps/api/src/queue/queue.controller.ts 생성
  - [ ] 6.2: POST /api/queue/test 엔드포인트 (테스트 작업 추가)
  - [ ] 6.3: Swagger 문서화

- [ ] Task 7: 빌드 및 연결 검증 (AC: #6)
  - [ ] 7.1: Docker로 Redis 실행 확인 (`docker run -d -p 6379:6379 redis:7-alpine`)
  - [ ] 7.2: `npm run dev:api` 실행하여 Redis 연결 확인
  - [ ] 7.3: POST /api/queue/test 호출하여 큐 동작 확인

## Dev Notes

### Architecture Compliance

**프로젝트 구조 (apps/api/src/):**
```
queue/                           # 신규 - Bull Queue 모듈
├── queue.module.ts              # Bull Queue 모듈 정의
├── queue.controller.ts          # 테스트용 컨트롤러
├── test-queue.service.ts        # 테스트 큐 서비스
├── test-queue.processor.ts      # 테스트 큐 프로세서
├── djp-submission.queue.ts      # (향후 Story 3-x에서 구현)
└── ocr-processing.queue.ts      # (향후 Story 2-x에서 구현)

config/                          # 설정 파일
└── redis.config.ts              # Redis 연결 설정
```

**기존 구조 참조 (apps/api/src/):**
```
repository/
├── prisma.service.ts
├── repository.module.ts
└── repositories/
    └── ...
```

### Library & Framework Requirements

**필수 의존성:**
```json
{
  "dependencies": {
    "@nestjs/bull": "^10.1.0",
    "bull": "^4.12.0",
    "ioredis": "^5.3.2"
  },
  "devDependencies": {
    "@types/bull": "^4.10.0"
  }
}
```

**버전 호환성:**
- NestJS 10.x와 @nestjs/bull 10.x 호환
- Bull 4.x + ioredis 5.x 권장 (Bull 5.x는 BullMQ로 별도)
- Redis 서버 6.x 이상 권장

### Technical Requirements

**Redis 연결 설정 패턴 (architecture.md 기준):**

```typescript
// apps/api/src/queue/queue.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';

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
    BullModule.registerQueue({ name: 'test-queue' }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
```

**프로세서 패턴:**

```typescript
// apps/api/src/queue/test-queue.processor.ts
import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

@Processor('test-queue')
export class TestQueueProcessor {
  private readonly logger = new Logger(TestQueueProcessor.name);

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(`Job started: ${job.id}, data: ${JSON.stringify(job.data)}`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    this.logger.log(`Job completed: ${job.id}, result: ${JSON.stringify(result)}`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job failed: ${job.id}, error: ${error.message}`);
  }

  @Process()
  async handleTestJob(job: Job<{ message: string }>) {
    this.logger.log(`Processing test job: ${job.id}`);

    // 시뮬레이션: 1초 대기
    await new Promise(resolve => setTimeout(resolve, 1000));

    return { processed: true, message: job.data.message };
  }
}
```

**서비스 패턴:**

```typescript
// apps/api/src/queue/test-queue.service.ts
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class TestQueueService {
  constructor(
    @InjectQueue('test-queue')
    private readonly testQueue: Queue,
  ) {}

  async addTestJob(data: { message: string }) {
    const job = await this.testQueue.add(data);
    return { jobId: job.id, status: 'queued' };
  }

  async getJobStatus(jobId: string) {
    const job = await this.testQueue.getJob(jobId);
    if (!job) return null;

    const state = await job.getState();
    return { jobId: job.id, state, data: job.data };
  }
}
```

### Environment Variables

```bash
# .env.example 추가 내용
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
# REDIS_PASSWORD=  # 프로덕션에서 사용
# REDIS_DB=0       # 기본 DB 번호
```

### Docker Compose 설정 (로컬 개발용)

```yaml
# docker-compose.yml (또는 docker-compose.dev.yml)에 추가
services:
  redis:
    image: redis:7-alpine
    container_name: ai-pajak-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  redis_data:
```

### File Structure Notes

**신규 파일 생성:**
- `apps/api/src/queue/queue.module.ts` - Bull Queue 모듈
- `apps/api/src/queue/queue.controller.ts` - 테스트 컨트롤러
- `apps/api/src/queue/test-queue.service.ts` - 테스트 서비스
- `apps/api/src/queue/test-queue.processor.ts` - 테스트 프로세서
- `apps/api/src/config/redis.config.ts` - Redis 설정 (선택)

**수정 필요 파일:**
- `apps/api/src/app.module.ts` - QueueModule import 추가
- `apps/api/.env.example` - REDIS_* 환경변수 추가
- `apps/api/package.json` - Bull 의존성 추가
- `docker-compose.yml` - Redis 서비스 추가 (없다면)

### Critical Implementation Rules

1. **ConfigService 사용**: 환경변수는 반드시 ConfigService를 통해 접근 (하드코딩 금지)
2. **기본값 설정**: 로컬 개발 편의를 위해 localhost:6379 기본값 필수
3. **에러 핸들링**: Redis 연결 실패 시 graceful 에러 메시지 출력
4. **BigInt 호환**: Job ID는 string으로 처리 (BigInt 직렬화 문제 방지)
5. **DI 패턴 준수**: @InjectQueue() 데코레이터로 큐 주입

### API 엔드포인트 (테스트용)

```typescript
// apps/api/src/queue/queue.controller.ts
import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TestQueueService } from './test-queue.service';

@ApiTags('Queue')
@Controller('queue')
export class QueueController {
  constructor(private readonly testQueueService: TestQueueService) {}

  @Post('test')
  @ApiOperation({ summary: 'Add test job to queue' })
  @ApiResponse({ status: 201, description: 'Job added successfully' })
  async addTestJob(@Body() data: { message: string }) {
    return this.testQueueService.addTestJob(data);
  }

  @Get('test/:jobId')
  @ApiOperation({ summary: 'Get test job status' })
  async getJobStatus(@Param('jobId') jobId: string) {
    return this.testQueueService.getJobStatus(jobId);
  }
}
```

### app.module.ts 수정 패턴

```typescript
// apps/api/src/app.module.ts
import { QueueModule } from './queue/queue.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // ... 기존 모듈들
    QueueModule, // 추가
  ],
})
export class AppModule {}
```

### Testing Commands

```bash
# 1. Redis 실행 (Docker)
docker run -d --name ai-pajak-redis -p 6379:6379 redis:7-alpine

# 2. API 서버 실행
npm run dev:api

# 3. 테스트 작업 추가
curl -X POST http://localhost:3000/api/queue/test \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello Queue!"}'

# 4. 작업 상태 확인 (jobId는 응답에서 확인)
curl http://localhost:3000/api/queue/test/{jobId}
```

### Future Queue Extensions (참고용)

이 스토리에서는 test-queue만 구현합니다. 향후 스토리에서 추가될 큐:

| 큐 이름 | 용도 | 스토리 |
|--------|------|--------|
| djp-submission | DJP SPT 제출 | Story 3.2 |
| ocr-processing | OCR 문서 처리 | Story 2.3 |
| bulk-submit | 일괄 제출 처리 | Story 4.2 |
| bpe-polling | BPE 다운로드 폴링 | Story 3.4 |
| notification | 알림 발송 | Story 7.x |

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#API & Communication Patterns - Queue System: Bull (Redis)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure & Boundaries - queue/ 디렉토리]
- [Source: _bmad-output/planning-artifacts/architecture.md#Infrastructure & Deployment - ElastiCache Redis]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.2: Bull Queue + Redis 통합]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

