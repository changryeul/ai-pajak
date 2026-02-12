import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

// Store env vars for worker processes - these will be passed to test workers
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.TEST_SUPABASE_SERVICE_ROLE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;

/**
 * Playwright Configuration for AI Pajak E2E Tests
 *
 * Role-Based Access Control (RBAC) Testing
 * - CUSTOMER: Can create POA, cannot file tax
 * - CONSULTANT_JTC: Can calculate tax, cannot file tax
 * - TAX_ADVISOR_JTC: Can file tax (with active POA only)
 * - PLATFORM_ADMIN: Cannot access tax data
 * - SYSTEM: Can create billing, cannot access tax data
 */

export default defineConfig({
  testDir: './src/tests/e2e',
  globalSetup: './src/tests/e2e/global-setup.ts',

  /* Timeout settings */
  timeout: 60 * 1000, // 60 seconds per test (increased from 30s)
  expect: {
    timeout: 10 * 1000, // 10 seconds for expect assertions
  },

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry failed tests */
  retries: process.env.CI ? 2 : 2, // 2 retries for both local and CI to handle flaky timeouts

  /* Workers configuration */
  workers: process.env.CI ? 1 : 2, // 2 parallel workers locally to reduce server load

  /* Reporter to use */
  reporter: [
    ['html'],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }]
  ],

  /* Shared settings for all the projects below */
  use: {
    /* Base URL to use in actions like `await page.goto('/')` */
    baseURL: process.env.BASE_URL || 'http://localhost:3000',

    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',

    /* Action timeout */
    actionTimeout: 30 * 1000, // 30 seconds for actions (tax filing can be slow)

    /* API request configuration */
    extraHTTPHeaders: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  },

  /* Configure projects for different test types */
  projects: [
    {
      name: 'API Tests - RBAC',
      testMatch: /.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        // API-only tests don't need browser
        headless: true,
      },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180 * 1000, // 3 minutes for server startup
    stdout: 'ignore',
    stderr: 'pipe',
  },

  /* Global setup timeout */
  globalTimeout: 10 * 60 * 1000, // 10 minutes for all tests
});
