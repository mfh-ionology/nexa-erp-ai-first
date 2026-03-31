/**
 * 02-chart-of-accounts.spec.ts — Chart of Accounts CRUD
 *
 * Verifies seed accounts render, and tests create + edit flow.
 * Uses REAL backend — no API mocking.
 */

import { test, expect } from '@playwright/test';

import { loginAndNavigateTo } from './helpers/auth';

// Unique suffix to avoid collisions on re-runs
const UNIQUE = Date.now().toString(36).slice(-4);
const TEST_ACCOUNT_CODE = `T${UNIQUE}`;
const TEST_ACCOUNT_NAME = `E2E Test Account ${UNIQUE}`;
const UPDATED_ACCOUNT_NAME = `E2E Updated Account ${UNIQUE}`;

test.describe('Chart of Accounts', () => {
  test('seed accounts are displayed', async ({ page }) => {
    await loginAndNavigateTo(page, '/finance/chart-of-accounts');

    // Wait for the tree to render — look for well-known seed accounts
    // From finance-seed.ts: code 1100 "Trade Debtors", code 4000 "Sales Revenue"
    await expect(page.getByText('Trade Debtors').first()).toBeVisible({ timeout: 15_000 });

    // Check for another seed account
    await expect(page.getByText('Current Account').first()).toBeVisible();
  });

  test('account type summary cards render', async ({ page }) => {
    await loginAndNavigateTo(page, '/finance/chart-of-accounts');

    // The page renders SummaryCards for each account type
    await expect(page.getByText('Trade Debtors').first()).toBeVisible({ timeout: 15_000 });

    // Summary cards show type labels: Asset, Liability, Equity, Revenue, Expense
    // and tree items show the same labels in title case
    await expect(page.getByText('Asset').first()).toBeVisible();
    await expect(page.getByText('Liability').first()).toBeVisible();
    await expect(page.getByText('Expense').first()).toBeVisible();
  });

  test('search filters accounts', async ({ page }) => {
    await loginAndNavigateTo(page, '/finance/chart-of-accounts');

    // Wait for tree to load
    await expect(page.getByText('Trade Debtors').first()).toBeVisible({ timeout: 15_000 });

    // Type in the search box
    const searchInput = page.locator('input[type="text"]').first();
    await searchInput.fill('Trade Debtors');

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // Trade Debtors should still be visible
    await expect(page.getByText('Trade Debtors').first()).toBeVisible();
  });

  test('create a new account', async ({ page }) => {
    await loginAndNavigateTo(page, '/finance/chart-of-accounts');

    // Wait for the page to load
    await expect(page.getByText('Trade Debtors').first()).toBeVisible({ timeout: 15_000 });

    // Click the "New" button to create a new account
    await page.getByRole('button', { name: /New/i }).click();

    // Should navigate to the new account form
    await page.waitForURL('**/finance/chart-of-accounts/new', { timeout: 10_000 });

    // Fill in the form fields
    await page.locator('#code').fill(TEST_ACCOUNT_CODE);
    await page.locator('#name').fill(TEST_ACCOUNT_NAME);

    // Account Type and Normal Balance are Select dropdowns — they default to ASSET/DEBIT
    // which is fine for our test

    // Click Create Account button
    await page.getByRole('button', { name: /Create Account/i }).click();

    // Should navigate to the newly created account's detail page
    await page.waitForURL('**/finance/chart-of-accounts/**', { timeout: 10_000 });

    // Verify the new account name appears on the detail page
    await expect(page.getByText(TEST_ACCOUNT_NAME).first()).toBeVisible({ timeout: 10_000 });
  });

  test('new account appears in the list', async ({ page }) => {
    await loginAndNavigateTo(page, '/finance/chart-of-accounts');

    // Wait for tree to load
    await expect(page.getByText('Trade Debtors').first()).toBeVisible({ timeout: 15_000 });

    // Search for our test account
    const searchInput = page.locator('input[type="text"]').first();
    await searchInput.fill(TEST_ACCOUNT_CODE);

    await page.waitForTimeout(500);

    // The test account we just created should appear
    await expect(page.getByText(TEST_ACCOUNT_NAME).first()).toBeVisible({ timeout: 10_000 });
  });

  test('edit an existing account', async ({ page }) => {
    // Navigate to a well-known seed account directly (9999 Suspense Account)
    await loginAndNavigateTo(page, '/finance/chart-of-accounts');

    // Wait for the tree to load
    await expect(page.getByText('Trade Debtors').first()).toBeVisible({ timeout: 15_000 });

    // Click on the Suspense Account in the tree (always present from seed)
    const suspenseItem = page.getByText('Suspense Account').first();
    await suspenseItem.click();

    // Wait for detail page to load
    await page.waitForURL('**/finance/chart-of-accounts/**', { timeout: 10_000 });
    await expect(page.getByText('Suspense Account').first()).toBeVisible({ timeout: 10_000 });

    // Click Edit button
    const editButton = page.getByRole('button', { name: /Edit/i });
    await expect(editButton).toBeVisible({ timeout: 5_000 });
    await editButton.click();

    // Wait for edit mode to activate — the name input should become editable
    const nameInput = page.locator('#name');
    await expect(nameInput).toBeVisible({ timeout: 5_000 });

    // Verify we can type in the name field (just verify edit mode works)
    const currentName = await nameInput.inputValue();
    await nameInput.clear();
    await nameInput.fill(currentName); // Restore same value

    // Cancel to avoid mutating seed data
    await page.getByRole('button', { name: /Cancel/i }).click();
  });
});
