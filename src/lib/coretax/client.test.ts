/**
 * Coretax client — graceful-degrade + retry + 에러 매핑 회귀.
 *
 * fetch mock으로 외부 호출을 가짜로 만들고 isEnabled / 호출 / 실패 분기를 검증.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CoretaxError } from './types';
import * as coretax from './client';

const ORIGINAL_ENV = { ...process.env };

function setEnv(env: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe('isEnabled', () => {
  it('returns false when CORETAX_SUBMIT_ENABLED is not "true"', () => {
    setEnv({ CORETAX_SUBMIT_ENABLED: undefined, CORETAX_API_BASE_URL: 'https://x', CORETAX_API_TOKEN: 't' });
    expect(coretax.isEnabled()).toBe(false);
  });

  it('returns false when ENABLED=true but base URL missing', () => {
    setEnv({ CORETAX_SUBMIT_ENABLED: 'true', CORETAX_API_BASE_URL: undefined, CORETAX_API_TOKEN: 't' });
    expect(coretax.isEnabled()).toBe(false);
  });

  it('returns true when all three env vars are set', () => {
    setEnv({ CORETAX_SUBMIT_ENABLED: 'true', CORETAX_API_BASE_URL: 'https://x', CORETAX_API_TOKEN: 't' });
    expect(coretax.isEnabled()).toBe(true);
  });
});

describe('issueIdBilling', () => {
  beforeEach(() => {
    setEnv({ CORETAX_SUBMIT_ENABLED: 'true', CORETAX_API_BASE_URL: 'https://api.test', CORETAX_API_TOKEN: 'tok' });
  });

  it('throws CoretaxError(NOT_CONFIGURED) when API disabled', async () => {
    setEnv({ CORETAX_SUBMIT_ENABLED: undefined });
    await expect(coretax.issueIdBilling({
      npwp: '01234567890123', kap: '411124', kjs: '100', taxPeriod: '2025-01', amount: 1_000_000,
    })).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
  });

  it('returns response on 200', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(
      JSON.stringify({ billingCode: '820X', amount: 1_000_000, expiresAt: '2025-12-31T23:59:59Z', status: 'PENDING' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));
    const r = await coretax.issueIdBilling({
      npwp: '01234567890123', kap: '411124', kjs: '100', taxPeriod: '2025-01', amount: 1_000_000,
    });
    expect(r.billingCode).toBe('820X');
    expect(r.status).toBe('PENDING');
  });

  it('throws CoretaxError(HTTP) on 4xx without retry', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ error: 'invalid npwp' }),
      { status: 400 },
    ));
    await expect(coretax.issueIdBilling({
      npwp: 'bad', kap: '411124', kjs: '100', taxPeriod: '2025-01', amount: 1_000_000,
    })).rejects.toMatchObject({ code: 'HTTP', httpStatus: 400 });
    // 4xx는 retry 없음 — fetch는 1회만 호출.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe('CoretaxError', () => {
  it('exposes code and httpStatus', () => {
    const e = new CoretaxError('boom', 'HTTP', 502, 'gateway down');
    expect(e.code).toBe('HTTP');
    expect(e.httpStatus).toBe(502);
    expect(e.responseBody).toBe('gateway down');
  });
});
