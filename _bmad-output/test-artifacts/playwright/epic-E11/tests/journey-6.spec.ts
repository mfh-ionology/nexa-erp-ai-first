import { test, expect } from '@playwright/test';

const screenshotDir =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E11/journey-6';

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

test.describe('Journey 6: Status Cycling via Table Icon Click', () => {
  test('cycles OPEN -> IN_PROGRESS -> COMPLETED and blocks further cycling', async ({
    page,
  }) => {
    // Login
    await login(page);

    // Step 1 — SPA navigate to /tasks
    await spaNavigate(page, '/tasks');

    // Wait for heading
    const heading = page.locator('h1');
    await expect(heading.first()).toBeVisible({ timeout: 15000 });

    // Wait for table to appear (desktop view)
    const table = page.locator('table');
    await expect(table).toBeVisible({ timeout: 15000 });

    // Wait for data rows to load
    await expect(
      page.locator('table tbody tr').first(),
    ).toBeVisible({ timeout: 10000 });

    // Find the first OPEN task's status icon button
    const openStatusBtn = page
      .locator('button[aria-label="Task status: open"]')
      .first();
    await expect(openStatusBtn).toBeVisible({ timeout: 10000 });

    // Screenshot: page loaded with OPEN tasks
    await page.screenshot({
      path: `${screenshotDir}/step-1-tasks-page-loaded.png`,
    });

    // Step 2 — Click the OPEN status icon -> should become IN_PROGRESS
    await openStatusBtn.click();

    // Wait for the status to transition — the IN_PROGRESS icon should appear
    const inProgressBtn = page
      .locator('button[aria-label="Task status: in progress"]')
      .first();
    await expect(inProgressBtn).toBeVisible({ timeout: 10000 });

    // The status label text should show In Progress
    const inProgressLabel = page
      .locator('table tbody span')
      .filter({ hasText: /^In Progress$|^tasks\.status\.inProgress$/ })
      .first();
    await expect(inProgressLabel).toBeVisible({ timeout: 5000 });

    // Screenshot: after first click
    await page.screenshot({
      path: `${screenshotDir}/step-2-status-in-progress.png`,
    });

    // Step 3 — Click the IN_PROGRESS icon -> should become COMPLETED
    await inProgressBtn.click();

    // Wait for COMPLETED icon to appear
    const completedBtn = page
      .locator('button[aria-label="Task status: completed"]')
      .first();
    await expect(completedBtn).toBeVisible({ timeout: 10000 });

    // Check the completed label text
    const completedLabel = page
      .locator('table tbody span')
      .filter({ hasText: /^Completed$|^tasks\.status\.completed$/ })
      .first();
    await expect(completedLabel).toBeVisible({ timeout: 5000 });

    // Verify line-through on the task title in a completed row
    const completedRow = page
      .locator('table tbody tr')
      .filter({
        has: page.locator('button[aria-label="Task status: completed"]'),
      })
      .first();
    const titleCell = completedRow.locator('span.line-through').first();
    await expect(titleCell).toBeVisible();

    // Screenshot: after second click
    await page.screenshot({
      path: `${screenshotDir}/step-3-status-completed.png`,
    });

    // Step 4 — Click the COMPLETED icon -> should NOT change (terminal state)
    await expect(completedBtn).toBeDisabled();

    // Click it anyway with force and verify nothing changes
    await completedBtn.click({ force: true });
    await page.waitForTimeout(500);

    // Still completed and disabled
    await expect(completedBtn).toBeVisible();
    await expect(completedBtn).toBeDisabled();

    // Screenshot: terminal state
    await page.screenshot({
      path: `${screenshotDir}/step-4-terminal-state-no-change.png`,
    });
  });
});
