/**
 * Coretax API client (graceful-degrade adapter).
 *
 * 환경변수:
 *   CORETAX_SUBMIT_ENABLED  — 'true'면 client.isEnabled() === true. 호출 시 실제 API 호출.
 *   CORETAX_API_BASE_URL    — 예: https://api-coretax.pajak.go.id
 *   CORETAX_API_TOKEN       — Bearer token
 *   CORETAX_API_TIMEOUT_MS  — 단일 호출 timeout (default 15_000)
 *
 * 환경변수가 없거나 ENABLED=false 인 경우 isEnabled()=false 를 돌려주고, 호출 시
 * CoretaxError(code='NOT_CONFIGURED')를 던진다. 호출 측에서 manual 모드로 fallback.
 *
 * 실패 회복:
 *   - 단일 호출 timeout → 최대 2회 재시도 (지수 백오프)
 *   - 5회 연속 실패 → 30초간 circuit OPEN (CoretaxError code='NETWORK')
 *   - HTTP 4xx/5xx → 재시도 없이 즉시 CoretaxError code='HTTP' 던짐
 */

import { CircuitBreaker, withRetry, fetchWithTimeout } from '@/lib/resilience';
import { loggers } from '@/lib/logger';
import {
  CoretaxError,
  type IssueIdBillingRequest,
  type IssueIdBillingResponse,
  type SubmitSptRequest,
  type SubmitSptResponse,
  type GetNtpnResponse,
} from './types';

const breaker = new CircuitBreaker('coretax', {
  failureThreshold: 5,
  resetTimeout: 30_000,
  failureWindow: 60_000,
});

interface CoretaxClientConfig {
  baseUrl: string | undefined;
  token: string | undefined;
  timeoutMs: number;
}

function readConfig(): CoretaxClientConfig {
  return {
    baseUrl: process.env.CORETAX_API_BASE_URL,
    token: process.env.CORETAX_API_TOKEN,
    timeoutMs: Number(process.env.CORETAX_API_TIMEOUT_MS ?? 15_000),
  };
}

export function isEnabled(): boolean {
  if (process.env.CORETAX_SUBMIT_ENABLED !== 'true') return false;
  const cfg = readConfig();
  return !!(cfg.baseUrl && cfg.token);
}

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  if (!isEnabled()) {
    throw new CoretaxError('Coretax API is not configured (set CORETAX_SUBMIT_ENABLED=true + CORETAX_API_BASE_URL + CORETAX_API_TOKEN)', 'NOT_CONFIGURED');
  }
  const cfg = readConfig();
  const url = `${cfg.baseUrl!.replace(/\/$/, '')}${path}`;

  const wrapped = async (): Promise<T> => {
    const res = await fetchWithTimeout(url, {
      method,
      timeout: cfg.timeoutMs,
      headers: {
        'Authorization': `Bearer ${cfg.token!}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new CoretaxError(`Coretax HTTP ${res.status}: ${text.slice(0, 200)}`, 'HTTP', res.status, text);
    }
    return res.json() as Promise<T>;
  };

  return breaker.execute(() => withRetry(wrapped, {
    maxRetries: 2,
    baseDelay: 500,
    maxDelay: 4_000,
    backoffFactor: 2,
    // HTTP 에러는 재시도하지 않음 (4xx는 우리 잘못, 5xx는 즉시 알리는 게 좋다).
    shouldRetry: (err) => err instanceof CoretaxError ? err.code !== 'HTTP' : true,
    onRetry: (err, attempt, delay) => {
      loggers.api.warn({ err: err.message, attempt, delayMs: delay, path }, 'Coretax retry');
    },
  }));
}

/**
 * POST /api/billing  → ID Billing 발행 요청.
 * 응답: { billingCode, amount, expiresAt, status }.
 */
export async function issueIdBilling(req: IssueIdBillingRequest): Promise<IssueIdBillingResponse> {
  return call<IssueIdBillingResponse>('POST', '/api/billing', req);
}

/**
 * GET /api/billing/:code  → 납부 상태 + NTPN 조회.
 */
export async function getNtpn(billingCode: string): Promise<GetNtpnResponse> {
  return call<GetNtpnResponse>('GET', `/api/billing/${encodeURIComponent(billingCode)}/ntpn`);
}

/**
 * POST /api/spt/submit  → SPT 제출 + BPE 발급.
 */
export async function submitSpt(req: SubmitSptRequest): Promise<SubmitSptResponse> {
  return call<SubmitSptResponse>('POST', '/api/spt/submit', req);
}

export { breaker as coretaxBreaker };
