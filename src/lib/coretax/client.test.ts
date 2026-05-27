/**
 * Unit tests for coretax client.
 *
 * isEnabled() is now DB-backed (Track D) — uses vi.mock to stub
 * getSupabaseAdmin so tests run hermetically without a real Supabase
 * connection. invalidateEnabledCache() is called in beforeEach for
 * isolation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isEnabled, invalidateEnabledCache, issueIdBilling } from './client';
import { CoretaxError } from './types';

// Mock getSupabaseAdmin — single() returns whatever mockSingle was configured to.
const mockSingle = vi.fn();
vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: mockSingle,
        }),
      }),
    }),
  }),
}));

// Helper to set env credentials (URL/token) since isEnabled still gates on them.
function setEnv(vars: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

describe('coretax client.isEnabled()', () => {
  beforeEach(() => {
    invalidateEnabledCache();
    mockSingle.mockReset();
  });

  afterEach(() => {
    setEnv({
      CORETAX_API_BASE_URL: undefined,
      CORETAX_API_TOKEN: undefined,
    });
  });

  it('returns false when system_setting row missing', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'no rows' } });
    setEnv({ CORETAX_API_BASE_URL: 'https://x', CORETAX_API_TOKEN: 't' });
    expect(await isEnabled()).toBe(false);
  });

  it('returns false when DB row says enabled=false', async () => {
    mockSingle.mockResolvedValue({ data: { value: { enabled: false } }, error: null });
    setEnv({ CORETAX_API_BASE_URL: 'https://x', CORETAX_API_TOKEN: 't' });
    expect(await isEnabled()).toBe(false);
  });

  it('returns false when DB says enabled but credentials missing', async () => {
    mockSingle.mockResolvedValue({ data: { value: { enabled: true } }, error: null });
    setEnv({ CORETAX_API_BASE_URL: undefined, CORETAX_API_TOKEN: 't' });
    expect(await isEnabled()).toBe(false);
  });

  it('returns true when DB enabled + URL + token all present', async () => {
    mockSingle.mockResolvedValue({ data: { value: { enabled: true } }, error: null });
    setEnv({ CORETAX_API_BASE_URL: 'https://api.test', CORETAX_API_TOKEN: 'tok' });
    expect(await isEnabled()).toBe(true);
  });

  it('caches result for repeated calls (DB query only once)', async () => {
    mockSingle.mockResolvedValue({ data: { value: { enabled: true } }, error: null });
    setEnv({ CORETAX_API_BASE_URL: 'https://x', CORETAX_API_TOKEN: 't' });
    await isEnabled();
    await isEnabled();
    await isEnabled();
    expect(mockSingle).toHaveBeenCalledTimes(1);
  });

  it('invalidateEnabledCache() forces re-read on next call', async () => {
    mockSingle.mockResolvedValue({ data: { value: { enabled: true } }, error: null });
    setEnv({ CORETAX_API_BASE_URL: 'https://x', CORETAX_API_TOKEN: 't' });
    await isEnabled();
    invalidateEnabledCache();
    await isEnabled();
    expect(mockSingle).toHaveBeenCalledTimes(2);
  });
});

describe('issueIdBilling', () => {
  beforeEach(() => {
    invalidateEnabledCache();
    mockSingle.mockReset();
  });

  afterEach(() => {
    setEnv({
      CORETAX_API_BASE_URL: undefined,
      CORETAX_API_TOKEN: undefined,
    });
    vi.restoreAllMocks();
  });

  it('throws CoretaxError(NOT_CONFIGURED) when API disabled', async () => {
    mockSingle.mockResolvedValue({ data: { value: { enabled: false } }, error: null });
    setEnv({ CORETAX_API_BASE_URL: 'https://api.test', CORETAX_API_TOKEN: 'tok' });
    await expect(issueIdBilling({
      npwp: '01234567890123', kap: '411124', kjs: '100', taxPeriod: '2025-01', amount: 1_000_000,
    })).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
  });

  it('returns response on 200', async () => {
    mockSingle.mockResolvedValue({ data: { value: { enabled: true } }, error: null });
    setEnv({ CORETAX_API_BASE_URL: 'https://api.test', CORETAX_API_TOKEN: 'tok' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(
      JSON.stringify({ billingCode: '820X', amount: 1_000_000, expiresAt: '2025-12-31T23:59:59Z', status: 'PENDING' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));
    const r = await issueIdBilling({
      npwp: '01234567890123', kap: '411124', kjs: '100', taxPeriod: '2025-01', amount: 1_000_000,
    });
    expect(r.billingCode).toBe('820X');
    expect(r.status).toBe('PENDING');
  });

  it('throws CoretaxError(HTTP) on 4xx without retry', async () => {
    mockSingle.mockResolvedValue({ data: { value: { enabled: true } }, error: null });
    setEnv({ CORETAX_API_BASE_URL: 'https://api.test', CORETAX_API_TOKEN: 'tok' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ error: 'invalid npwp' }),
      { status: 400 },
    ));
    await expect(issueIdBilling({
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
