import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR = '../../screenshots/epic-E5c/journey-3';

test.describe('Journey 3: Model Business Rules Enforcement', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    // Login as admin user
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@nexa-erp.dev');
    await page.getByLabel('Password').fill('NexaDev2026!');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for redirect away from login page
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
    await page.waitForLoadState('networkidle');
  });

  test('Default model deactivation guard and circular fallback rejection', async ({ page }) => {
    // ── Step 1: Navigate to Model Registry ─────────────────────────────
    const sidebarNav = page.locator('nav');

    // Expand the AI sidebar group if it exists
    const aiGroupLabel = sidebarNav.getByText('AI', { exact: true }).first();
    if (await aiGroupLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await aiGroupLabel.click();
      await page.waitForTimeout(300);
    }

    // Click "Model Registry" in the sidebar
    const modelRegistryLink = sidebarNav.getByText('Model Registry').first();
    if (await modelRegistryLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await modelRegistryLink.click();
    } else {
      await page.locator('a[href="/ai/admin/models"]').first().click();
    }

    await page.waitForURL('**/ai/admin/models', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Wait for table to load
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // Verify breadcrumb confirms page loaded
    await expect(
      page.getByLabel('breadcrumb').getByText('Model Registry'),
    ).toBeVisible({ timeout: 15000 });

    // Verify seeded models visible
    await expect(page.getByText('claude-opus-4-6').first()).toBeVisible();

    // Verify at least one model has the "Default" badge
    await expect(page.getByText('Default').first()).toBeVisible();

    // ── Checkpoint 1: Model List with Default Badge ────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-model-list-with-default.png`,
      fullPage: true,
    });

    // ── Step 2: Click the row for the model marked as Default ──────────
    // Find the table row that contains the "Default" badge and click it
    const defaultRow = page.getByRole('row').filter({ hasText: 'Default' });
    await defaultRow.first().click();

    // Wait for model edit form to load
    await page.waitForURL('**/ai/admin/models/**', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Verify we're on the edit form (should show Primary tab)
    await expect(page.getByRole('tab', { name: 'Primary' })).toBeVisible({ timeout: 10000 });

    // Verify the "Default" badge is shown in the page header
    await expect(page.getByText('Default').first()).toBeVisible();

    // ── Step 3: Toggle Active to false ─────────────────────────────────
    // Click the Primary tab to ensure we see the Active toggle
    await page.getByRole('tab', { name: 'Primary' }).click();
    await page.waitForTimeout(500);

    // Find and toggle the Active switch off
    const activeSwitch = page.getByRole('switch', { name: /^active$/i });
    await expect(activeSwitch).toBeVisible({ timeout: 5000 });

    // Only toggle if it's currently checked (active)
    const isChecked = await activeSwitch.isChecked();
    if (isChecked) {
      await activeSwitch.click();
    }

    // ── Step 4: Click Save — expect error ──────────────────────────────
    const saveButton = page.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
    await saveButton.click();

    // Wait for error toast about deactivating default model
    // The API should return 422: "Cannot deactivate the default model"
    await expect(
      page.getByText(/cannot deactivate/i).or(page.getByText(/default model/i)),
    ).toBeVisible({ timeout: 15000 });

    // ── Checkpoint 2: Default Model Deactivation Error ─────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-deactivation-error.png`,
      fullPage: true,
    });

    // ── Step 5: Navigate to new model form ─────────────────────────────
    // Use breadcrumb to go back to list, then click New
    const modelRegistryBreadcrumb = page.locator('a').filter({ hasText: 'Model Registry' }).first();
    await modelRegistryBreadcrumb.click();

    await page.waitForURL('**/ai/admin/models', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15000 });

    // Click New button
    await page.getByRole('button', { name: 'New' }).click();
    await page.waitForURL('**/ai/admin/models/new', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('New Model')).toBeVisible({ timeout: 10000 });

    // ── Step 6: Fill form with fallback-test-a data ────────────────────
    await page.getByLabel('Name').fill('fallback-test-a');
    await page.getByLabel('Display Name').fill('Fallback Test A');

    // Provider dropdown — select Anthropic
    const providerTrigger = page.locator('button[role="combobox"]').first();
    await providerTrigger.click();
    await page.getByRole('option', { name: 'Anthropic' }).click();

    await page.getByLabel('Model ID').fill('fallback-a');
    await page.getByLabel('Max Input Tokens').fill('100000');
    await page.getByLabel('Max Output Tokens').fill('4096');
    await page.getByLabel('Cost per Million Input Tokens ($)').fill('1.00');
    await page.getByLabel('Cost per Million Output Tokens ($)').fill('5.00');

    // ── Step 7: Click Save to create model ─────────────────────────────
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
    await saveButton.click();

    // Wait for success toast
    await expect(page.getByText('Model created successfully')).toBeVisible({ timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // Verify we're now on the edit page for this model
    await expect(page.getByText('Fallback Test A').first()).toBeVisible({ timeout: 10000 });

    // ── Checkpoint 3: New Model Created ────────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-7-model-created.png`,
      fullPage: true,
    });

    // ── Step 8: Click Advanced tab ─────────────────────────────────────
    await page.getByRole('tab', { name: 'Advanced' }).click();
    await page.waitForTimeout(500);

    // Verify Advanced tab content visible
    await expect(page.getByText('Routing Tags')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Fallback Model')).toBeVisible();

    // ── Step 9: Set fallback model to claude-opus-4-6 ──────────────────
    const fallbackTrigger = page.locator('button[role="combobox"]').filter({ hasText: /No fallback model/i });
    await fallbackTrigger.click();

    // Select claude-opus-4-6 from the dropdown
    const opusOption = page.getByRole('option').filter({ hasText: /opus/i });
    await opusOption.first().click();

    // ── Step 10: Click Save to update fallback ─────────────────────────
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
    await saveButton.click();

    // Wait for save to complete (no explicit success toast for updates per the codebase,
    // but the form should reset dirty state)
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');

    // ── Checkpoint 4: Fallback Set ─────────────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-10-fallback-saved.png`,
      fullPage: true,
    });

    // ── Step 11: Navigate back to model list ───────────────────────────
    const breadcrumbBack = page.locator('a').filter({ hasText: 'Model Registry' }).first();
    await breadcrumbBack.click();

    await page.waitForURL('**/ai/admin/models', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // ── Step 12: Click claude-opus-4-6 row ─────────────────────────────
    await page.getByText('claude-opus-4-6').first().click();

    // Wait for edit form to load
    await page.waitForURL('**/ai/admin/models/**', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('tab', { name: 'Primary' })).toBeVisible({ timeout: 10000 });

    // ── Step 13: Click Advanced tab ────────────────────────────────────
    await page.getByRole('tab', { name: 'Advanced' }).click();
    await page.waitForTimeout(500);

    await expect(page.getByText('Fallback Model')).toBeVisible({ timeout: 5000 });

    // ── Step 14: Set fallback to fallback-test-a (creating circular chain) ──
    // opus -> fallback-test-a -> opus would be circular
    const opusFallbackTrigger = page.locator('button[role="combobox"]').filter({
      hasText: /No fallback model|Select/i,
    });

    // If there's already a fallback set, we might need to change it
    const fallbackCombobox = page.locator('button[role="combobox"]').last();
    await fallbackCombobox.click();

    // Select fallback-test-a
    const fallbackTestAOption = page.getByRole('option').filter({ hasText: /fallback-test-a|Fallback Test A/i });
    await fallbackTestAOption.first().click();

    // ── Step 15: Click Save — expect circular fallback error ───────────
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
    await saveButton.click();

    // Wait for error toast about circular fallback chain
    await expect(
      page.getByText(/circular/i).or(page.getByText(/fallback.*chain/i)).or(page.getByText(/fallback.*loop/i)),
    ).toBeVisible({ timeout: 15000 });

    // ── Checkpoint 5: Circular Fallback Error ──────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-15-circular-fallback-error.png`,
      fullPage: true,
    });
  });
});
