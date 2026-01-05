# Story 2.1: PaddleOCR 서비스 API 연동

Status: done

## Story

As a **Developer**,
I want NestJS가 PaddleOCR 서비스와 통신하도록,
So that 문서 OCR 처리 요청을 전달할 수 있습니다.

## Acceptance Criteria

1. **Given** PaddleOCR Docker 서비스가 실행 중일 때 (Port 8080)
   **When** OcrModule의 paddleocr.client.ts를 통해 요청하면
   **Then** 이미지/PDF 파일을 PaddleOCR 서비스로 전송합니다

2. **Given** PaddleOCR 서비스에 파일이 전송될 때
   **When** OCR 처리가 완료되면
   **Then** OCR 결과(텍스트, 좌표, 신뢰도)를 JSON으로 수신합니다
   **And** 테이블 추출 결과(있는 경우)도 함께 수신합니다

3. **Given** OcrModule이 요청을 보낼 때
   **When** 타임아웃이 설정되면
   **Then** 30초 타임아웃이 적용됩니다
   **And** 지수 백오프 방식으로 3회 재시도 로직이 적용됩니다

4. **Given** PaddleOCR 서비스 연결이 실패할 때
   **When** 연결 시도가 이루어지면
   **Then** 적절한 에러(OcrServiceUnavailableException)가 반환됩니다
   **And** 에러 로그가 기록됩니다

5. **Given** OcrModule이 설정될 때
   **When** 환경 변수를 확인하면
   **Then** PADDLEOCR_SERVICE_URL 환경 변수로 서비스 URL이 설정됩니다
   **And** PADDLEOCR_TIMEOUT_MS 환경 변수로 타임아웃이 설정됩니다

## Tasks / Subtasks

