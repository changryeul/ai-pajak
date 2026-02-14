# Resilience Patterns Guide

> AI PAJAK의 장애 복원력(Resilience) 패턴 구현 가이드

## 개요

AI PAJAK은 외부 서비스(DJP, Midtrans, Email) 의존성에 대한 장애 복원력을 위해 다음 패턴을 구현합니다:

| 패턴 | 용도 | 위치 |
|------|------|------|
| Circuit Breaker | 장애 전파 방지 | `src/lib/resilience/circuit-breaker.ts` |
| Timeout + Retry | 타임아웃 및 재시도 | `src/lib/resilience/timeout.ts` |
| Idempotency | 중복 요청 방지 | `src/lib/resilience/idempotency.ts` |
| Request Context | 요청 추적 | `src/lib/request-context.ts` |
| Structured Logging | 구조화된 로깅 | `src/lib/logger.ts` |

---

## Circuit Breaker

### 개념

외부 서비스가 실패할 때 즉시 실패를 반환하여 시스템 자원을 보호합니다.

```
상태 전이:
CLOSED → (failures >= threshold) → OPEN
OPEN → (resetTimeout 경과) → HALF_OPEN
HALF_OPEN → (success) → CLOSED
HALF_OPEN → (failure) → OPEN
```

### 사용법

```typescript
import { circuitBreakers } from '@/lib/resilience/circuit-breaker';

// 미리 정의된 breaker 사용
const result = await circuitBreakers.djp.execute(async () => {
  return await callDJPAPI();
});

// 또는 새 breaker 생성
import { CircuitBreaker } from '@/lib/resilience/circuit-breaker';

const myBreaker = new CircuitBreaker('my-service', {
  failureThreshold: 5,    // 5번 실패 시 OPEN
  resetTimeout: 30000,    // 30초 후 HALF_OPEN
  failureWindow: 60000,   // 60초 내 실패 카운트
  successThreshold: 2,    // HALF_OPEN에서 2번 성공 시 CLOSED
});
```

### 사전 정의된 Breakers

| 이름 | 실패 임계값 | 리셋 타임아웃 | 용도 |
|------|------------|--------------|------|
| `djp` | 3 | 60초 | DJP 세무청 API |
| `midtrans` | 5 | 30초 | 결제 API |
| `email` | 3 | 60초 | 이메일 발송 |
| `ocr` | 3 | 30초 | OCR 서비스 |

### 에러 처리

```typescript
import { CircuitOpenError } from '@/lib/resilience/circuit-breaker';

try {
  const result = await circuitBreakers.djp.execute(callDJPAPI);
} catch (error) {
  if (error instanceof CircuitOpenError) {
    // 서비스 일시 중단 - 사용자에게 안내
    console.log(`서비스 재시도까지 ${error.retryAfter}ms 남음`);
    return getFallbackResponse();
  }
  throw error;
}
```

---

## Timeout + Retry

### 개념

외부 API 호출에 타임아웃과 지수 백오프 재시도를 적용합니다.

### 사용법

```typescript
import {
  withTimeout,
  withRetry,
  fetchWithTimeoutAndRetry
} from '@/lib/resilience/timeout';

// 단순 타임아웃
const result = await withTimeout(
  fetch('/api/data'),
  5000,
  'API 호출 타임아웃'
);

// 재시도 (지수 백오프)
const result = await withRetry(
  async () => await riskyOperation(),
  {
    maxRetries: 3,
    baseDelay: 1000,  // 1초, 2초, 4초 간격
    onRetry: (attempt, error) => {
      console.log(`재시도 ${attempt}: ${error.message}`);
    },
  }
);

// 통합: 타임아웃 + 재시도
const response = await fetchWithTimeoutAndRetry('/api/external', {
  method: 'POST',
  body: JSON.stringify(data),
  timeout: 10000,
  maxRetries: 2,
});
```

### 서비스별 타임아웃 설정

