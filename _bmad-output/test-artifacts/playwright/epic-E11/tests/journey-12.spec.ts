import { test, expect } from '@playwright/test';

const screenshotDir =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E11/journey-12';

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

test.describe('Journey 12: Batch Select All via Header Checkbox', () => {
  test('selects all tasks via header checkbox and clears selection', async ({ page }) => {
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

    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(1);

    // Screenshot: page loaded
    await page.screenshot({
      path: `${screenshotDir}/step-1-tasks-page-loaded.png`,
    });

    // Step 2 — Click header row checkbox (select all)
    const headerCheckbox = page
      .locator('table thead')
      .locator('input[type="checkbox"], button[role="checkbox"]')
      .first();
    await expect(headerCheckbox).toBeVisible({ timeout: 5000 });
    await headerCheckbox.click();

    // Wait for batch bar to appear
    await page.waitForTimeout(500);

    // Verify all row checkboxes are checked
    for (let i = 0; i < Math.min(rowCount, 5); i++) {
      const rowCheckbox = rows.nth(i).locator('input[type="checkbox"], button[role="checkbox"]').first();
      await expect(rowCheckbox).toBeChecked({ timeout: 3000 });
    }

    // Verify batch action bar is visible with selected count
    // The count should match the number of visible rows
    const selectedText = page.getByText(/\d+ selected|tasks\.batch\.selected/i);
    await expect(selectedText).toBeVisible({ timeout: 5000 });

    // Verify Complete All button in batch bar
    const completeAllBtn = page.getByRole('button', { name: /complete all|tasks\.batch\.completeAll/i });
    await expect(completeAllBtn).toBeVisible({ timeout: 5000 });

    // Verify Clear button in batch bar
    const clearBtn = page.getByRole('button', { name: /clear|tasks\.batch\.clear/i });
    await expect(clearBtn).toBeVisible({ timeout: 5000 });

    // Screenshot: all selected with batch bar
    await page.screenshot({
      path: `${screenshotDir}/step-2-all-selected-batch-bar.png`,
    });

    // Step 3 — Click Clear button in batch action bar
    await clearBtn.click();

    // Wait for UI to update
    await page.waitForTimeout(500);

    // Verify batch bar is gone
    await expect(selectedText).not.toBeVisible({ timeout: 5000 });

    // Verify checkboxes are unchecked
    const firstRowCheckbox = rows.nth(0).locator('input[type="checkbox"], button[role="checkbox"]').first();
    await expect(firstRowCheckbox).not.toBeChecked({ timeout: 3000 });

    // Screenshot: cleared, no batch bar
    await page.screenshot({
      path: `${screenshotDir}/step-3-cleared-no-batch-bar.png`,
    });
  });
});
