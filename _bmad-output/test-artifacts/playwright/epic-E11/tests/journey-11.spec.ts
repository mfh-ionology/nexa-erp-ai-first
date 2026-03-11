import { test, expect } from '@playwright/test';

const screenshotDir =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E11/journey-11';

async function spaNavigate(page: import('@playwright/test').Page, path: string) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await page.waitForTimeout(500);
  await page.waitForLoadState('networkidle');
}

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

test.describe('Journey 11: Batch Selection and Actions', () => {
  test('selects multiple tasks and batch completes them', async ({ page }) => {
    // Login
    await login(page);

    // Step 1 — Navigate to /tasks
    await spaNavigate(page, '/tasks');

    // Wait for heading and table
    const heading = page.locator('h1');
    await expect(heading.first()).toBeVisible({ timeout: 15000 });

    const table = page.locator('table');
    await expect(table).toBeVisible({ timeout: 15000 });

    // Wait for data rows to load
    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });

    // Ensure we have at least 2 rows
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(2);

    // Screenshot: page loaded
    await page.screenshot({
      path: `${screenshotDir}/step-1-tasks-page-loaded.png`,
    });

    // Step 2 — Click checkbox on first task row
    const firstRowCheckbox = rows.nth(0).locator('input[type="checkbox"], button[role="checkbox"]').first();
    await expect(firstRowCheckbox).toBeVisible({ timeout: 5000 });
    await firstRowCheckbox.click();

    // Verify batch bar starts to appear
    await page.waitForTimeout(300);

    // Step 3 — Click checkbox on second task row
    const secondRowCheckbox = rows.nth(1).locator('input[type="checkbox"], button[role="checkbox"]').first();
    await expect(secondRowCheckbox).toBeVisible({ timeout: 5000 });
    await secondRowCheckbox.click();

    // Wait for batch action bar to be fully visible
    await page.waitForTimeout(500);

    // Verify batch action bar is visible with selected count text
    // Text may be translated ("2 selected") or show i18n key ("tasks.batch.selected")
    const selectedText = page.getByText(/2 selected|tasks\.batch\.selected/i);
    await expect(selectedText).toBeVisible({ timeout: 5000 });

    // Verify "Complete All" button is visible (translated or i18n key)
    const completeAllBtn = page.getByRole('button', { name: /complete all|tasks\.batch\.completeAll/i });
    await expect(completeAllBtn).toBeVisible({ timeout: 5000 });

    // Screenshot: batch bar with 2 selected
    await page.screenshot({
      path: `${screenshotDir}/step-3-two-tasks-selected-batch-bar.png`,
    });

    // Capture the titles of the first two tasks before completing
    const firstTaskTitle = await rows.nth(0).locator('td').nth(2).textContent();
    const secondTaskTitle = await rows.nth(1).locator('td').nth(2).textContent();

    // Step 4 — Click "Complete All" button
    await completeAllBtn.click();

    // Wait for the batch operation to complete
    await page.waitForTimeout(1500);
    await page.waitForLoadState('networkidle');

    // Verify batch bar is gone (selection cleared)
    await expect(selectedText).not.toBeVisible({ timeout: 5000 });

    // Verify both tasks now show completed status
    // Look for completed status icons
    const completedIcons = page.locator('button[aria-label="Task status: completed"]');
    const completedCount = await completedIcons.count();
    expect(completedCount).toBeGreaterThanOrEqual(2);

    // Check for line-through styling on completed task titles
    const lineThroughTitles = page.locator('table tbody span.line-through');
    const lineThroughCount = await lineThroughTitles.count();
    expect(lineThroughCount).toBeGreaterThanOrEqual(2);

    // Screenshot: after batch complete
    await page.screenshot({
      path: `${screenshotDir}/step-4-batch-complete-all-done.png`,
    });
  });
});
