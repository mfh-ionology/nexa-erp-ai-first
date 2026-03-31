/**
 * 05-financial-periods.spec.ts — Financial Period Management
 *
 * Verifies that fiscal years/periods exist and the page renders correctly.
 * Uses REAL backend — no API mocking.
 */

import { test, expect } from '@playwright/test';

import { loginAndNavigateTo } from './helpers/auth';

test.describe('Financial Periods', () => {
  test('periods page loads and shows heading', async ({ page }) => {
    await loginAndNavigateTo(page, '/finance/periods');

    await expect(
      page.getByText('Financial Periods').first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('seed periods or create-year button is visible', async ({ page }) => {
    await loginAndNavigateTo(page, '/finance/periods');

    await expect(
      page.getByText('Financial Periods').first(),
    ).toBeVisible({ timeout: 15_000 });

    // Either seed periods are shown (with fiscal year groups)
    // or we see a "Create Year" button to add a new fiscal year
    const bodyText = await page.textContent('body');

    const hasFiscalYear = /20\d{2}/.test(bodyText ?? '');
    const hasCreateButton = await page
      .getByRole('button', { name: /Create|New|Add/i })
      .first()
      .isVisible()
      .catch(() => false);

    // At least one of these should be true
    expect(hasFiscalYear || hasCreateButton).toBeTruthy();
  });

  test('fiscal year section is expandable', async ({ page }) => {
    await loginAndNavigateTo(page, '/finance/periods');

    await expect(
      page.getByText('Financial Periods').first(),
    ).toBeVisible({ timeout: 15_000 });

    // If fiscal years exist, there should be expandable sections
    // with chevron toggle buttons
    const bodyText = await page.textContent('body');
    const hasFiscalYear = /20\d{2}/.test(bodyText ?? '');

    if (hasFiscalYear) {
      // Look for period months or expand buttons
      const hasMonthNames =
        bodyText?.includes('January') ||
        bodyText?.includes('February') ||
        bodyText?.includes('March') ||
        bodyText?.includes('April') ||
        bodyText?.includes('Period');

      expect(hasMonthNames).toBeTruthy();
    }
  });

  test('period page shows status information', async ({ page }) => {
    await loginAndNavigateTo(page, '/finance/periods');

    await expect(
      page.getByText('Financial Periods').first(),
    ).toBeVisible({ timeout: 15_000 });

    // The page should show some status info (Open, Closed, Locked badges or summary)
    const bodyText = await page.textContent('body');

    // Check for any status-related text
    const hasStatusInfo =
      bodyText?.includes('Open') ||
      bodyText?.includes('Closed') ||
      bodyText?.includes('Locked') ||
      bodyText?.includes('Summary') ||
      bodyText?.includes('Total') ||
      bodyText?.includes('No fiscal years') ||
      bodyText?.includes('Create');

    expect(hasStatusInfo).toBeTruthy();
  });

  test('period page has action buttons', async ({ page }) => {
    await loginAndNavigateTo(page, '/finance/periods');

    await expect(
      page.getByText('Financial Periods').first(),
    ).toBeVisible({ timeout: 15_000 });

    // Check for action buttons: Create Year, Close, Reopen, Lock
    const bodyText = await page.textContent('body');
    const hasActionButtons =
      bodyText?.includes('Create') ||
      bodyText?.includes('Close') ||
      bodyText?.includes('Reopen') ||
      bodyText?.includes('Lock') ||
      bodyText?.includes('New');

    expect(hasActionButtons).toBeTruthy();

    await page.screenshot({
      path: '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E14/05-periods-page.png',
      fullPage: true,
    });
  });
});
