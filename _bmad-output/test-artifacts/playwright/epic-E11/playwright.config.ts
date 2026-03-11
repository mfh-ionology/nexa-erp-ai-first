import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: process.env.FRONTEND_URL || 'http://localhost:5110',
    headless: true,
    screenshot: 'on',
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
  },
  reporter: [
    ['json', { outputFile: process.env.PW_RESULTS_FILE || './results.json' }],
    ['list'],
  ],
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
