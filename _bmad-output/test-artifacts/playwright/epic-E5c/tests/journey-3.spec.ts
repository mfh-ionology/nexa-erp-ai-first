import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR = '../../screenshots/epic-E5c/journey-3';

/**
 * Helper: navigate within the SPA using TanStack Router.
 * Auth tokens are in-memory only (Zustand), so page.goto() would
 * cause a full reload and lose the authenticated session.
 */
async function spaNavigate(page: import('@playwright/test').Page, path: string) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await page.waitForTimeout(500);
  await page.waitForLoadState('networkidle');
}

test.describe('Journey 3: Edit Model — Default Toggle and Business Rules', () => {
  test.setTimeout(180_000);

  test.beforeEach(async ({ page }) => {
    // Login as admin user
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const emailInput = page.getByLabel('Email');
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.fill('admin@nexa-erp.dev');

    const passwordInput = page.getByLabel('Password');
    await passwordInput.fill('NexaDev2026!');

    const signInButton = page.getByRole('button', { name: /sign in/i });
    await signInButton.waitFor({ state: 'visible' });
    await signInButton.click();

    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 30000,
    });
    await page.waitForLoadState('networkidle');
  });

  test('Edit model default toggle and verify cannot deactivate default model', async ({
    page,
  }) => {
    // ── Setup: Ensure 'test-gpt-4o' model exists (prerequisite from journey 2) ──
    await spaNavigate(page, '/ai/admin/models');
    await expect(
      page.getByLabel('breadcrumb').getByText('Model Registry'),
    ).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    const modelVisible = await page
      .getByText('test-gpt-4o')
      .first()
      .isVisible()
      .catch(() => false);

    if (!modelVisible) {
      // Create the prerequisite model
      await page.getByRole('button', { name: /New/i }).click();
      await page.waitForURL('**/ai/admin/models/new', { timeout: 10000 });
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { name: 'New Model' })).toBeVisible({ timeout: 10000 });

      await page.getByLabel('Name', { exact: true }).fill('test-gpt-4o');
      await page.getByLabel('Display Name').fill('GPT-4o Test Model');

      const providerTrigger = page.locator('button[role="combobox"]').first();
      await providerTrigger.click();
      await page.getByRole('option', { name: 'Openai' }).click();
      // Wait for dropdown to close
      await page.waitForTimeout(500);

      await page.getByLabel('Model ID').fill('gpt-4o-2024-08-06');
      await page.getByLabel('Max Input Tokens').fill('128000');
      await page.getByLabel('Max Output Tokens').fill('16384');
      await page.getByLabel('Cost per Million Input Tokens ($)').fill('2.50');
      await page.getByLabel('Cost per Million Output Tokens ($)').fill('10.00');

      // Listen for the API response
      const saveResponsePromise = page.waitForResponse(
        (resp) => resp.url().includes('/ai/admin/models') && resp.request().method() === 'POST',
        { timeout: 20000 },
      );

      await page.getByRole('button', { name: 'Save' }).click();

      // Wait for the API response
      const saveResponse = await saveResponsePromise;
      const status = saveResponse.status();
      if (status >= 400) {
        const body = await saveResponse.text().catch(() => 'no body');
        throw new Error(`Setup: model creation failed with ${status}: ${body}`);
      }

      // Wait for navigation or toast
      await page.waitForTimeout(3000);
      await page.waitForLoadState('networkidle');

      // Navigate back to model list
      await spaNavigate(page, '/ai/admin/models');
      await expect(
        page.getByLabel('breadcrumb').getByText('Model Registry'),
      ).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(2000);

      // Confirm model now appears
      await expect(page.getByText('test-gpt-4o').first()).toBeVisible({ timeout: 10000 });
    }

    // ── Step 1: Navigate to /ai/admin/models ──────────────────────────────────
    // Already on this page from setup
    await expect(page.getByText('test-gpt-4o').first()).toBeVisible({
      timeout: 10000,
    });

    // ── Step 2: Click on 'test-gpt-4o' row to open edit form ──────────────────
    await page.getByText('test-gpt-4o').first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Verify edit form loaded with correct data
    await expect(page.getByText('GPT-4o Test Model')).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole('tab', { name: 'Primary' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Advanced' })).toBeVisible();

    // ── Checkpoint 1: Model Edit Form Loaded ──────────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-model-edit-form.png`,
      fullPage: true,
    });

    // ── Step 3: Toggle Default Model to ON ────────────────────────────────────
    const defaultToggleContainer = page
      .locator('.rounded-lg.border.p-4')
      .filter({ hasText: 'Default Model' });
    await expect(defaultToggleContainer).toBeVisible();

    const defaultSwitch = defaultToggleContainer.getByRole('switch');
    await expect(defaultSwitch).toBeVisible();

    // Ensure it's toggled ON
    const defaultState = await defaultSwitch.getAttribute('data-state');
    if (defaultState !== 'checked') {
      await defaultSwitch.click();
    }

    // Verify the description text about unsetting previous default is visible
    await expect(
      page.getByText('Setting as default will unset the current default model'),
    ).toBeVisible();

    // ── Step 4: Click Save ────────────────────────────────────────────────────
    const saveButton = page.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
    await saveButton.click();

    // Wait for success toast
    await expect(page.getByText('Model updated successfully')).toBeVisible({
      timeout: 15000,
    });
    await page.waitForTimeout(1000);

    // ── Checkpoint 2: Default Toggle Set — Success Toast ──────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-default-set-success.png`,
      fullPage: true,
    });

    // ── Step 5: Navigate back to model list ───────────────────────────────────
    await spaNavigate(page, '/ai/admin/models');
    await expect(
      page.getByLabel('breadcrumb').getByText('Model Registry'),
    ).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000);

    // Verify test-gpt-4o row has the Default badge
    const testModelRow = page.getByRole('row').filter({ hasText: 'test-gpt-4o' });
    await expect(testModelRow).toBeVisible();
    await expect(testModelRow.getByText('Default')).toBeVisible();

    // Count total Default badges in the table — should be exactly 1
    const allDefaultBadges = page.locator(
      'table td >> text=Default',
    );
    await expect(allDefaultBadges).toHaveCount(1);

    // ── Checkpoint 3: Model List — Only One Default Badge ─────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-model-list-single-default.png`,
      fullPage: true,
    });

    // ── Step 6: Click on 'test-gpt-4o' again ──────────────────────────────────
    await page.getByText('test-gpt-4o').first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await expect(page.getByText('GPT-4o Test Model')).toBeVisible({
      timeout: 10000,
    });

    // ── Step 7: Toggle Active to OFF ──────────────────────────────────────────
    const activeToggleContainer = page
      .locator('.rounded-lg.border.p-4')
      .filter({ hasText: /^Active/ });
    await expect(activeToggleContainer).toBeVisible();

    const activeSwitch = activeToggleContainer.getByRole('switch');
    await expect(activeSwitch).toBeVisible();

    // Toggle OFF if currently checked
    const activeState = await activeSwitch.getAttribute('data-state');
    if (activeState === 'checked') {
      await activeSwitch.click();
    }

    // ── Step 8: Click Save — expect 422 error ─────────────────────────────────
    const saveButton2 = page.getByRole('button', { name: 'Save' });
    await expect(saveButton2).toBeEnabled({ timeout: 5000 });
    await saveButton2.click();

    // Expect error toast about deactivating default model
    await expect(
      page
        .getByText(/cannot deactivate/i)
        .or(page.getByText(/deactivate.*default/i))
        .first(),
    ).toBeVisible({ timeout: 15000 });

    // ── Checkpoint 4: Deactivate Default Model — Error Toast ──────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-8-deactivate-default-error.png`,
      fullPage: true,
    });

    // ── Cleanup: Unset default flag and delete test model ─────────────────────
    // Reload to reset the form state (the failed save may have left the form dirty)
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Unset the Default toggle
    const cleanupDefaultContainer = page
      .locator('.rounded-lg.border.p-4')
      .filter({ hasText: 'Default Model' });
    const cleanupDefaultSwitch = cleanupDefaultContainer.getByRole('switch');
    const cleanupDefaultState = await cleanupDefaultSwitch
      .getAttribute('data-state')
      .catch(() => 'unchecked');
    if (cleanupDefaultState === 'checked') {
      await cleanupDefaultSwitch.click();
    }

    // Save to clear default
    const cleanupSave = page.getByRole('button', { name: 'Save' });
    if (await cleanupSave.isEnabled()) {
      await cleanupSave.click();
      await page.waitForTimeout(3000);
    }

    // Delete the test model
    const deleteButton = page.getByRole('button', { name: 'Delete' });
    if (await deleteButton.isVisible().catch(() => false)) {
      await deleteButton.click();
      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible({ timeout: 5000 });
      await dialog.getByRole('button', { name: 'Delete' }).click();
      await page.waitForURL('**/ai/admin/models', { timeout: 10000 });
    }
  });
});
