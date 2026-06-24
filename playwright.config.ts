import { defineConfig } from '@playwright/test';

/**
 * Playwright config for the cross-service E2E scenarios in /e2e.
 * Run with: npx playwright test
 * The scenario steps are currently test.fixme(...) — see e2e/scenarios.spec.ts.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: process.env.BASE_URL_WEB ?? 'http://localhost:3010',
    trace: 'on-first-retry',
  },
});
