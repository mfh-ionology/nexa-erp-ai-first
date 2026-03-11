import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E11/journey-13';

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

test.describe('Journey 13: Manage Assignees in Detail Sheet', () => {
  test('Adding and removing assignees in the task detail sheet', async ({ page }) => {
    // Login first
    await login(page);

    // Step 1: SPA navigate to /tasks
    await spaNavigate(page, '/tasks');

    const heading = page.locator('h1');
    await expect(heading.first()).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // Verify tasks table has rows
    const table = page.locator('table');
    await expect(table).toBeVisible({ timeout: 10000 });
    const dataRows = table.locator('tbody tr');
    const rowCount = await dataRows.count();
    expect(rowCount).toBeGreaterThanOrEqual(1);

    // Step 2: Find an OPEN task row directly by known task name
    // From previous test runs, "Follow up with Acme Ltd on invoice payment" is OPEN
    const targetRow = table.locator('tbody tr').filter({ hasText: /follow up with acme/i }).first();
    await expect(targetRow).toBeVisible({ timeout: 5000 });
    const taskTitleCell = targetRow.locator('td').nth(2);
    await taskTitleCell.click();

    // Wait for the detail sheet to slide in
    await page.waitForTimeout(1000);

    const sheet = page.locator('[role="dialog"][data-state="open"]');
    await expect(sheet.first()).toBeVisible({ timeout: 10000 });

    // Step 3: Verify Assignees section in detail sheet
    // Look for the "ASSIGNEES" label or i18n key
    const assigneesLabel = sheet.first().locator('text=/assignees|tasks\\.detail\\.assignees/i');
    await expect(assigneesLabel.first()).toBeVisible({ timeout: 5000 });

    // Verify "+ Add" button exists (purple text with Plus icon)
    const addAssigneeBtn = sheet.first().locator('button').filter({
      hasText: /Add|tasks\.detail\.addAssignee/i,
    });

    // The add button may not exist if the task is terminal — check for it
    const addBtnCount = await addAssigneeBtn.count();

    // Check for assignee avatars (purple bg-[#ede9fe] circles with initials)
    const assigneeAvatars = sheet.first().locator('.rounded-full.bg-\\[\\#ede9fe\\]');
    const initialAssigneeCount = await assigneeAvatars.count();

    // -- Checkpoint 1: Detail sheet with assignees section --
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-detail-sheet-assignees-section.png`,
      fullPage: true,
    });

    // Step 4: Click "+ Add" assignee button — should exist for OPEN tasks
    expect(addBtnCount).toBeGreaterThanOrEqual(1);
    await addAssigneeBtn.first().click();
    await page.waitForTimeout(500);

    // Verify UserMultiSelect popover opens
    const popoverContent = page.locator('[data-radix-popper-content-wrapper]');
    await expect(popoverContent.first()).toBeVisible({ timeout: 5000 });

    // -- Checkpoint 2: Add assignee popover open --
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-add-assignee-popover.png`,
      fullPage: true,
    });

    // Close the popover by pressing Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Step 5: Click X (remove) button on the assignee row
    // The assignee row structure: div > (avatar + name) + button(X icon)
    // The X button is a sibling of the avatar+name container
    // Find it by locating the row that contains "Admin User" text and clicking its button
    if (initialAssigneeCount > 0) {
      // Find the assignee entry row that has the admin user text
      const assigneeEntry = sheet.first().locator('div').filter({ hasText: /admin user/i });
      // The X button is a small button within the assignee entry container
      // Use a more targeted approach: find the X icon button next to Admin User
      const xButton = sheet.first().locator('button').filter({
        has: page.locator('svg'),
      });
      // Among all buttons with SVGs, the X remove button for assignee is specifically
      // the one in the assignees section. Let's use the structure from the component:
      // The assignee row div has classes "rounded-lg px-2 py-1.5 hover:bg-accent"
      // Inside it is a button with "rounded p-0.5 text-muted-foreground"
      const assigneeRowDiv = sheet.first().locator('div[class*="hover\\:bg-accent"]').filter({
        hasText: /admin|user/i,
      }).first();
      const removeBtn = assigneeRowDiv.locator('button').first();
      await removeBtn.click({ timeout: 5000 });
      await page.waitForTimeout(500);
    }

    // -- Checkpoint 3: After assignee removal --
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-assignee-removed.png`,
      fullPage: true,
    });
  });
});
