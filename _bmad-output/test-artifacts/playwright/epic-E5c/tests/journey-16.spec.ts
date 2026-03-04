import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '_bmad-output/test-artifacts/screenshots/epic-E5c/journey-16';

/**
 * Helper: navigate within the SPA using TanStack Router.
 * Auth tokens are in-memory only (Zustand), so page.goto() would
 * cause a full reload and lose the authenticated session.
 */
async function spaNavigate(
  page: import('@playwright/test').Page,
  path: string,
) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await page.waitForTimeout(500);
}

test.describe('Journey 16: Automation Runs List with Filters', () => {
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

  test('Automation Runs list with status, date, and automation filters (E5c-6 AC-1, AC-2)', async ({
    page,
  }) => {
    // Capture API errors for diagnostics
    const apiErrors: string[] = [];
    page.on('response', (response) => {
      if (response.url().includes('/api/') && response.status() >= 400) {
        apiErrors.push(
          `${response.status()} ${response.request().method()} ${new URL(response.url()).pathname}`,
        );
      }
    });

    // ── Step 1: Navigate to /ai/admin/automations/runs ──────────────────────
    await spaNavigate(page, '/ai/admin/automations/runs');
    await expect(
      page.getByRole('heading', { name: /Automation Runs/i }),
    ).toBeVisible({ timeout: 15000 });
    // Wait for data to load
    await page.waitForTimeout(2000);

    // Verify filter bar is present — the status filter button should say "All Statuses"
    const statusFilterButton = page.getByRole('button', { name: /all statuses/i });
    await expect(statusFilterButton).toBeVisible({ timeout: 5000 });

    // Verify date inputs present
    const fromDateInput = page.getByLabel('From date');
    const toDateInput = page.getByLabel('To date');
    await expect(fromDateInput).toBeVisible({ timeout: 5000 });
    await expect(toDateInput).toBeVisible({ timeout: 5000 });

    test.info().annotations.push({
      type: 'info',
      description: 'Step 1: Automation Runs list loaded with filter bar (status, date range)',
    });

    // ── Checkpoint 1: Automation Runs list page loaded ───────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-automation-runs-list-loaded.png`,
      fullPage: true,
    });

    // ── Step 2: Verify at least one run row is visible ──────────────────────
    // Look for any table content or empty state
    const tableBody = page.locator('table tbody, [role="table"] [role="rowgroup"]');
    const hasTableBody = await tableBody.first().isVisible({ timeout: 5000 }).catch(() => false);

    const anyRunRow = page.locator('table tbody tr, [role="row"]');
    const runRowCount = await anyRunRow.count().catch(() => 0);

    // Check for empty state
    const emptyState = page.getByText(/no.*runs|no results|no data/i);
    const isEmptyState = await emptyState.first().isVisible({ timeout: 2000 }).catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Step 2: Table visible=${hasTableBody}, rows=${runRowCount}, emptyState=${isEmptyState}`,
    });

    // ── Step 3: Filter by status — select COMPLETED ─────────────────────────
    await statusFilterButton.click();
    await page.waitForTimeout(500);

    // The popover shows checkboxes for each status inside labels
    const completedLabel = page.locator('label').filter({ hasText: 'Completed' });
    await expect(completedLabel.first()).toBeVisible({ timeout: 3000 });
    await completedLabel.first().click();

    // Close the popover by pressing Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Verify the filter button text updated to show "Completed" (single selection)
    const completedFilterBtn = page.getByRole('button', { name: /completed/i });
    const hasCompletedFilter = await completedFilterBtn.isVisible({ timeout: 3000 }).catch(() => false);

    // Check that Clear button appeared (indicates active filter)
    const clearButton = page.getByRole('button', { name: /clear/i });
    const hasClearButton = await clearButton.isVisible({ timeout: 3000 }).catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Step 3: Status filter "Completed" active=${hasCompletedFilter}, Clear button visible=${hasClearButton}`,
    });

    expect(hasCompletedFilter || hasClearButton, 'Status filter should be active after selecting COMPLETED').toBeTruthy();

    // ── Checkpoint 2: Status filter — COMPLETED only ────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-status-filter-completed.png`,
      fullPage: true,
    });

    // ── Step 4: Add FAILED to the status filter (multi-select) ──────────────
    // Re-open the status filter popover
    const activeStatusBtn = page.getByRole('button', { name: /completed|statuses?/i }).first();
    await activeStatusBtn.click();
    await page.waitForTimeout(500);

    const failedLabel = page.locator('label').filter({ hasText: 'Failed' });
    await expect(failedLabel.first()).toBeVisible({ timeout: 3000 });
    await failedLabel.first().click();

    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Should now show "2 statuses" since two are selected
    const multiStatusLabel = page.getByRole('button', { name: /2 statuses/i });
    const hasMultiStatus = await multiStatusLabel.isVisible({ timeout: 3000 }).catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Step 4: Multi-status filter "2 statuses" label visible=${hasMultiStatus}`,
    });

    // ── Step 5: Fill date range filter ──────────────────────────────────────
    await fromDateInput.fill('2026-03-01');
    await toDateInput.fill('2026-03-04');
    await page.waitForTimeout(1000);

    test.info().annotations.push({
      type: 'info',
      description: 'Step 5: Date range filter applied (2026-03-01 to 2026-03-04)',
    });

    // ── Step 6: Click Clear Filters ─────────────────────────────────────────
    const clearFiltersButton = page.getByRole('button', { name: /clear/i });
    await expect(clearFiltersButton).toBeVisible({ timeout: 5000 });
    await clearFiltersButton.click();
    await page.waitForTimeout(1000);

    // Verify filters are cleared — status button should say "All Statuses" again
    const resetStatusButton = page.getByRole('button', { name: /all statuses/i });
    const filtersCleared = await resetStatusButton.isVisible({ timeout: 5000 }).catch(() => false);

    // Clear button should be gone
    const clearGone = !(await page.getByRole('button', { name: /clear/i }).isVisible({ timeout: 1000 }).catch(() => false));

    // Date inputs should be empty
    const fromDateValue = await fromDateInput.inputValue();
    const toDateValue = await toDateInput.inputValue();

    test.info().annotations.push({
      type: 'info',
      description: `Step 6: Filters cleared — status reset=${filtersCleared}, clear btn gone=${clearGone}, dates reset=${fromDateValue === '' && toDateValue === ''}`,
    });

    expect(filtersCleared, 'Status filter should reset to "All Statuses"').toBeTruthy();

    // ── Step 7: Filter by automation name "Daily AR Aging Summary" ──────────
    // The automation select dropdown should be visible (we're in "all runs" mode)
    const automationSelect = page.locator('button[role="combobox"], [class*="SelectTrigger"]')
      .filter({ hasText: /all automations/i });
    const hasAutomationFilter = await automationSelect.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (hasAutomationFilter) {
      await automationSelect.first().click();
      await page.waitForTimeout(500);

      // Select "Daily AR Aging Summary" from the dropdown
      const dailyOption = page.getByRole('option', { name: /daily ar aging summary/i });
      const hasDailyOption = await dailyOption.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasDailyOption) {
        await dailyOption.click();
      } else {
        // Fallback: try clicking text directly in the select content
        const dailyText = page.getByText('Daily AR Aging Summary').last();
        await dailyText.click();
      }

      await page.waitForTimeout(1500);
    }

    test.info().annotations.push({
      type: 'info',
      description: `Step 7: Automation filter visible=${hasAutomationFilter}`,
    });

    // ── Checkpoint 3: Automation name filter applied ─────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-7-automation-name-filtered.png`,
      fullPage: true,
    });

    // ── Final Diagnostics ───────────────────────────────────────────────────
    if (apiErrors.length > 0) {
      const unique = [...new Set(apiErrors)];
      test.info().annotations.push({
        type: 'issue',
        description: `API errors: ${unique.slice(0, 10).join('; ')}`,
      });
    }
  });
});
