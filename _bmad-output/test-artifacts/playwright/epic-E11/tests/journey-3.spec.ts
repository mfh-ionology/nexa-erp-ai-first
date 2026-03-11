import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E11/journey-3';

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

test.describe('Journey 3: Create Task Form Validation', () => {
  test('Title is required and form shows validation errors on empty submit', async ({ page }) => {
    // Login
    await login(page);

    // Step 1: Navigate to /tasks
    await spaNavigate(page, '/tasks');

    const heading = page.locator('h1');
    await expect(heading.first()).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // Checkpoint 1: Tasks page loaded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-tasks-page-loaded.png`,
      fullPage: true,
    });

    // Step 2: Click "+ Create Task" button
    const createBtn = page.getByRole('button', { name: /Create Task|tasks\.create\.title/i });
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    // Wait for dialog to appear
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Verify the title input is visible and empty
    const titleInput = dialog.locator('input[name="title"]');
    await expect(titleInput).toBeVisible();
    await expect(titleInput).toHaveValue('');

    // Checkpoint 2: Dialog open empty
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-dialog-open-empty.png`,
      fullPage: true,
    });

    // Step 3: Clear the title field (it may have placeholder/default text) and click Create
    await titleInput.click();
    await titleInput.clear();
    await expect(titleInput).toHaveValue('');

    // Find the submit button (Create)
    const submitBtn = dialog.locator('button[type="submit"]');
    if (await submitBtn.count() > 0) {
      await submitBtn.click();
    } else {
      // Fallback: find by text
      const submitByText = dialog.getByRole('button', { name: /^Create$|tasks\.create\.submit/i }).last();
      await submitByText.click();
    }

    // Wait a moment for validation to trigger
    await page.waitForTimeout(1000);

    // Verify dialog is still open (not dismissed)
    await expect(dialog).toBeVisible();

    // Verify validation error is shown
    // The error uses text-[#ef4444] class on a <p> element with text "tasks.create.titleRequired" or translated text
    const errorMessages = dialog.locator('p.text-xs').filter({ hasText: /required|titleRequired/i });
    const errorByColor = dialog.locator('[class*="ef4444"]');
    const hasError = (await errorMessages.count() > 0) || (await errorByColor.count() > 0);

    expect(hasError).toBeTruthy();

    // Verify the title input is still empty (form not cleared/reset)
    await expect(titleInput).toHaveValue('');

    // Checkpoint 3: Validation error visible
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-validation-error.png`,
      fullPage: true,
    });

    if (await errorMessages.count() > 0) {
      const errorText = await errorMessages.first().textContent();
      console.log(`Validation error text: "${errorText}"`);
    }
  });
});
