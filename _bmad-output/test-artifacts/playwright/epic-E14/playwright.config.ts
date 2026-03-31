import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 180000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  retries: 1,
  workers: 1,
  use: {
    baseURL: 'http://localhost:5110',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
    navigationTimeout: 60000,
  },
  reporter: [['list']],
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
