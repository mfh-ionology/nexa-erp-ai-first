import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E11/journey-10';

/**
 * SPA navigate without losing auth tokens (Zustand in-memory).
 */
async function spaNavigate(page: import('@playwright/test').Page, path: string) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await page.waitForTimeout(500);
  await page.waitForLoadState('networkidle');
}

/**
 * Login helper.
 */
async function login(page: import('@playwright/test').Page) {
  await page.goto('/login', { waitUntil: 'networkidle', timeout: 30000 });

  const emailInput = page.getByRole('textbox', { name: 'Email' });
  await emailInput.waitFor({ state: 'visible', timeout: 10000 });
  await emailInput.fill('admin@nexa-erp.dev');

  const passwordInput = page.locator('input[type="password"]');
  await passwordInput.fill('NexaDev2026!');

  const signInButton = page.getByRole('button', { name: /sign in/i });
  await signInButton.waitFor({ state: 'visible' });
  await signInButton.click();

  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 45000,
  });
  await page.waitForLoadState('networkidle');
}

test.describe('Journey 10: Search and Priority Filter', () => {
  test('Search input and priority dropdown filter tasks correctly', async ({ page }) => {
    // Login first
    await login(page);

    // Step 1: Navigate to /tasks
    await spaNavigate(page, '/tasks');

    const heading = page.locator('h1');
    await expect(heading.first()).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // Verify tasks table is visible with some rows
    const table = page.locator('table');
    await expect(table).toBeVisible();
    const initialRowCount = await table.locator('tbody tr').count();
    expect(initialRowCount).toBeGreaterThanOrEqual(1);

    // Step 2: Type "invoice" in search input
    const searchInput = page.getByPlaceholder(/search/i).first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill('invoice');
    await page.waitForTimeout(1500); // Wait for debounced search

    // Verify filtered results - task titles should contain "invoice"
    const filteredRows = table.locator('tbody tr');
    const filteredCount = await filteredRows.count();

    if (filteredCount > 0) {
      // Each visible row should contain "invoice" in its text
      for (let i = 0; i < filteredCount; i++) {
        const row = filteredRows.nth(i);
        const rowText = await row.textContent();
        expect(rowText?.toLowerCase()).toContain('invoice');
      }
    }
    // If 0 rows, the search found no matches — that's also a valid result
    // but we should see an empty state or no rows

    // Checkpoint 1: Search results for "invoice"
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-search-invoice-results.png`,
      fullPage: true,
    });

    // Step 3: Clear the search input
    await searchInput.fill('');
    await page.waitForTimeout(1500); // Wait for debounced search to reset

    // Verify all tasks are shown again
    const restoredCount = await table.locator('tbody tr').count();
    expect(restoredCount).toBe(initialRowCount);

    // Step 4: Click the Priority dropdown filter
    // Look for a select/button that mentions priority or "All Priorities"
    const priorityFilter = page
      .locator('button, [role="combobox"]')
      .filter({ hasText: /priority|all priorities|tasks\.filters\.priority/i })
      .first();
    await expect(priorityFilter).toBeVisible({ timeout: 5000 });
    await priorityFilter.click();
    await page.waitForTimeout(500);

    // The dropdown should show options: All Priorities, Urgent, High, Normal, Low
    const highOption = page
      .locator('[role="option"], [role="menuitem"], [data-value]')
      .filter({ hasText: /^High$|HIGH|tasks\.priority\.high/i })
      .first();

    // If standard select options not found, try looking for listbox items
    if (!(await highOption.isVisible().catch(() => false))) {
      // Try alternative: look in any popover/dropdown content
      const altHighOption = page.getByText(/^High$/i).first();
      await expect(altHighOption).toBeVisible({ timeout: 5000 });
      await altHighOption.click();
    } else {
      // Step 5: Click HIGH option
      await highOption.click();
    }

    await page.waitForTimeout(1500);

    // Verify only HIGH priority tasks are shown
    const highRows = table.locator('tbody tr');
    const highRowCount = await highRows.count();

    if (highRowCount > 0) {
      // Each row should show HIGH priority badge or text
      for (let i = 0; i < highRowCount; i++) {
        const row = highRows.nth(i);
        const rowText = await row.textContent();
        const hasHighPriority =
          rowText?.includes('High') ||
          rowText?.includes('HIGH') ||
          rowText?.includes('tasks.priority.high');
        expect(hasHighPriority).toBeTruthy();
      }
    }

    // Checkpoint 2: HIGH priority filter applied
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-high-priority-filtered.png`,
      fullPage: true,
    });
  });
});
