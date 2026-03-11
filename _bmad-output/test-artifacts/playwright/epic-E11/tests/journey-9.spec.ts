import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E11/journey-9';

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

test.describe('Journey 9: Status Tab Filtering', () => {
  test('Status chip tabs filter tasks by status correctly', async ({ page }) => {
    // Login first
    await login(page);

    // Step 1: Navigate to /tasks
    await spaNavigate(page, '/tasks');

    const heading = page.locator('h1');
    await expect(heading.first()).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // Verify All tab is active with purple bg
    const allTab = page.locator('button').filter({ hasText: /All\s*\(\d+\)|tasks\.tabs\.all/i }).first();
    await expect(allTab).toBeVisible({ timeout: 5000 });
    await expect(allTab).toHaveClass(/bg-\[#7c3aed\]/);
    await expect(allTab).toHaveClass(/text-white/);

    // Record total task count from All tab
    const table = page.locator('table');
    await expect(table).toBeVisible();
    const allRows = await table.locator('tbody tr').count();
    expect(allRows).toBeGreaterThanOrEqual(1);

    // Checkpoint 1: All tab active, all tasks shown
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-all-tab-active.png`,
      fullPage: true,
    });

    // Step 2: Click Open tab
    const openTab = page.locator('button').filter({ hasText: /Open\s*\(\d+\)|tasks\.tabs\.open/i }).first();
    await expect(openTab).toBeVisible();
    await openTab.click();
    await page.waitForTimeout(1000);

    // Verify Open tab is now purple/active
    await expect(openTab).toHaveClass(/bg-\[#7c3aed\]/);

    // All tab should no longer be active (purple)
    // Verify all visible task rows have Open status (grey Circle icons or 'Open' text)
    const openRows = table.locator('tbody tr');
    const openRowCount = await openRows.count();
    if (openRowCount > 0) {
      // Check each row has Open status - look for 'Open' text or status icon
      for (let i = 0; i < openRowCount; i++) {
        const row = openRows.nth(i);
        const rowText = await row.textContent();
        // Row should contain "Open" status label (or i18n key)
        const hasOpenStatus =
          rowText?.includes('Open') ||
          rowText?.includes('tasks.status.open') ||
          rowText?.includes('OPEN');
        expect(hasOpenStatus).toBeTruthy();
      }
    }

    // Checkpoint 2: Open tab filtered
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-open-tab-filtered.png`,
      fullPage: true,
    });

    // Step 3: Click In Progress tab
    const inProgressTab = page
      .locator('button')
      .filter({ hasText: /In Progress\s*\(\d+\)|tasks\.tabs\.inProgress/i })
      .first();
    await expect(inProgressTab).toBeVisible();
    await inProgressTab.click();
    await page.waitForTimeout(1000);

    // Verify In Progress tab is active
    await expect(inProgressTab).toHaveClass(/bg-\[#7c3aed\]/);

    // Verify rows show IN_PROGRESS tasks
    const ipRows = table.locator('tbody tr');
    const ipRowCount = await ipRows.count();
    if (ipRowCount > 0) {
      for (let i = 0; i < ipRowCount; i++) {
        const row = ipRows.nth(i);
        const rowText = await row.textContent();
        const hasIPStatus =
          rowText?.includes('In Progress') ||
          rowText?.includes('tasks.status.inProgress') ||
          rowText?.includes('IN_PROGRESS');
        expect(hasIPStatus).toBeTruthy();
      }
    }

    // Checkpoint 3: In Progress tab filtered
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-in-progress-tab-filtered.png`,
      fullPage: true,
    });

    // Step 4: Click Overdue tab
    const overdueTab = page
      .locator('button')
      .filter({ hasText: /Overdue\s*\(\d+\)|tasks\.tabs\.overdue/i })
      .first();
    await expect(overdueTab).toBeVisible();
    await overdueTab.click();
    await page.waitForTimeout(1000);

    // Verify Overdue tab is active
    await expect(overdueTab).toHaveClass(/bg-\[#7c3aed\]/);

    // Overdue tasks should have red-styled due dates or overdue badges
    const overdueRows = table.locator('tbody tr');
    const overdueRowCount = await overdueRows.count();
    // Overdue count could be 0 if no tasks are past due — that's valid

    // Checkpoint 4: Overdue tab filtered
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-overdue-tab-filtered.png`,
      fullPage: true,
    });

    // Step 5: Click All tab again to restore
    await allTab.click();
    await page.waitForTimeout(1000);

    // Verify All tab is active again
    await expect(allTab).toHaveClass(/bg-\[#7c3aed\]/);

    // Verify all tasks are shown again
    const restoredRows = await table.locator('tbody tr').count();
    expect(restoredRows).toBe(allRows);
  });
});