```typescript
import { serviceTimeouts } from '@/lib/resilience/timeout';

// 사전 정의된 타임아웃
serviceTimeouts.djp     // 30000ms (30초)
serviceTimeouts.midtrans // 15000ms (15초)
serviceTimeouts.email    // 10000ms (10초)
serviceTimeouts.ocr      // 60000ms (60초)
```

---

## Idempotency

### 개념

동일한 요청이 여러 번 전송되어도 한 번만 처리되도록 보장합니다.

### 사용법

```typescript
import { idempotencyManager } from '@/lib/resilience/idempotency';

// API 라우트에서 사용
export async function POST(request: NextRequest) {
  const idempotencyKey = request.headers.get('Idempotency-Key');
  const body = await request.json();

  // 캐시된 응답 확인
  if (idempotencyKey) {
    const cached = await idempotencyManager.get(idempotencyKey, body);
    if (cached) {
      return NextResponse.json(cached.response, {
        status: cached.statusCode,
        headers: { 'Idempotency-Replayed': 'true' },
      });
    }
  }

  // 실제 처리
  const result = await processPayment(body);

  // 성공 시 캐시 저장
  if (idempotencyKey) {
    await idempotencyManager.set(
      idempotencyKey,
      { response: result, statusCode: 200 },
      body
    );
  }

  return NextResponse.json(result);
}
```

### 클라이언트 사용

```typescript
// 클라이언트에서 Idempotency-Key 헤더 전송
const response = await fetch('/api/payment/initiate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Idempotency-Key': `payment-${transactionId}-${Date.now()}`,
  },
  body: JSON.stringify({ transactionId }),
});

// 재시도 시 동일한 키 사용
if (response.headers.get('Idempotency-Replayed') === 'true') {
  console.log('캐시된 응답 반환됨');
}
```

---

## Request Context

### 개념

요청 전체에 걸쳐 Request ID, 사용자 정보 등을 전파합니다.

### 사용법

```typescript
import {
  runWithRequestContext,
  getRequestContext
} from '@/lib/request-context';

// 미들웨어에서 컨텍스트 설정
const context = createRequestContext(request);
await runWithRequestContext(context, async () => {
  // 이 블록 내에서 컨텍스트 접근 가능
  await handleRequest();
});

// 어디서든 컨텍스트 접근
function anyFunction() {
  const ctx = getRequestContext();
  if (ctx) {
    console.log(`Request ID: ${ctx.requestId}`);
    console.log(`User ID: ${ctx.userId}`);
  }
}
```

### 컨텍스트 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `requestId` | string | 고유 요청 ID (UUID) |
| `method` | string | HTTP 메서드 |
| `path` | string | 요청 경로 |
| `userId` | string? | 인증된 사용자 ID |
| `userRole` | string? | 사용자 역할 |
| `startTime` | number | 요청 시작 시간 |
| `ip` | string? | 클라이언트 IP |

---

## Structured Logging

### 개념

JSON 형식의 구조화된 로그를 Pino를 사용하여 출력합니다.

### 사용법

```typescript
import { logger, loggers } from '@/lib/logger';

// 기본 로거
logger.info('서버 시작');
logger.error({ error: err }, '처리 실패');

// 모듈별 로거 (자동 module 필드 추가)
loggers.payment.info({ orderId: '123' }, '결제 시작');
loggers.djp.error({ error }, 'DJP API 호출 실패');
loggers.email.warn({ to: 'user@example.com' }, '이메일 발송 지연');

// Request Context 자동 포함
loggers.auth.info('로그인 성공');
// 출력: {"requestId":"abc-123","userId":"user-456","msg":"로그인 성공"}
```

### 로그 레벨

| 레벨 | 용도 | 메서드 |
|------|------|--------|
| `trace` | 상세 디버깅 | `logger.trace()` |
| `debug` | 디버깅 | `logger.debug()` |
| `info` | 정보 | `logger.info()` |
| `warn` | 경고 | `logger.warn()` |
| `error` | 에러 | `logger.error()` |
| `fatal` | 치명적 에러 | `logger.fatal()` |

