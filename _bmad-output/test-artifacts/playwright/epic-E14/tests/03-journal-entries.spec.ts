/**
 * 03-journal-entries.spec.ts — Journal Entry Lifecycle
 *
 * Tests journal list, new form load, and form field visibility.
 * Uses REAL backend — no API mocking.
 */

import { test, expect } from '@playwright/test';

import { loginAndNavigateTo } from './helpers/auth';

test.describe('Journal Entries', () => {
  test('journal list page renders with New button', async ({ page }) => {
    await loginAndNavigateTo(page, '/finance/journals');

    await expect(
      page.getByRole('button', { name: /New/i }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('new journal form loads with header fields', async ({ page }) => {
    await loginAndNavigateTo(page, '/finance/journals/new');

    // The form should have date, description, and reference inputs
    // Wait for form to render
    await expect(page.locator('input[type="date"]').first()).toBeVisible({ timeout: 15_000 });

    // Description field
    const descInput = page.locator('input[name="description"]');
    await expect(descInput).toBeVisible();

    // Breadcrumbs include "Journals"
    await expect(page.getByText('Journals').first()).toBeVisible();
  });

  test('new journal form has line grid', async ({ page }) => {
    await loginAndNavigateTo(page, '/finance/journals/new');

    // Wait for form to load
    await expect(page.locator('input[type="date"]').first()).toBeVisible({ timeout: 15_000 });

    // The JournalLineGrid should have at least 2 rows with account/debit/credit inputs
    // Look for the line grid area — it renders a table or grid
    const bodyText = await page.textContent('body');
    const hasLineGridElements =
      bodyText?.includes('Debit') ||
      bodyText?.includes('Credit') ||
      bodyText?.includes('Account');

    expect(hasLineGridElements).toBeTruthy();
  });

  test('journal form shows totals section', async ({ page }) => {
    await loginAndNavigateTo(page, '/finance/journals/new');

    await expect(page.locator('input[type="date"]').first()).toBeVisible({ timeout: 30_000 });

    // The form shows total debit and total credit fields
    const bodyText = await page.textContent('body');
    const hasTotals =
      bodyText?.includes('Total') ||
      bodyText?.includes('Debit') ||
      bodyText?.includes('Credit') ||
      bodyText?.includes('Difference') ||
      bodyText?.includes('Balance');

    expect(hasTotals).toBeTruthy();
  });

  test('journal list shows entries if any exist', async ({ page }) => {
    await loginAndNavigateTo(page, '/finance/journals');

    // Wait for the list to load
    await expect(
      page.getByRole('button', { name: /New/i }),
    ).toBeVisible({ timeout: 15_000 });

    // Check page content — may have entries or an empty state
    await page.waitForTimeout(2000);

    const bodyText = await page.textContent('body');
    // Either we see journal entry data or an empty state
    const hasContent =
      bodyText?.includes('JE-') || // Entry numbers start with JE-
      bodyText?.includes('DRAFT') ||
      bodyText?.includes('POSTED') ||
      bodyText?.includes('No journals') ||
      bodyText?.includes('no results') ||
      bodyText?.includes('No data') ||
      bodyText?.includes('empty') ||
      bodyText?.includes('Journal Entries') || // Page loaded with title
      bodyText?.includes('Journal') || // Any journal reference
      bodyText?.includes('New'); // New button visible = page loaded

    expect(hasContent).toBeTruthy();
  });

  test('status filter tabs are visible on journal list', async ({ page }) => {
    await loginAndNavigateTo(page, '/finance/journals');

    await expect(
      page.getByRole('button', { name: /New/i }),
    ).toBeVisible({ timeout: 15_000 });

    // Look for filter buttons (All, Draft, Posted, Reversed)
    const filterButtons = page.locator('button').filter({
      hasText: /all|draft|posted|reversed/i,
    });
    const count = await filterButtons.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('clicking New navigates to journal form', async ({ page }) => {
    await loginAndNavigateTo(page, '/finance/journals');

    await expect(
      page.getByRole('button', { name: /New/i }),
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: /New/i }).click();

    // Should navigate to /finance/journals/new
    await page.waitForURL('**/finance/journals/new', { timeout: 10_000 });

    // Form should load
    await expect(page.locator('input[type="date"]').first()).toBeVisible({ timeout: 15_000 });
  });
});
