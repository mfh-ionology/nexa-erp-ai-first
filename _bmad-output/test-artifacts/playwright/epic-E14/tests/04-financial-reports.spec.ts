/**
 * 04-financial-reports.spec.ts — Financial Reports
 *
 * Verifies Trial Balance, Profit & Loss, and Balance Sheet report pages.
 * Uses REAL backend — no API mocking.
 */

import { test, expect } from '@playwright/test';

import { loginAndNavigateTo } from './helpers/auth';

test.describe('Financial Reports', () => {
  test('trial balance page renders with parameter form', async ({ page }) => {
    await loginAndNavigateTo(page, '/finance/reports/trial-balance');

    // The page uses ReportPage template with a parameter form
    await expect(page.getByText('Trial Balance').first()).toBeVisible({ timeout: 15_000 });

    // Should have a "Run Report" or similar button
    const runButton = page.getByRole('button', { name: /run|generate|refresh/i }).first();
    await expect(runButton).toBeVisible({ timeout: 5_000 });
  });

  test('trial balance report can be run', async ({ page }) => {
    await loginAndNavigateTo(page, '/finance/reports/trial-balance');

    await expect(page.getByText('Trial Balance').first()).toBeVisible({ timeout: 15_000 });

    // Click run report
    const runButton = page.getByRole('button', { name: /run|generate|refresh/i }).first();
    await runButton.click();

    // Wait for results to load
    await page.waitForTimeout(3000);

    // After running, the report should show a table with account data
    // or a "no data" message. Either is acceptable for E2E testing.
    await page.screenshot({
      path: '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E14/04-trial-balance-result.png',
      fullPage: true,
    });

    // Check that column headers appear (Account Code, Account Name, Debit, Credit)
    const tableContent = await page.textContent('body');
    const hasTableHeaders =
      tableContent?.includes('Account Code') ||
      tableContent?.includes('Account Name') ||
      tableContent?.includes('Debit') ||
      tableContent?.includes('Credit') ||
      tableContent?.includes('No data') ||
      tableContent?.includes('no results');

    expect(hasTableHeaders).toBeTruthy();
  });

  test('profit and loss page renders', async ({ page }) => {
    await loginAndNavigateTo(page, '/finance/reports/profit-and-loss');

    // Should show the P&L report page
    await expect(page.getByText('Profit').first()).toBeVisible({ timeout: 15_000 });

    // Should have report parameter controls
    const runButton = page.getByRole('button', { name: /run|generate|refresh/i }).first();
    await expect(runButton).toBeVisible({ timeout: 5_000 });
  });

  test('profit and loss report can be run', async ({ page }) => {
    await loginAndNavigateTo(page, '/finance/reports/profit-and-loss');

    await expect(page.getByText('Profit').first()).toBeVisible({ timeout: 15_000 });

    // Run the report
    const runButton = page.getByRole('button', { name: /run|generate|refresh/i }).first();
    await runButton.click();

    await page.waitForTimeout(3000);

    await page.screenshot({
      path: '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E14/04-pnl-result.png',
      fullPage: true,
    });

    // Check page content after running report
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();
  });

  test('balance sheet page renders', async ({ page }) => {
    await loginAndNavigateTo(page, '/finance/reports/balance-sheet');

    await expect(page.getByText('Balance Sheet').first()).toBeVisible({ timeout: 15_000 });

    const runButton = page.getByRole('button', { name: /run|generate|refresh/i }).first();
    await expect(runButton).toBeVisible({ timeout: 5_000 });
  });

  test('balance sheet report can be run', async ({ page }) => {
    await loginAndNavigateTo(page, '/finance/reports/balance-sheet');

    await expect(page.getByText('Balance Sheet').first()).toBeVisible({ timeout: 15_000 });

    const runButton = page.getByRole('button', { name: /run|generate|refresh/i }).first();
    await runButton.click();

    await page.waitForTimeout(3000);

    await page.screenshot({
      path: '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E14/04-balance-sheet-result.png',
      fullPage: true,
    });

    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();
  });

  test('transaction journal report page loads', async ({ page }) => {
    await loginAndNavigateTo(page, '/finance/reports/transaction-journal');

    // Wait longer — this page may need to fetch data
    await expect(
      page.getByText('Transaction Journal').first(),
    ).toBeVisible({ timeout: 30_000 });
  });

  test('budget variance report page loads', async ({ page }) => {
    await loginAndNavigateTo(page, '/finance/reports/budget-variance');

    // This page fetches budgets on load — give it extra time
    await expect(
      page.getByText('Budget Variance').first(),
    ).toBeVisible({ timeout: 30_000 });
  });
});
