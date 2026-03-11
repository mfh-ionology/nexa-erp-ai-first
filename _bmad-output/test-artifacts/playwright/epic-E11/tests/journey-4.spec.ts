import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E11/journey-4';

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

test.describe('Journey 4: Create Task & Add Another', () => {
  test('Create a task with "Create & Add Another", then create a second task with "Create"', async ({ page }) => {
    // Login
    await login(page);

    // Step 1: Navigate to /tasks
    await spaNavigate(page, '/tasks');
    const heading = page.locator('h1');
    await expect(heading.first()).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // Step 2: Click "+ Create Task" button
    const createBtn = page.getByRole('button', { name: /Create Task|tasks\.create\.title/i });
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    // Wait for dialog
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Verify dialog fields exist
    const titleInput = dialog.locator('input[name="title"]');
    await expect(titleInput).toBeVisible();

    const createAndAnotherBtn = dialog.getByRole('button', { name: /Create & Add Another|submitAndAnother/i });
    await expect(createAndAnotherBtn).toBeVisible();

    // Checkpoint 1: Dialog open
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-create-dialog-open.png`,
      fullPage: true,
    });

    // Step 3: Fill title for first task
    await titleInput.click();
    await titleInput.fill('First task - review report');
    await expect(titleInput).toHaveValue('First task - review report');

    // Assign current user so task appears in My Tasks
    const assigneeTrigger = dialog.locator('[role="combobox"]').nth(1);
    if (await assigneeTrigger.isVisible()) {
      await assigneeTrigger.click();
      await page.waitForTimeout(500);

      const cmdkInput = page.locator('[cmdk-input], input[placeholder*="Search users"]');
      if (await cmdkInput.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await cmdkInput.first().fill('Admin');
        await page.waitForTimeout(1500);

        const adminItem = page.locator('[cmdk-item]').filter({ hasText: /Admin/i });
        if (await adminItem.first().isVisible({ timeout: 3000 }).catch(() => false)) {
          await adminItem.first().click();
          await page.waitForTimeout(300);
        }
      }
    }

    // Step 4: Click "Create & Add Another"
    const firstTaskResponse = page.waitForResponse(
      (resp) => resp.url().includes('/tasks') && resp.request().method() === 'POST',
      { timeout: 15000 },
    ).catch(() => null);

    await createAndAnotherBtn.click();

    // Wait for API response
    const resp1 = await firstTaskResponse;
    if (resp1) {
      const status = resp1.status();
      if (status >= 400) {
        const body = await resp1.text().catch(() => 'Could not read body');
        console.log(`API error on first create ${status}: ${body}`);
        await page.screenshot({
          path: `${SCREENSHOTS_DIR}/step-4-api-error.png`,
          fullPage: true,
        });
      }
      expect(status).toBeLessThan(400);
    }

    // Wait for form reset
    await page.waitForTimeout(1500);

    // Dialog should STILL be open
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Title should be cleared
    await expect(titleInput).toHaveValue('');

    // Checkpoint 2: Dialog still open, fields cleared, toast visible
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-create-and-add-another-fields-cleared.png`,
      fullPage: true,
    });

    // Step 5: Fill title for second task
    await titleInput.click();
    await titleInput.fill('Second task - send email');
    await expect(titleInput).toHaveValue('Second task - send email');

    // Assign current user for second task too
    const assigneeTrigger2 = dialog.locator('[role="combobox"]').nth(1);
    if (await assigneeTrigger2.isVisible()) {
      await assigneeTrigger2.click();
      await page.waitForTimeout(500);

      const cmdkInput2 = page.locator('[cmdk-input], input[placeholder*="Search users"]');
      if (await cmdkInput2.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await cmdkInput2.first().fill('Admin');
        await page.waitForTimeout(1500);

        const adminItem2 = page.locator('[cmdk-item]').filter({ hasText: /Admin/i });
        if (await adminItem2.first().isVisible({ timeout: 3000 }).catch(() => false)) {
          await adminItem2.first().click();
          await page.waitForTimeout(300);
        }
      }
    }

    // Step 6: Click "Create" button (submit, close dialog)
    const secondTaskResponse = page.waitForResponse(
      (resp) => resp.url().includes('/tasks') && resp.request().method() === 'POST',
      { timeout: 15000 },
    ).catch(() => null);

    const submitBtn = dialog.locator('button[type="submit"]');
    if (await submitBtn.count() > 0) {
      await submitBtn.click();
    } else {
      const submitByText = dialog.getByRole('button', { name: /^Create$|tasks\.create\.submit/i }).last();
      await submitByText.click();
    }

    // Wait for API response
    const resp2 = await secondTaskResponse;
    if (resp2) {
      const status = resp2.status();
      if (status >= 400) {
        const body = await resp2.text().catch(() => 'Could not read body');
        console.log(`API error on second create ${status}: ${body}`);
        await page.screenshot({
          path: `${SCREENSHOTS_DIR}/step-6-api-error.png`,
          fullPage: true,
        });
      }
      expect(status).toBeLessThan(400);
    }

    // Dialog should close
    await expect(dialog).toBeHidden({ timeout: 15000 });

    // Wait for list to refresh
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle');

    // Checkpoint 3: Both tasks visible in list
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-both-tasks-in-list.png`,
      fullPage: true,
    });

    // Verify both tasks appear in the table
    const firstTaskText = page.getByText('First task - review report');
    await expect(firstTaskText.first()).toBeVisible({ timeout: 15000 });

    const secondTaskText = page.getByText('Second task - send email');
    await expect(secondTaskText.first()).toBeVisible({ timeout: 15000 });
  });
});
