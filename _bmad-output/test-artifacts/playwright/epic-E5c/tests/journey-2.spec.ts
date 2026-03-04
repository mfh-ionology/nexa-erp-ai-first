import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR = '../../screenshots/epic-E5c/journey-2';

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

test.describe('Journey 2: Create a New AI Model', () => {
  test.setTimeout(120_000);

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

    // Wait for navigation away from /login
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 30000,
    });
    await page.waitForLoadState('networkidle');
  });

  test('Create a new AI model with all fields and verify it appears in the list', async ({
    page,
  }) => {
    // ── Step 1: Navigate to /ai/admin/models ──────────────────────────────
    await spaNavigate(page, '/ai/admin/models');
    await expect(
      page.getByLabel('breadcrumb').getByText('Model Registry'),
    ).toBeVisible({ timeout: 15000 });
    // Wait for data to load
    await page.waitForTimeout(2000);

    // ── Checkpoint 1: Model Registry List Page ────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-model-registry-list.png`,
      fullPage: true,
    });

    // ── Step 2: Verify seeded models (at least 3) ─────────────────────────
    await expect(page.getByText('claude-opus-4-6').first()).toBeVisible();
    await expect(page.getByText('claude-sonnet-4-6').first()).toBeVisible();
    await expect(page.getByText('claude-haiku-4-5').first()).toBeVisible();

    // ── Step 3: Click "New" button to open create form ────────────────────
    const newButton = page.getByRole('button', { name: /New/i });
    await expect(newButton).toBeVisible();
    await newButton.click();

    // Wait for the form page to load
    await page.waitForURL('**/ai/admin/models/new', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('New Model')).toBeVisible({ timeout: 10000 });

    // Verify tabs exist
    await expect(page.getByRole('tab', { name: 'Primary' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Advanced' })).toBeVisible();

    // ── Checkpoint 2: Model Creation Form (Primary Tab) ───────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-new-model-form.png`,
      fullPage: true,
    });

    // ── Step 4: Fill Primary tab fields ───────────────────────────────────
    await page.getByLabel('Name').fill('test-gpt-4o');
    await page.getByLabel('Display Name').fill('GPT-4o Test Model');

    // Provider — radix Select: click trigger, then option
    const providerTrigger = page.locator('button[role="combobox"]').first();
    await providerTrigger.click();
    await page.getByRole('option', { name: 'Openai' }).click();

    await page.getByLabel('Model ID').fill('gpt-4o-2024-08-06');
    await page.getByLabel('Max Input Tokens').fill('128000');
    await page.getByLabel('Max Output Tokens').fill('16384');
    await page.getByLabel('Cost per Million Input Tokens ($)').fill('2.50');
    await page.getByLabel('Cost per Million Output Tokens ($)').fill('10.00');

    // ── Step 5: Switch to Advanced tab ────────────────────────────────────
    await page.getByRole('tab', { name: 'Advanced' }).click();
    await page.waitForTimeout(500);

    // Verify Advanced tab content
    await expect(page.getByText('Routing Tags')).toBeVisible();
    await expect(page.getByText('Capabilities')).toBeVisible();
    await expect(page.getByText('Fallback Model')).toBeVisible();

    // ── Step 6: Fill Advanced tab fields ──────────────────────────────────
    // Add routing tags by clicking "+ standard" and "+ vision" buttons
    await page.getByRole('button', { name: '+ standard' }).click();
    await page.getByRole('button', { name: '+ vision' }).click();

    // Verify tags appear as badges
    await expect(page.locator('.gap-1').filter({ hasText: 'standard' }).first()).toBeVisible();
    await expect(page.locator('.gap-1').filter({ hasText: 'vision' }).first()).toBeVisible();

    // Fill Capabilities JSON
    const capabilitiesField = page.getByLabel('Capabilities');
    await capabilitiesField.clear();
    await capabilitiesField.fill('{"vision": true, "structured_output": true}');

    // Select Fallback Model
    const fallbackTrigger = page.locator('button[role="combobox"]').filter({ hasText: /No fallback model/i });
    await fallbackTrigger.click();
    // Select an option containing "sonnet"
    await page.getByRole('option').filter({ hasText: /sonnet/i }).first().click();

    // ── Checkpoint 3: Advanced Tab with Routing Tags ──────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-advanced-tab-filled.png`,
      fullPage: true,
    });

    // ── Step 7: Click Save ────────────────────────────────────────────────
    const saveButton = page.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    // Wait for success toast
    await expect(page.getByText('Model created successfully')).toBeVisible({ timeout: 15000 });

    // Should navigate to edit page for the new model
    await page.waitForLoadState('networkidle');

    // ── Checkpoint 4: Model Created Successfully ──────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-7-model-created-toast.png`,
      fullPage: true,
    });

    // ── Step 8: Navigate back to model list and verify new model ──────────
    await spaNavigate(page, '/ai/admin/models');
    await expect(
      page.getByLabel('breadcrumb').getByText('Model Registry'),
    ).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000);

    // Verify the new model appears in the list
    await expect(page.getByText('test-gpt-4o').first()).toBeVisible({ timeout: 10000 });

    // Verify provider shows openai
    await expect(page.getByText('openai').first()).toBeVisible();

    // Verify routing tag badges visible
    await expect(page.getByText('standard').first()).toBeVisible();
    await expect(page.getByText('vision').first()).toBeVisible();

    // ── Checkpoint 5: Updated Model List ──────────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-8-model-list-with-new.png`,
      fullPage: true,
    });

    // ── Cleanup: Delete the test model ────────────────────────────────────
    // Navigate to the test model's edit page
    await page.getByText('test-gpt-4o').first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Click Delete button in the action bar
    const deleteButton = page.getByRole('button', { name: 'Delete' });
    await expect(deleteButton).toBeVisible({ timeout: 10000 });
    await deleteButton.click();

    // Confirm deletion in dialog
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    const confirmDeleteButton = dialog.getByRole('button', { name: 'Delete' });
    await confirmDeleteButton.click();

    // Wait for redirect back to list
    await page.waitForURL('**/ai/admin/models', { timeout: 10000 });
  });
});
