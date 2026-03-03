import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5b/journey-3';

// Seed user credentials from packages/db/prisma/seed.ts
const TEST_EMAIL = 'admin@nexa-erp.dev';
const TEST_PASSWORD = 'NexaDev2026!';

test.describe('Journey 3: Toggle Memory Settings', () => {
  test('Toggle memory enable/disable and category checkboxes with optimistic updates', async ({
    page,
  }) => {
    // ── Pre-step: Log in ─────────────────────────────────────────────
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const emailInput = page.getByRole('textbox', { name: 'Email' });
    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await emailInput.fill(TEST_EMAIL);
    await page.getByRole('textbox', { name: 'Password' }).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for authenticated app shell
    const sidebar = page.locator('nav[aria-label="Navigation"]');
    await expect(sidebar).toBeVisible({ timeout: 20000 });

    // ── Step 1: Navigate to /ai/memory via sidebar ─────────────────
    const myMemoryLink = sidebar.getByRole('link', { name: 'My Memory' });
    await expect(myMemoryLink).toBeVisible();
    await myMemoryLink.click();

    // Wait for navigation to /ai/memory
    await page.waitForURL('**/ai/memory', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Wait for main content area
    const mainContent = page.locator('main[aria-label="Main content"]');
    await expect(mainContent).toBeVisible({ timeout: 10000 });

    // Verify page title "My Memory" is visible
    await expect(mainContent.getByText('My Memory').first()).toBeVisible({ timeout: 10000 });

    // Checkpoint 1: Memory page loaded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-memory-page-loaded.png`,
      fullPage: true,
    });

    // The settings panel renders conditionally: {settings && <MemorySettingsPanel/>}
    // It only appears when the GET /ai/memories/settings API returns valid data.
    // Wait a moment for any pending API calls, then check.
    await page.waitForTimeout(2000);

    const enableToggle = page.getByRole('switch').first();
    const settingsPanelVisible = await enableToggle.isVisible().catch(() => false);

    if (!settingsPanelVisible) {
      // Settings panel not rendered — the API likely didn't return settings.
      // This is a missing feature / backend data issue — document and fail gracefully.
      test.info().annotations.push({
        type: 'missing-feature',
        description:
          'Memory settings panel not visible. The GET /ai/memories/settings endpoint may not be returning data. The settings panel renders conditionally on settings being truthy. Cannot test toggle functionality without settings panel.',
      });

      // Screenshot showing the page without settings panel
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-1-no-settings-panel.png`,
        fullPage: true,
      });

      // Fail the test to surface the issue
      expect(settingsPanelVisible, 'Settings panel should be visible for toggle tests — API may not be returning memory settings').toBe(true);
      return;
    }

    // ── Settings panel is visible — proceed with toggle tests ──────

    // Verify initial state: toggle is ON
    await expect(enableToggle).toHaveAttribute('data-state', 'checked');

    // Verify category checkboxes are all visible and enabled
    const preferencesCheckbox = page.getByRole('checkbox', { name: /preferences/i });
    const workflowsCheckbox = page.getByRole('checkbox', { name: /workflows/i });
    const decisionsCheckbox = page.getByRole('checkbox', { name: /decisions/i });
    const instructionsCheckbox = page.getByRole('checkbox', { name: /instructions/i });
    const entityContextCheckbox = page.getByRole('checkbox', { name: /entity context/i });

    await expect(preferencesCheckbox).toBeVisible();
    await expect(workflowsCheckbox).toBeVisible();
    await expect(decisionsCheckbox).toBeVisible();
    await expect(instructionsCheckbox).toBeVisible();
    await expect(entityContextCheckbox).toBeVisible();

    // All checkboxes should be enabled
    await expect(preferencesCheckbox).toBeEnabled();
    await expect(workflowsCheckbox).toBeEnabled();

    // Verify retention period selector is visible
    const retentionSelector = page.getByLabel(/retention period/i);
    await expect(retentionSelector).toBeVisible();

    // ── Step 2: Click Enable AI Memory toggle to OFF ─────────────────
    await enableToggle.click();

    // Toggle should now be OFF (unchecked)
    await expect(enableToggle).toHaveAttribute('data-state', 'unchecked');

    // Category checkboxes should become disabled
    await expect(preferencesCheckbox).toBeDisabled();
    await expect(workflowsCheckbox).toBeDisabled();
    await expect(decisionsCheckbox).toBeDisabled();
    await expect(instructionsCheckbox).toBeDisabled();
    await expect(entityContextCheckbox).toBeDisabled();

    // Retention selector should become disabled
    await expect(retentionSelector).toBeDisabled();

    // Checkpoint 2: Toggle OFF, settings disabled
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-toggle-off-settings-disabled.png`,
      fullPage: true,
    });

    // ── Step 3: Click Enable AI Memory toggle back to ON ─────────────
    await enableToggle.click();

    // Toggle should now be ON again
    await expect(enableToggle).toHaveAttribute('data-state', 'checked');

    // Category checkboxes should be enabled again
    await expect(preferencesCheckbox).toBeEnabled();
    await expect(workflowsCheckbox).toBeEnabled();
    await expect(decisionsCheckbox).toBeEnabled();
    await expect(instructionsCheckbox).toBeEnabled();
    await expect(entityContextCheckbox).toBeEnabled();

    // Retention selector should be enabled again
    await expect(retentionSelector).toBeEnabled();

    // ── Step 4: Uncheck Workflows category ───────────────────────────
    await expect(workflowsCheckbox).toHaveAttribute('data-state', 'checked');
    await workflowsCheckbox.click();
    await expect(workflowsCheckbox).toHaveAttribute('data-state', 'unchecked');

    // ── Step 5: Re-check Workflows category ──────────────────────────
    await workflowsCheckbox.click();
    await expect(workflowsCheckbox).toHaveAttribute('data-state', 'checked');

    // ── Step 6: Change retention period to 90 days ───────────────────
    await retentionSelector.click();

    // Wait for dropdown and select "90 days"
    const option90Days = page.getByRole('option', { name: /90 days/i });
    await expect(option90Days).toBeVisible({ timeout: 5000 });
    await option90Days.click();

    // Verify the selector now shows "90 days"
    await expect(retentionSelector).toContainText('90');

    // Checkpoint 3: Retention period changed to 90 days
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-retention-90-days.png`,
      fullPage: true,
    });
  });
});
