import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR = '../../screenshots/epic-E5c/journey-2';

test.describe('Journey 2: Model Registry CRUD Lifecycle', () => {
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

  test('Create, view, edit, and delete an AI model through the Model Registry UI', async ({
    page,
  }) => {
    // ── Step 1: Navigate to Model Registry via sidebar ──────────────────
    // Auth tokens are in-memory only (Zustand), so we must use SPA navigation
    // (no page.goto) to preserve the authenticated session.
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
      // Fallback: find the link by href
      await page.locator('a[href="/ai/admin/models"]').first().click();
    }

    await page.waitForURL('**/ai/admin/models', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Wait for breadcrumb to confirm page loaded (use breadcrumb to avoid
    // matching the sidebar link which may also say "Model Registry")
    await expect(
      page.getByLabel('breadcrumb').getByText('Model Registry'),
    ).toBeVisible({ timeout: 15000 });

    // Wait for table data to load (skeletons disappear, real rows appear)
    await expect(page.getByRole('table')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // ── Checkpoint 1: Model List Page Loaded ────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-model-list-loaded.png`,
      fullPage: true,
    });

    // Verify breadcrumbs (scoped to breadcrumb region to avoid matching sidebar)
    await expect(
      page.getByLabel('breadcrumb').getByText('AI Administration'),
    ).toBeVisible();

    // Verify table column headers are present
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Provider' })).toBeVisible();

    // ── Step 2: Verify seeded model visible in the list ─────────────────
    await expect(page.getByText('claude-opus-4-6').first()).toBeVisible();

    // ── Step 3: Click "New" button to create a model ────────────────────
    await page.getByRole('button', { name: 'New' }).click();

    // Wait for navigation to /ai/admin/models/new
    await page.waitForURL('**/ai/admin/models/new', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // ── Step 4: Verify model form page loaded ───────────────────────────
    await expect(page.getByText('New Model')).toBeVisible({ timeout: 10000 });

    // Verify Primary tab is visible
    await expect(page.getByRole('tab', { name: 'Primary' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Advanced' })).toBeVisible();

    // Verify Save button exists and is disabled (form not dirty)
    const saveButton = page.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeVisible();
    await expect(saveButton).toBeDisabled();

    // Verify Cancel button exists
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();

    // ── Checkpoint 2: New Model Form Page ───────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-new-model-form.png`,
      fullPage: true,
    });

    // ── Step 5: Fill Primary tab fields ─────────────────────────────────
    // Name field
    await page.getByLabel('Name').fill('test-gpt-4o');

    // Display Name field
    await page.getByLabel('Display Name').fill('Test GPT-4o');

    // Provider dropdown — click the combobox trigger then choose "Openai"
    const providerTrigger = page.locator('button[role="combobox"]').first();
    await providerTrigger.click();
    await page.getByRole('option', { name: 'Openai' }).click();

    // Model ID field
    await page.getByLabel('Model ID').fill('gpt-4o-2024-11-20');

    // Max Input Tokens
    await page.getByLabel('Max Input Tokens').fill('128000');

    // Max Output Tokens
    await page.getByLabel('Max Output Tokens').fill('16384');

    // Cost per Million Input Tokens
    await page.getByLabel('Cost per Million Input Tokens ($)').fill('2.50');

    // Cost per Million Output Tokens
    await page.getByLabel('Cost per Million Output Tokens ($)').fill('10.00');

    // Save button should now be enabled (form is dirty)
    await expect(saveButton).toBeEnabled();

    // ── Step 6: Switch to Advanced tab ──────────────────────────────────
    await page.getByRole('tab', { name: 'Advanced' }).click();

    // Verify Advanced tab content loads
    await expect(page.getByText('Routing Tags')).toBeVisible();
    await expect(page.getByText('Capabilities')).toBeVisible();
    await expect(page.getByText('Fallback Model')).toBeVisible();

    // ── Step 7: Fill Advanced tab fields ────────────────────────────────
    // Add routing tags by clicking the dashed-border tag buttons
    await page.getByRole('button', { name: '+ standard' }).click();
    await page.getByRole('button', { name: '+ vision' }).click();

    // Verify tags appear as purple badges
    const tagBadges = page.locator('[class*="bg-[#f5f3ff]"][class*="text-[#7c3aed]"]');
    await expect(tagBadges.filter({ hasText: 'standard' })).toBeVisible();
    await expect(tagBadges.filter({ hasText: 'vision' })).toBeVisible();

    // Select Fallback Model — find the fallback select trigger
    const fallbackTrigger = page.locator('button[role="combobox"]').filter({ hasText: /No fallback model/ });
    await fallbackTrigger.click();

    // Select a sonnet model from dropdown
    const sonnetOption = page.getByRole('option').filter({ hasText: /sonnet/i });
    await sonnetOption.click();

    // ── Step 8: Click Save to create model ──────────────────────────────
    await saveButton.click();

    // Wait for success toast
    await expect(page.getByText('Model created successfully')).toBeVisible({ timeout: 15000 });

    // Should navigate to the edit page for the newly created model
    await page.waitForLoadState('networkidle');

    // Verify breadcrumbs show the new model name
    await expect(page.getByText('Test GPT-4o').first()).toBeVisible({ timeout: 10000 });

    // ── Checkpoint 3: Model Created Successfully ────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-8-model-created-toast.png`,
      fullPage: true,
    });

    // ── Step 9: Edit the Display Name ───────────────────────────────────
    // We should be on the edit form now. Switch to Primary tab if needed
    const primaryTab = page.getByRole('tab', { name: 'Primary' });
    if (await primaryTab.isVisible()) {
      await primaryTab.click();
    }

    const displayNameField = page.getByLabel('Display Name');
    await displayNameField.clear();
    await displayNameField.fill('Test GPT-4o (Updated)');

    // Save button should be enabled again (form is dirty)
    await expect(saveButton).toBeEnabled();

    // ── Step 10: Click Save to update model ─────────────────────────────
    await saveButton.click();

    // Wait for success toast
    await expect(page.getByText('Model updated successfully')).toBeVisible({ timeout: 15000 });

    // ── Step 11: Navigate back to Model Registry list via breadcrumb ────
    // Use the breadcrumb link for SPA navigation (no full page reload)
    const modelRegistryBreadcrumb = page.locator('a').filter({ hasText: 'Model Registry' }).first();
    await modelRegistryBreadcrumb.click();

    await page.waitForURL('**/ai/admin/models', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // ── Step 12: Verify test-gpt-4o is visible in the list ──────────────
    await expect(page.getByText('test-gpt-4o').first()).toBeVisible();

    // ── Checkpoint 4: Updated Model in List ─────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-12-model-in-list.png`,
      fullPage: true,
    });

    // ── Step 13: Open overflow menu for test-gpt-4o and click Delete ────
    const actionsButton = page.getByRole('button', { name: 'Actions for test-gpt-4o' });
    await actionsButton.click();

    // Click Delete from dropdown menu
    await page.getByRole('menuitem', { name: 'Delete' }).click();

    // ── Step 14: Confirm deletion ───────────────────────────────────────
    // Wait for confirmation dialog (AlertDialog)
    await expect(page.getByText('Delete Model')).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByText('Are you sure you want to delete this model?'),
    ).toBeVisible();

    // Find the destructive "Delete" button inside the AlertDialog
    const deleteConfirmButton = page
      .locator('[role="alertdialog"]')
      .getByRole('button', { name: 'Delete' });
    await deleteConfirmButton.click();

    // Wait for success toast
    await expect(page.getByText('Model deleted successfully')).toBeVisible({ timeout: 15000 });

    // Verify model is removed from the list
    await page.waitForTimeout(1000);
    await expect(page.getByText('test-gpt-4o')).not.toBeVisible({ timeout: 5000 });

    // Verify seeded models still present
    await expect(page.getByText('claude-opus-4-6').first()).toBeVisible();

    // ── Checkpoint 5: Model Deleted from List ───────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-14-model-deleted.png`,
      fullPage: true,
    });
  });
});
