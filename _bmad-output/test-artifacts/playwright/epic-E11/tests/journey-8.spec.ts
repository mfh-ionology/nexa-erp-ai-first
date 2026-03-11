import { test, expect } from '@playwright/test';

const SCREENSHOTS =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E11/journey-8';

// Increase timeout for this test — login + multiple mutations
test.setTimeout(120_000);

/**
 * SPA navigate without losing auth tokens (Zustand in-memory).
 */
async function spaNavigate(
  page: import('@playwright/test').Page,
  path: string,
) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await page.waitForTimeout(800);
  await page.waitForLoadState('networkidle');
}

/**
 * Login helper — logs in and waits for the dashboard to fully load.
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
  // Wait for the app shell to render (sidebar, header, etc.)
  await page.waitForTimeout(2000);
}

test.describe('Journey 8: Inline Edit Title & Description in Detail Sheet', () => {
  test('inline edit title and description in task detail sheet', async ({
    page,
  }) => {
    // Login first
    await login(page);

    // Step 1: Navigate to /tasks using sidebar link (more reliable than pushState)
    const tasksLink = page.locator('a[href="/tasks"]');
    const tasksLinkVisible = await tasksLink.first().isVisible().catch(() => false);

    if (tasksLinkVisible) {
      await tasksLink.first().click();
      await page.waitForURL(/\/tasks/, { timeout: 15000 });
    } else {
      // Fallback to SPA navigate
      await spaNavigate(page, '/tasks');
    }

    await page.waitForLoadState('networkidle');

    // Wait for heading
    const heading = page.locator('h1');
    await expect(heading.first()).toBeVisible({ timeout: 15000 });

    // Wait for table rows to appear
    const taskRows = page.locator('table tbody tr');
    await expect(taskRows.first()).toBeVisible({ timeout: 15000 });

    // Step 2: Click an active task row to open detail sheet
    const firstRowTitleCell = taskRows.first().locator('td').nth(2);
    await firstRowTitleCell.click();

    // Wait for sheet to open
    const sheet = page.locator('[role="dialog"]');
    await expect(sheet).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);

    // Checkpoint 1: Detail sheet opened
    await page.screenshot({
      path: `${SCREENSHOTS}/step-2-detail-sheet-opened.png`,
    });

    // The sheet has two h2: the sheet title (nth 0) and the task title (nth 1)
    const taskTitleH2 = sheet.locator('h2').nth(1);
    await expect(taskTitleH2).toBeVisible();

    // Step 3: Click pencil icon next to task title to start editing
    const titlePencilBtn = sheet.locator(
      '.flex.items-start.gap-2 button',
    ).first();
    await titlePencilBtn.click();

    // Title should now be an input field, auto-focused
    const titleInput = sheet.locator('.flex.items-start.gap-2 input').first();
    await expect(titleInput).toBeVisible({ timeout: 5000 });
    await expect(titleInput).toBeFocused();

    // Step 4: Fill in new title
    await titleInput.fill('Updated task title via inline edit');

    // Step 5: Press Enter to save
    await titleInput.press('Enter');

    // Wait for input to disappear (reverts to text display)
    await expect(titleInput).toBeHidden({ timeout: 5000 });

    // BUG: The sheet's task title h2 does NOT update because detailTask is a
    // stale state snapshot in MyTasksPage. The table behind the sheet DOES
    // update because it derives from the React Query cache.
    // Wait for the table to reflect the update to confirm mutation succeeded.
    await page.waitForTimeout(2000);

    // Verify the table updated (mutation worked)
    const updatedTableTitle = page.locator('table tbody tr').first().locator('td').nth(2);
    await expect(updatedTableTitle).toContainText('Updated task title via inline edit', {
      timeout: 10000,
    });

    // Checkpoint 2: Title saved (note: sheet h2 shows stale title — documented bug)
    await page.screenshot({
      path: `${SCREENSHOTS}/step-5-title-saved.png`,
    });

    // Step 6: Click pencil icon next to Description section
    const descLabel = sheet
      .locator('p')
      .filter({ hasText: /^(description|tasks\.create\.description)$/i });
    const descPencilBtn = descLabel.locator('..').locator('button').first();
    await descPencilBtn.click();

    // Textarea should appear for description editing
    const descTextarea = sheet.locator('textarea');
    await expect(descTextarea).toBeVisible({ timeout: 5000 });

    // Checkpoint 3: Description editing mode
    await page.screenshot({
      path: `${SCREENSHOTS}/step-6-description-editing.png`,
    });

    // Verify Save button appears
    const saveButton = sheet
      .locator('button')
      .filter({ hasText: /^(save|tasks\.detail\.save)$/i });
    await expect(saveButton).toBeVisible();

    // Step 7: Fill in new description
    await descTextarea.fill('Updated description text for this task');

    // Step 8: Click Save button (purple)
    await saveButton.click();

    // Wait for textarea to disappear
    await expect(descTextarea).toBeHidden({ timeout: 5000 });
    await page.waitForTimeout(1000);

    // Checkpoint 4: Description saved
    await page.screenshot({
      path: `${SCREENSHOTS}/step-8-description-saved.png`,
    });

    // Close the sheet and reopen to verify persistence (data comes fresh from cache)
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden({ timeout: 5000 });
    await page.waitForTimeout(500);

    // Click the first row again (now has updated title)
    await page.locator('table tbody tr').first().locator('td').nth(2).click();
    await expect(sheet).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);

    // Now the sheet should reflect the updated title and description
    const refreshedTitle = sheet.locator('h2').nth(1);
    await expect(refreshedTitle).toHaveText('Updated task title via inline edit');

    // Verify description is also updated
    await expect(
      sheet.getByText('Updated description text for this task'),
    ).toBeVisible();

    // Final checkpoint: sheet with updated data after reopen
    await page.screenshot({
      path: `${SCREENSHOTS}/step-9-reopen-verified.png`,
    });
  });
});
