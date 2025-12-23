import { defineConfig, devices } from '@playwright/test';

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
  testDir: './tests/e2e',

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests on CI */
  workers: process.env.CI ? 1 : undefined,

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
    timeout: 120 * 1000,
  },
});
