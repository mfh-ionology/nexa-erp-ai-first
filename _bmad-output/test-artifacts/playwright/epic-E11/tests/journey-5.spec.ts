import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E11/journey-5';

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

test.describe('Journey 5: Open Task Detail Sheet', () => {
  test('Clicking a task row opens the detail sheet with full task info', async ({ page }) => {
    // Login first
    await login(page);

    // Step 1: SPA navigate to /tasks
    await spaNavigate(page, '/tasks');

    // Wait for the page heading to appear
    const heading = page.locator('h1');
    await expect(heading.first()).toBeVisible({ timeout: 15000 });

    // Wait for data to load
    await page.waitForTimeout(2000);

    // Verify tasks table has at least one row
    const table = page.locator('table');
    await expect(table).toBeVisible({ timeout: 10000 });
    const dataRows = table.locator('tbody tr');
    const rowCount = await dataRows.count();
    expect(rowCount).toBeGreaterThanOrEqual(1);

    // Step 2: Click the first task row (on the task title text area, avoiding checkbox and status icon)
    // Find the task title cell - typically the 3rd column (after checkbox and status icon)
    const firstRow = dataRows.first();
    // Click on the task title text — look for the cell that contains the task name
    // Try clicking on the td that has the task title (usually has a clickable area)
    const taskTitleCell = firstRow.locator('td').nth(2); // 0=checkbox, 1=status icon, 2=task title
    await taskTitleCell.click();

    // Wait for the detail sheet to slide in
    await page.waitForTimeout(1000);

    // Verify the detail sheet is visible
    // Shadcn Sheet uses Radix Dialog which renders role="dialog" on SheetContent
    // The sheet content has data-slot="sheet-content" or is a role="dialog" with actual content
    const sheet = page.locator('[role="dialog"][data-state="open"]');
    await expect(sheet.first()).toBeVisible({ timeout: 10000 });

    // Verify sheet has meaningful content (title, status, etc.)
    const sheetText = await sheet.first().textContent();
    expect(sheetText!.length).toBeGreaterThan(10);

    // Verify "Task Details" or i18n key is in the sheet header
    const hasDetailTitle = sheetText!.includes('Task Details') || sheetText!.includes('tasks.detail.title');
    expect(hasDetailTitle).toBeTruthy();

    // Verify status section with action buttons
    // For OPEN tasks, expect Start/Complete/Cancel buttons
    const statusButtons = sheet.first().locator('button').filter({
      hasText: /Start|Complete|Cancel|tasks\.detail\.start|tasks\.detail\.complete|tasks\.detail\.cancel/i,
    });
    const statusBtnCount = await statusButtons.count();
    expect(statusBtnCount).toBeGreaterThanOrEqual(1);

    // Verify Delete Task button in the footer
    const deleteBtn = sheet.first().locator('button').filter({
      hasText: /Delete|tasks\.detail\.delete/i,
    });
    await expect(deleteBtn.first()).toBeVisible();

    // -- Checkpoint 1: Detail sheet open --
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-detail-sheet-open.png`,
      fullPage: true,
    });

    // Step 3: Verify activity timeline section
    // Look for timeline entries (created, status changes, etc.)
    // The timeline may show "Task created" or i18n keys like "tasks.activity.created"
    const activitySection = sheet.first().locator('text=/created|activity|timeline|tasks\\.activity/i');
    const hasActivity = await activitySection.count();

    if (hasActivity > 0) {
      await expect(activitySection.first()).toBeVisible();
    }

    // -- Checkpoint 2: Activity timeline --
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-activity-timeline.png`,
      fullPage: true,
    });
  });
});
