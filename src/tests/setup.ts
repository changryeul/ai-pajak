/// <reference types="vitest/globals" />
/**
 * Test Setup
 *
 * Global setup for Vitest tests
 */

import '@testing-library/jest-dom/vitest';
import { beforeAll, afterAll, vi } from 'vitest';

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.RESEND_API_KEY = 're_test_key';

// Mock console methods during tests
beforeAll(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterAll(() => {
  vi.restoreAllMocks();
});
