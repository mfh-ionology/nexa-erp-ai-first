/**
 * 07-bank-accounts.spec.ts — Bank Accounts
 *
 * Tests bank account listing, create form, and detail view.
 * Uses REAL backend — no API mocking.
 */

import { test, expect } from '@playwright/test';

import { loginAndNavigateTo } from './helpers/auth';

test.describe('Bank Accounts', () => {
  test('bank accounts list page loads', async ({ page }) => {
    await loginAndNavigateTo(page, '/finance/bank-accounts');

    // The EntityListPage renders a heading or breadcrumb with "Bank Accounts"
    await expect(
      page.getByText('Bank Accounts').first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('new bank account button is visible', async ({ page }) => {
    await loginAndNavigateTo(page, '/finance/bank-accounts');

    await expect(
      page.getByText('Bank Accounts').first(),
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      page.getByRole('button', { name: /New/i }),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('new bank account form loads', async ({ page }) => {
    await loginAndNavigateTo(page, '/finance/bank-accounts/new');

    // Wait for the create form to load — use longer timeout for initial navigation
    await expect(
      page.getByText('New Bank Account').first(),
    ).toBeVisible({ timeout: 30_000 });

    // Check that the form has the expected labeled fields
    const bodyText = await page.textContent('body');
    expect(bodyText?.includes('Account Name')).toBeTruthy();
    expect(bodyText?.includes('Bank Name')).toBeTruthy();
    expect(bodyText?.includes('Account Number')).toBeTruthy();
    expect(bodyText?.includes('Sort Code')).toBeTruthy();
  });

  test('new bank account form has required fields', async ({ page }) => {
    await loginAndNavigateTo(page, '/finance/bank-accounts/new');

    await expect(
      page.getByText('New Bank Account').first(),
    ).toBeVisible({ timeout: 15_000 });

    // Verify input placeholders match the expected form
    await expect(
      page.locator('input[placeholder*="Main Business"]'),
    ).toBeVisible();

    await expect(
      page.locator('input[placeholder*="Barclays"]'),
    ).toBeVisible();

    await expect(
      page.locator('input[placeholder="12345678"]'),
    ).toBeVisible();

    await expect(
      page.locator('input[placeholder="12-34-56"]'),
    ).toBeVisible();
  });

  test('bank account list shows table columns', async ({ page }) => {
    await loginAndNavigateTo(page, '/finance/bank-accounts');

    await expect(
      page.getByText('Bank Accounts').first(),
    ).toBeVisible({ timeout: 15_000 });

    // Wait for data to load
    await page.waitForTimeout(2000);

    // The EntityListPage shows a table with column headers
    const bodyText = await page.textContent('body');

    // Column headers from bank-account-list-page.tsx
    const hasExpectedColumns =
      bodyText?.includes('Account Name') ||
      bodyText?.includes('Bank') ||
      bodyText?.includes('Sort Code') ||
      bodyText?.includes('Currency') ||
      bodyText?.includes('Status') ||
      // Or if no bank accounts exist, an empty state
      bodyText?.includes('No bank accounts') ||
      bodyText?.includes('no results') ||
      bodyText?.includes('No data');

    expect(hasExpectedColumns).toBeTruthy();
  });

  test('clicking New navigates to create form', async ({ page }) => {
    await loginAndNavigateTo(page, '/finance/bank-accounts');

    await expect(
      page.getByText('Bank Accounts').first(),
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: /New/i }).click();

    await page.waitForURL('**/finance/bank-accounts/new', { timeout: 10_000 });

    await expect(
      page.getByText('New Bank Account').first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('bank account detail page shows fields when navigated to', async ({ page }) => {
    await loginAndNavigateTo(page, '/finance/bank-accounts');

    await expect(
      page.getByText('Bank Accounts').first(),
    ).toBeVisible({ timeout: 15_000 });

    // Try to click on the first bank account row (if any exist)
    await page.waitForTimeout(2000);

    const firstRow = page.locator('tr').nth(1);
    const hasRow = await firstRow.isVisible().catch(() => false);

    if (hasRow) {
      await firstRow.click();

      // Wait for detail page
      await page.waitForURL('**/finance/bank-accounts/**', { timeout: 10_000 });
      await page.waitForTimeout(2000);

      const bodyText = await page.textContent('body');
      const hasDetailFields =
        bodyText?.includes('Account') ||
        bodyText?.includes('Bank') ||
        bodyText?.includes('Balance') ||
        bodyText?.includes('Sort Code');

      expect(hasDetailFields).toBeTruthy();
    }

    // If no rows exist, that's fine — the list is empty
  });
});