### 에러 로깅 모범 사례

```typescript
// Good: 에러 객체와 컨텍스트 함께 전달
loggers.payment.error({
  error: err,
  orderId: '123',
  amount: 500000,
}, 'Payment processing failed');

// Bad: 에러 메시지만 전달
console.error('Payment failed: ' + err.message);
```

---

## 통합 예시

### DJP API 호출

```typescript
import { circuitBreakers } from '@/lib/resilience/circuit-breaker';
import { fetchWithTimeoutAndRetry } from '@/lib/resilience/timeout';
import { loggers } from '@/lib/logger';

export async function submitToDJP(filingData: TaxFiling) {
  loggers.djp.info({ filingId: filingData.id }, 'DJP 제출 시작');

  try {
    const response = await circuitBreakers.djp.execute(() =>
      fetchWithTimeoutAndRetry(`${DJP_API_URL}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(filingData),
        timeout: 30000,
        maxRetries: 2,
      })
    );

    loggers.djp.info({ filingId: filingData.id }, 'DJP 제출 성공');
    return response.json();

  } catch (error) {
    loggers.djp.error({ error, filingId: filingData.id }, 'DJP 제출 실패');
    throw error;
  }
}
```

### 결제 처리

```typescript
import { circuitBreakers } from '@/lib/resilience/circuit-breaker';
import { idempotencyManager } from '@/lib/resilience/idempotency';
import { loggers } from '@/lib/logger';

export async function initiatePayment(
  request: NextRequest
): Promise<Response> {
  const idempotencyKey = request.headers.get('Idempotency-Key');
  const body = await request.json();

  // 1. 멱등성 확인
  if (idempotencyKey) {
    const cached = await idempotencyManager.get(idempotencyKey, body);
    if (cached) {
      loggers.payment.info({ idempotencyKey }, 'Returning cached response');
      return NextResponse.json(cached.response, {
        status: cached.statusCode,
        headers: { 'Idempotency-Replayed': 'true' },
      });
    }
  }

  // 2. Circuit Breaker로 Midtrans 호출
  try {
    const result = await circuitBreakers.midtrans.execute(() =>
      MidtransService.createSnapTransaction(body)
    );

    // 3. 성공 응답 캐시
    if (idempotencyKey) {
      await idempotencyManager.set(
        idempotencyKey,
        { response: result, statusCode: 200 },
        body
      );
    }

    loggers.payment.info({ transactionId: body.transactionId }, 'Payment initiated');
    return NextResponse.json(result);

  } catch (error) {
    loggers.payment.error({ error }, 'Payment initiation failed');
    throw error;
  }
}
```

---

## 모니터링

### 헬스 체크

```bash
# 기본 헬스 체크
curl http://localhost:3000/api/health

# 상세 시스템 상태 (인증 필요)
curl -H "x-cron-secret: $CRON_SECRET" \
  http://localhost:3000/api/admin/system-status
```

### Circuit Breaker 상태 확인

```typescript
import { getCircuitBreakerHealth } from '@/lib/resilience/circuit-breaker';

const health = getCircuitBreakerHealth();
console.log(health);
// {
//   djp: { name: 'djp', state: 'CLOSED', failures: 0, ... },
//   midtrans: { name: 'midtrans', state: 'CLOSED', failures: 0, ... },
//   ...
// }
```

### 모니터링 대시보드

`/admin/monitoring` 페이지에서 실시간 모니터링:

- 전체 시스템 상태
- 서비스별 상태 및 레이턴시
- Circuit Breaker 상태
- 메모리 사용량

---

## 테스트

```bash
# 단위 테스트
npm test -- circuit-breaker
npm test -- timeout
npm test -- idempotency
npm test -- logger

# 전체 테스트
npm test
```

---

**Last Updated**: 2026-02-14
