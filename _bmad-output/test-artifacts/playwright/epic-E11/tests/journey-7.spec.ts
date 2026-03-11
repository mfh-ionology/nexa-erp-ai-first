import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E11/journey-7';

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

test.describe('Journey 7: Status Actions in Task Detail Sheet', () => {
  test('transitions OPEN -> IN_PROGRESS -> COMPLETED via detail sheet buttons', async ({
    page,
  }) => {
    // Login
    await login(page);

    // Step 1: Navigate to /tasks
    await spaNavigate(page, '/tasks');

    const heading = page.locator('h1');
    await expect(heading.first()).toBeVisible({ timeout: 15000 });

    // Wait for table data
    const table = page.locator('table');
    await expect(table).toBeVisible({ timeout: 15000 });
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 10000 });

    // Step 2: Click an OPEN task row to open the detail sheet
    const openStatusBtn = page
      .locator('button[aria-label="Task status: open"]')
      .first();
    await expect(openStatusBtn).toBeVisible({ timeout: 10000 });

    // Get the row containing the OPEN task and click the title cell
    const openRow = page
      .locator('table tbody tr')
      .filter({ has: page.locator('button[aria-label="Task status: open"]') })
      .first();
    const titleCell = openRow.locator('td').nth(2);
    await titleCell.click();

    // Wait for sheet to open
    const sheet = page.locator('[role="dialog"][data-state="open"]');
    await expect(sheet.first()).toBeVisible({ timeout: 10000 });
    const sheetContent = sheet.first();

    // Verify Start button exists (text may be "Start" or i18n key "tasks.detail.start")
    const startBtn = sheetContent.locator('button').filter({
      hasText: /Start|tasks\.detail\.start/i,
    });
    await expect(startBtn.first()).toBeVisible({ timeout: 5000 });

    // Verify Complete button exists
    const completeBtn = sheetContent.locator('button').filter({
      hasText: /Complete|tasks\.detail\.complete/i,
    });
    await expect(completeBtn.first()).toBeVisible({ timeout: 5000 });

    // Verify Cancel button exists
    const cancelBtn = sheetContent.locator('button').filter({
      hasText: /Cancel|tasks\.detail\.cancel/i,
    });
    await expect(cancelBtn.first()).toBeVisible({ timeout: 5000 });

    // Checkpoint 1: Detail sheet open with OPEN status
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-detail-sheet-open-status.png`,
      fullPage: true,
    });

    // Step 3: Click "Start" button to transition to IN_PROGRESS
    await startBtn.first().click();
    // Wait for mutation + query refetch
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Screenshot to capture actual state after clicking Start
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-status-in-progress.png`,
      fullPage: true,
    });

    // Verify status changed — Start button should be gone
    // Using a longer timeout to allow for query invalidation
    await expect(startBtn.first()).not.toBeVisible({ timeout: 10000 });

    // Complete button should still be visible
    const completeBtnAfterStart = sheetContent.locator('button').filter({
      hasText: /Complete|tasks\.detail\.complete/i,
    });
    await expect(completeBtnAfterStart.first()).toBeVisible({ timeout: 5000 });

    // Step 4: Click "Complete" button to transition to COMPLETED
    await completeBtnAfterStart.first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Screenshot to capture actual state after clicking Complete
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-status-completed.png`,
      fullPage: true,
    });

    // Verify all action buttons are gone (terminal state)
    const startBtnFinal = sheetContent.locator('button').filter({
      hasText: /Start|tasks\.detail\.start/i,
    });
    await expect(startBtnFinal.first()).not.toBeVisible({ timeout: 10000 });

    const completeBtnFinal = sheetContent.locator('button').filter({
      hasText: /Complete|tasks\.detail\.complete/i,
    });
    await expect(completeBtnFinal.first()).not.toBeVisible({ timeout: 10000 });

    // Verify completed text is shown
    const completedText = sheetContent.locator('text=/Completed|tasks\\.status\\.completed|TASKS\\.STATUS\\.COMPLETED/i');
    const hasCompletedText = await completedText.count();
    expect(hasCompletedText).toBeGreaterThanOrEqual(1);
  });
});
