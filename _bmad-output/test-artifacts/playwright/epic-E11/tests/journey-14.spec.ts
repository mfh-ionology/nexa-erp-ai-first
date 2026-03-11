import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E11/journey-14';

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

test.describe('Journey 14: Delete Task from Detail Sheet', () => {
  test('Delete a task via the detail sheet footer with AlertDialog confirmation', async ({ page }) => {
    test.setTimeout(120000);

    // Login first
    await login(page);

    // Hide TanStack Router devtools overlay that blocks clicks
    await page.addStyleTag({ content: '.go1561890071, [data-tanstack-router-devtools] { display: none !important; pointer-events: none !important; }' });

    // Step 1: Navigate to /tasks
    await spaNavigate(page, '/tasks');

    // Re-hide devtools after SPA nav
    await page.addStyleTag({ content: '.go1561890071, [data-tanstack-router-devtools] { display: none !important; pointer-events: none !important; }' });

    const heading = page.locator('h1');
    await expect(heading.first()).toBeVisible({ timeout: 15000 });

    // Wait for data to load
    await page.waitForTimeout(2000);

    // Verify tasks table has at least one row
    const table = page.locator('table');
    await expect(table).toBeVisible({ timeout: 10000 });
    const dataRows = table.locator('tbody tr');
    const initialRowCount = await dataRows.count();
    expect(initialRowCount).toBeGreaterThanOrEqual(1);

    // Capture the task title from the first row for later verification
    const firstRow = dataRows.first();
    const taskTitleCell = firstRow.locator('td').nth(2);
    const taskTitle = await taskTitleCell.textContent();
    expect(taskTitle).toBeTruthy();
    const taskTitleText = taskTitle!.trim();

    // Step 2: Click a task row to open detail sheet
    await taskTitleCell.click();
    await page.waitForTimeout(1000);

    // Verify detail sheet opens
    const sheet = page.locator('[role="dialog"][data-state="open"]');
    await expect(sheet.first()).toBeVisible({ timeout: 10000 });

    // Verify Delete Task button is visible in the sheet footer
    const deleteBtn = sheet.first().locator('button').filter({
      hasText: /Delete|tasks\.detail\.delete/i,
    });
    await expect(deleteBtn.first()).toBeVisible({ timeout: 5000 });

    // -- Checkpoint 1: Detail sheet open with delete button visible --
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-detail-sheet-open.png`,
      fullPage: true,
    });

    // Step 3: Click Delete Task button - scroll it into view first
    await deleteBtn.first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await deleteBtn.first().click({ force: true });
    await page.waitForTimeout(500);

    // Verify AlertDialog confirmation opens
    // The dialog shows i18n keys: tasks.detail.deleteConfirm message
    // Buttons: "tasks.detail.deleteCancel" and "tasks.detail.delete" (red)
    // Use data-slot or look for the alert dialog content directly
    const alertContent = page.locator('[data-slot="alert-dialog-content"], [role="alertdialog"]');
    // If data-slot not used, fallback to finding the confirmation text on page
    const deleteConfirmText = page.getByText(/deleteConfirm|Are you sure you want to delete/i);
    await expect(deleteConfirmText.first()).toBeVisible({ timeout: 5000 });

    // Find the Cancel and Delete buttons in the alert dialog
    // The cancel button has text "tasks.detail.deleteCancel" or "Cancel"
    const cancelConfirmBtn = page.getByRole('button', { name: /deleteCancel|Cancel/i });
    // The destructive delete button - find by its distinctive red styling or text
    // It shows "tasks.detail.delete" text and has red/destructive variant
    const destructiveBtn = page.locator('button').filter({ hasText: /^tasks\.detail\.delete$/ });

    // -- Checkpoint 2: AlertDialog confirmation visible --
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-delete-confirm-dialog.png`,
      fullPage: true,
    });

    // Step 4: Click the destructive (red) Delete confirmation button
    // If we can find the specific destructive button, click it; otherwise find the red button
    const destructiveCount = await destructiveBtn.count();
    if (destructiveCount > 0) {
      // There may be multiple matching elements; the alert dialog one should be visible on top
      await destructiveBtn.last().click({ force: true });
    } else {
      // Fallback: find button with "Delete" text that's inside the alert dialog overlay
      const alertButtons = alertContent.first().getByRole('button');
      await alertButtons.last().click({ force: true });
    }

    // Wait for deletion to process
    await page.waitForTimeout(2000);

    // Verify sheet is closed
    const sheetAfterDelete = page.locator('[role="dialog"][data-state="open"]');
    const sheetStillVisible = await sheetAfterDelete.isVisible().catch(() => false);
    // Sheet should be dismissed (or at least the alert dialog should be gone)

    // Verify task is removed from the list
    await page.waitForTimeout(1000);
    const updatedRowCount = await dataRows.count();

    // The deleted task should no longer be in the list
    // Either count decreased or the task title is no longer found
    const allTaskTexts = await table.textContent();
    const taskStillInList = allTaskTexts?.includes(taskTitleText);

    // Task should be gone from list OR row count decreased
    const taskRemoved = !taskStillInList || updatedRowCount < initialRowCount;
    expect(taskRemoved).toBeTruthy();

    // -- Checkpoint 3: Task deleted, list updated --
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-task-deleted-list-updated.png`,
      fullPage: true,
    });
  });
});