- [x] Task 1: OcrModule 기본 구조 생성 (AC: #1, #5)
  - [x] 1.1: apps/api/src/ocr 디렉토리 생성
  - [x] 1.2: ocr.module.ts 생성 (NestJS 모듈 정의)
  - [x] 1.3: ConfigModule 연동으로 환경 변수 주입 설정
  - [x] 1.4: app.module.ts에 OcrModule 등록

- [x] Task 2: PaddleOCR 클라이언트 구현 (AC: #1, #2)
  - [x] 2.1: paddleocr.client.ts 생성 (@Injectable 서비스)
  - [x] 2.2: process() 메서드 구현 (파일 전송)
  - [x] 2.3: FormData 생성 및 multipart/form-data 전송
  - [x] 2.4: healthCheck() 메서드 구현 (서비스 상태 확인)
  - [x] 2.5: getInfo() 메서드 구현 (모델 정보 조회)

- [x] Task 3: 타임아웃 및 재시도 로직 구현 (AC: #3)
  - [x] 3.1: AbortSignal.timeout() 으로 30초 타임아웃 설정
  - [x] 3.2: 지수 백오프 재시도 로직 구현 (3회, delay: 1s → 2s → 4s)
  - [x] 3.3: 재시도 가능 에러 분류 (네트워크 에러, 5xx 응답)
  - [x] 3.4: 재시도 로깅 (시도 횟수, 에러 메시지)

- [x] Task 4: 에러 처리 및 커스텀 예외 (AC: #4)
  - [x] 4.1: OcrServiceUnavailableException 생성
  - [x] 4.2: OcrProcessingException 생성
  - [x] 4.3: OcrTimeoutException 생성
  - [x] 4.4: 에러 핸들링 로직 및 로깅

- [x] Task 5: 타입 정의 및 DTO 생성 (AC: #2)
  - [x] 5.1: OcrResult 인터페이스 정의
  - [x] 5.2: OcrResponse 인터페이스 정의
  - [x] 5.3: TableResult, TableCell 인터페이스 정의
  - [x] 5.4: ProcessOcrDto (요청 DTO) 정의

- [x] Task 6: 테스트 작성 (AC: #1-4)
  - [x] 6.1: paddleocr.client.spec.ts 단위 테스트
  - [x] 6.2: Mock HTTP 응답으로 성공 케이스 테스트
  - [x] 6.3: 타임아웃 및 재시도 테스트
  - [x] 6.4: 에러 핸들링 테스트

## Dev Notes

### Architecture Compliance

**프로젝트 구조 (apps/api/src/ocr/):**
```
apps/api/src/ocr/
├── ocr.module.ts           # 모듈 정의
├── paddleocr.client.ts     # PaddleOCR HTTP 클라이언트 (핵심)
├── dto/
│   ├── process-ocr.dto.ts  # 요청 DTO
│   └── ocr-response.dto.ts # 응답 DTO
├── types/
│   └── ocr.types.ts        # TypeScript 인터페이스
└── exceptions/
    ├── ocr-service-unavailable.exception.ts
    ├── ocr-processing.exception.ts
    └── ocr-timeout.exception.ts
```

**아키텍처 문서 참조:**
- [Source: architecture.md#API & Communication Patterns]
- NestJS → PaddleOCR: HTTP REST, Port 8080, Timeout 30초, Retry 3회

### Technical Requirements

**PaddleOCR 서비스 API 스펙 (Story 1-3에서 구현됨):**

| Endpoint | Method | Description | Request | Response |
|----------|--------|-------------|---------|----------|
| `/ocr/process` | POST | 이미지/PDF OCR | `multipart/form-data` file | `OcrResponse` |
| `/health` | GET | 헬스체크 | - | `{"status": "healthy"}` |
| `/info` | GET | 모델 정보 | - | `{"version": "PP-OCRv5", ...}` |

**OcrResponse 스키마 (PaddleOCR 서비스에서 반환):**
```typescript
interface OcrResponse {
  success: boolean;
  processing_time_ms: number;
  results: OcrResult[];
  tables?: TableResult[];
  engine: 'PADDLEOCR';
  model_version: string;
}

interface OcrResult {
  text: string;
  confidence: number;
  bbox: number[][];  // [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
  page: number;
}

interface TableResult {
  page: number;
  cells: TableCell[];
  bbox?: number[][];
  html?: string;
}

interface TableCell {
  row: number;
  col: number;
  text: string;
  confidence: number;
}
```

### Library & Framework Requirements

**필요한 패키지 (기존 설치됨):**
- `@nestjs/common`, `@nestjs/config` - NestJS 기본
- `undici` 또는 Node.js built-in `fetch` - HTTP 클라이언트

**환경 변수:**
```env
PADDLEOCR_SERVICE_URL=http://localhost:8080
PADDLEOCR_TIMEOUT_MS=30000
```

### File Structure Notes

**신규 생성 파일:**
- apps/api/src/ocr/ocr.module.ts
- apps/api/src/ocr/paddleocr.client.ts
- apps/api/src/ocr/types/ocr.types.ts
- apps/api/src/ocr/dto/process-ocr.dto.ts
- apps/api/src/ocr/dto/ocr-response.dto.ts
- apps/api/src/ocr/exceptions/ocr-service-unavailable.exception.ts
- apps/api/src/ocr/exceptions/ocr-processing.exception.ts
- apps/api/src/ocr/exceptions/ocr-timeout.exception.ts

**수정 파일:**
- apps/api/src/app.module.ts (OcrModule 추가)
- .env.example (PADDLEOCR_* 환경 변수 추가)

### Critical Implementation Patterns

**1. PaddleOCR 클라이언트 구현 패턴:**
```typescript
@Injectable()
export class PaddleOcrClient {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly maxRetries = 3;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get('PADDLEOCR_SERVICE_URL', 'http://localhost:8080');
    this.timeout = this.configService.get('PADDLEOCR_TIMEOUT_MS', 30000);
  }

  async process(file: Buffer, mimeType: string, filename: string): Promise<OcrResponse> {
    const formData = new FormData();
    const blob = new Blob([file], { type: mimeType });
    formData.append('file', blob, filename);

    return this.fetchWithRetry(`${this.baseUrl}/ocr/process`, {
      method: 'POST',
      body: formData,
    });
  }

  private async fetchWithRetry(url: string, options: RequestInit, attempt = 1): Promise<OcrResponse> {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        if (response.status >= 500 && attempt < this.maxRetries) {
          return this.retryWithBackoff(url, options, attempt);
        }
        throw new OcrProcessingException(`OCR failed: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      if (error.name === 'TimeoutError') {
        if (attempt < this.maxRetries) {
          return this.retryWithBackoff(url, options, attempt);
        }
        throw new OcrTimeoutException('OCR request timed out after retries');
      }

      if (this.isNetworkError(error) && attempt < this.maxRetries) {
        return this.retryWithBackoff(url, options, attempt);
      }

      throw new OcrServiceUnavailableException('PaddleOCR service unavailable');
    }
  }

  private async retryWithBackoff(url: string, options: RequestInit, attempt: number): Promise<OcrResponse> {
    const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
    await new Promise(resolve => setTimeout(resolve, delay));
    return this.fetchWithRetry(url, options, attempt + 1);
  }

  private isNetworkError(error: unknown): boolean {
    return error instanceof TypeError && error.message.includes('fetch');
  }
}
```

**2. 에러 처리 패턴 (기존 API 패턴 준수):**
```typescript
// apps/api/src/ocr/exceptions/ocr-service-unavailable.exception.ts
import { ServiceUnavailableException } from '@nestjs/common';

export class OcrServiceUnavailableException extends ServiceUnavailableException {
  constructor(message = 'OCR service is unavailable') {
    super({
      statusCode: 503,
      message,
      error: 'Service Unavailable',
    });
  }
}
```

**3. 모듈 등록 패턴:**
```typescript
// apps/api/src/ocr/ocr.module.ts
@Module({
  imports: [ConfigModule],
  providers: [PaddleOcrClient],
  exports: [PaddleOcrClient],
})
export class OcrModule {}

// apps/api/src/app.module.ts
@Module({
  imports: [
    // ... existing modules
    OcrModule,
  ],
})
export class AppModule {}
```

### Testing Requirements

**단위 테스트 (paddleocr.client.spec.ts):**
```typescript
describe('PaddleOcrClient', () => {
  it('should successfully process an image', async () => {
    // Mock fetch with successful response
  });

  it('should retry on 5xx errors', async () => {
    // Mock fetch to fail twice then succeed
  });

  it('should throw OcrTimeoutException after max retries', async () => {
    // Mock fetch to always timeout
  });

  it('should throw OcrServiceUnavailableException on network error', async () => {
    // Mock fetch to throw TypeError
  });
});
```

### Previous Story Learnings (Story 1-3)

**PaddleOCR 서비스 상세:**
- Port: 8080
- Endpoints: `/ocr/process`, `/health`, `/info`
- 지원 파일 형식: image/jpeg, image/png, application/pdf
- 최대 파일 크기: 10MB
- 응답 포함: text, confidence, bbox, tables

**적용할 패턴:**
- FormData로 multipart/form-data 전송
- CORS_ORIGINS 환경 변수로 NestJS API URL 설정됨
- 신뢰도 85% 미만 시 Gemini fallback 트리거 (다음 스토리에서 구현)

### Git Intelligence

**최근 커밋 패턴 (Epic 1):**
- 0409c74: epic 1 finished
- 모듈 구조: module.ts, service.ts, controller.ts, dto/, types/
- 테스트 파일: *.spec.ts

**코드 컨벤션:**
- camelCase 함수/변수
- PascalCase 클래스/인터페이스
- kebab-case 파일명

### Architecture Document References

- [Source: architecture.md#Project Structure & Boundaries]
- [Source: architecture.md#API & Communication Patterns - NestJS → PaddleOCR]
- [Source: architecture.md#Error Handling Standards]
- [Source: prd.md#FR-2: PaddleOCR 통합]
- [Source: epics.md#Story 2.1: PaddleOCR 서비스 API 연동]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - 구현 시 주요 이슈 없음

### Completion Notes List

1. **OcrModule 구조 완성**: NestJS 모듈 패턴에 따라 `ocr.module.ts` 생성, `app.module.ts`에 등록
2. **PaddleOcrClient 구현**: `process()`, `healthCheck()`, `getInfo()` 메서드 구현
3. **재시도 로직**: 지수 백오프 방식 (1s → 2s → 4s), 최대 3회 재시도, 5xx/네트워크 에러/타임아웃 시 재시도
4. **커스텀 예외 클래스**: `OcrServiceUnavailableException`, `OcrProcessingException`, `OcrTimeoutException` 구현
5. **타입 정의**: `OcrResponse`, `OcrResult`, `TableResult`, `TableCell` 인터페이스 정의
6. **환경 변수**: `PADDLEOCR_SERVICE_URL`, `PADDLEOCR_TIMEOUT_MS` 설정 (.env에 추가)
7. **테스트**: 17개 단위 테스트 작성 및 통과 (paddleocr.client.spec.ts, ocr.module.spec.ts)

### File List

**New Files:**
- apps/api/src/ocr/ocr.module.ts
- apps/api/src/ocr/ocr.module.spec.ts
- apps/api/src/ocr/paddleocr.client.ts
- apps/api/src/ocr/paddleocr.client.spec.ts
- apps/api/src/ocr/index.ts
- apps/api/src/ocr/types/ocr.types.ts
- apps/api/src/ocr/dto/process-ocr.dto.ts
- apps/api/src/ocr/dto/ocr-response.dto.ts
- apps/api/src/ocr/dto/index.ts
- apps/api/src/ocr/exceptions/ocr-service-unavailable.exception.ts
- apps/api/src/ocr/exceptions/ocr-processing.exception.ts
- apps/api/src/ocr/exceptions/ocr-timeout.exception.ts
- apps/api/src/ocr/exceptions/index.ts

**Modified Files:**
- apps/api/src/app.module.ts (OcrModule import 추가)
- apps/api/.env (PADDLEOCR_SERVICE_URL, PADDLEOCR_TIMEOUT_MS 추가)
- apps/api/.env.example (PADDLEOCR_SERVICE_URL, PADDLEOCR_TIMEOUT_MS 추가) [Code Review]
- .env (PADDLEOCR_SERVICE_URL, PADDLEOCR_TIMEOUT_MS 추가)

## Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.5 (Amelia - Dev Agent)
**Date:** 2026-01-04
**Outcome:** ✅ APPROVED (이슈 수정 완료)

### 발견된 이슈 및 수정 사항

| 심각도 | 이슈 | 수정 내용 |
|--------|------|----------|
| HIGH | `.env.example`에 PADDLEOCR 환경 변수 누락 | `apps/api/.env.example`에 추가 |
| HIGH | 재시도 로직 Off-by-One 에러 (2회만 재시도됨) | `attempt <= maxRetries`로 수정 (3회 재시도) |
| MEDIUM | `process()` 입력값 검증 없음 | `validateProcessInput()` 메서드 추가 |
| MEDIUM | `OcrResponseDto` 검증 데코레이터 없음 | class-validator 데코레이터 추가 |
| MEDIUM | 에러 타입 체크 취약 | `isTimeoutError()` 메서드 추가 (AbortError 포함) |
| LOW | 로깅 일관성 부족 (healthCheck vs getInfo) | getInfo도 warn 레벨로 통일 |

### 테스트 결과
- **Before:** 17 tests passed
- **After:** 22 tests passed (+5 input validation tests)

### 추가된 테스트
1. 빈 파일 Buffer 검증
2. 빈 filename 검증
3. 공백만 있는 filename 검증
4. 지원하지 않는 MIME type 검증
5. 지원하는 MIME type 수락 확인

## Change Log

- 2026-01-04: Code Review 완료 - 10개 이슈 수정, 5개 테스트 추가, done 상태로 설정
- 2026-01-04: Story 2-1 구현 완료 - review 상태로 설정
- 2026-01-04: Story 2-1 생성 - ready-for-dev 상태로 설정
