/**
 * 01-navigation.spec.ts — Finance Module Navigation
 *
 * Verifies that all finance sub-pages load correctly when navigated to.
 * Uses REAL backend — no API mocking.
 */

import { test, expect } from '@playwright/test';

import { loginAndNavigateTo } from './helpers/auth';

test.describe('Finance Navigation', () => {
  test('finance dashboard loads at /finance', async ({ page }) => {
    await loginAndNavigateTo(page, '/finance');

    // The dashboard page renders a BriefingPage with title "Finance"
    await expect(
      page.getByRole('heading', { name: 'Finance' }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('chart of accounts page loads', async ({ page }) => {
    await loginAndNavigateTo(page, '/finance/chart-of-accounts');

    await expect(
      page.getByText('Chart of Accounts').first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('journals list page loads', async ({ page }) => {
    await loginAndNavigateTo(page, '/finance/journals');

    // EntityListPage renders a "New" button
    await expect(
      page.getByRole('button', { name: /New/i }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('bank accounts page loads', async ({ page }) => {
    await loginAndNavigateTo(page, '/finance/bank-accounts');

    await expect(
      page.getByText('Bank Accounts').first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('financial periods page loads', async ({ page }) => {
    await loginAndNavigateTo(page, '/finance/periods');

    await expect(
      page.getByText('Financial Periods').first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('finance settings page loads', async ({ page }) => {
    await loginAndNavigateTo(page, '/finance/settings');

    await expect(
      page.getByText('Finance Settings').first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('trial balance report page loads', async ({ page }) => {
    await loginAndNavigateTo(page, '/finance/reports/trial-balance');

    await expect(
      page.getByText('Trial Balance').first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('profit and loss report page loads', async ({ page }) => {
    await loginAndNavigateTo(page, '/finance/reports/profit-and-loss');

    await expect(
      page.getByText('Profit').first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('balance sheet report page loads', async ({ page }) => {
    await loginAndNavigateTo(page, '/finance/reports/balance-sheet');

    await expect(
      page.getByText('Balance Sheet').first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('no uncaught page errors on finance dashboard', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => {
      // Ignore benign errors (e.g. third-party or devtool-related)
      const msg = err.message;
      if (
        msg.includes('ResizeObserver') ||
        msg.includes('__REACT_DEVTOOLS') ||
        msg.includes('TanStack')
      ) {
        return;
      }
      errors.push(msg);
    });

    await loginAndNavigateTo(page, '/finance');

    await expect(
      page.getByRole('heading', { name: 'Finance' }),
    ).toBeVisible({ timeout: 15_000 });

    // Allow the page to settle
    await page.waitForTimeout(2000);

    expect(errors).toHaveLength(0);
  });
});
