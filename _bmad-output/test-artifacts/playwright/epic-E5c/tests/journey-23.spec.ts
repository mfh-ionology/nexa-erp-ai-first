import { test, expect } from '@playwright/test';
import * as path from 'path';

const SCREENSHOTS_DIR =
  process.env.SCREENSHOTS_DIR ||
  path.resolve(__dirname, '../../../screenshots/epic-E5c/journey-23');

/**
 * Helper: navigate within the SPA using TanStack Router.
 * Auth tokens are in-memory only (Zustand), so page.goto() would
 * cause a full reload and lose the authenticated session.
 */
async function spaNavigate(
  page: import('@playwright/test').Page,
  navPath: string,
) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, navPath);
  await page.waitForTimeout(500);
  await page.waitForLoadState('networkidle');
}

test.describe('Journey 23: Prompt List — Category Filter', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    // Login as admin user
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const emailInput = page.getByLabel('Email');
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.fill('admin@nexa-erp.dev');

    const passwordInput = page.getByLabel('Password');
    await passwordInput.fill('NexaDev2026!');

    const signInButton = page.getByRole('button', { name: /sign in/i });
    await signInButton.waitFor({ state: 'visible' });
    await signInButton.click();

    // Wait for navigation away from /login
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 30000,
    });
    await page.waitForLoadState('networkidle');
  });

  test('Category filter filters prompts and resets correctly', async ({
    page,
  }) => {
    // ── Step 1: Navigate to prompts list ─────────────────────────────
    await spaNavigate(page, '/ai/admin/prompts');
    await expect(
      page.getByRole('heading', { name: /Prompt Templates/i }),
    ).toBeVisible({ timeout: 15000 });

    // Wait for prompt data to load — at least one table row
    await expect(
      page.locator('table tbody tr').first(),
    ).toBeVisible({ timeout: 10000 });

    // Count total prompts visible (for comparison after filter)
    const totalRowsBefore = await page.locator('table tbody tr').count();
    expect(totalRowsBefore).toBeGreaterThan(0);

    // Verify the category filter dropdown is present
    const categoryFilter = page.getByRole('combobox', {
      name: /Filter by category/i,
    });
    await expect(categoryFilter).toBeVisible({ timeout: 5000 });

    // ── Checkpoint 1: Prompt list loaded ─────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-prompt-list-loaded.png`,
      fullPage: false,
    });

    // ── Step 2: Select "Automation" category filter ──────────────────
    await categoryFilter.click();
    await page.waitForTimeout(300);

    // Select "Automation" option from the dropdown
    const automationOption = page.getByRole('option', {
      name: /^Automation$/i,
    });
    await expect(automationOption).toBeVisible({ timeout: 5000 });
    await automationOption.click();

    // Wait for the filtered data to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Verify only automation category prompts are shown
    const filteredRows = page.locator('table tbody tr');
    const filteredRowCount = await filteredRows.count();

    // The filtered count should be less than or equal to the total
    expect(filteredRowCount).toBeLessThanOrEqual(totalRowsBefore);
    expect(filteredRowCount).toBeGreaterThan(0);

    // Each visible row's category cell should contain "automation"
    for (let i = 0; i < filteredRowCount; i++) {
      const categoryCell = filteredRows.nth(i).locator('td').nth(1);
      await expect(categoryCell).toHaveText(/automation/i);
    }

    // ── Checkpoint 2: Filtered to automation category ────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-filtered-automation-category.png`,
      fullPage: false,
    });

    // ── Step 3: Reset filter to "All Categories" ─────────────────────
    await categoryFilter.click();
    await page.waitForTimeout(300);

    const allOption = page.getByRole('option', {
      name: /^All Categories$/i,
    });
    await expect(allOption).toBeVisible({ timeout: 5000 });
    await allOption.click();

    // Wait for unfiltered data to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // After resetting, we should see the same number of rows as before
    const totalRowsAfterReset = await page.locator('table tbody tr').count();
    expect(totalRowsAfterReset).toBe(totalRowsBefore);

    // ── Checkpoint 3: Filter reset — all categories visible ──────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-filter-reset-all-categories.png`,
      fullPage: false,
    });
  });
});
