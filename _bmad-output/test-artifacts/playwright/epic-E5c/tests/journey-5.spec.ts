import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '_bmad-output/test-artifacts/screenshots/epic-E5c/journey-5';

test.describe('Journey 5: Prompt Editor Variable Autocomplete', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    // Login as admin user
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@nexa-erp.dev');
    await page.getByLabel('Password').fill('NexaDev2026!');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for redirect away from login page
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 15000,
    });
    await page.waitForLoadState('networkidle');
  });

  test('Variable autocomplete triggers on {{ and inserts selected variable', async ({
    page,
  }) => {
    // ── Step 1: Navigate to /ai/admin/prompts/new ──────────────────────
    // Use SPA navigation via sidebar to preserve auth state
    const sidebarNav = page.locator('nav');
    const promptsLink = sidebarNav.getByText('Prompt Templates').first();

    if (await promptsLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await promptsLink.click();
    } else {
      const directLink = page.locator('a[href*="/ai/admin/prompts"]').first();
      await directLink.click();
    }

    await page.waitForURL('**/ai/admin/prompts', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Click "New" to go to the new prompt editor
    const newButton = page.getByRole('button', { name: /^New$/i });
    await newButton.click();

    await page.waitForURL('**/ai/admin/prompts/new', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Verify the new prompt editor loaded
    await expect(
      page.getByRole('heading').filter({ hasText: /New Prompt Template/i }),
    ).toBeVisible({ timeout: 10000 });

    // ── Checkpoint 1: New Prompt Editor Page Loaded ─────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-new-prompt-editor-loaded.png`,
      fullPage: true,
    });

    // Verify key form elements
    const nameField = page
      .getByPlaceholder('record-creation-invoice')
      .or(page.getByLabel('Name'))
      .first();
    await expect(nameField).toBeVisible();

    // Verify the System Prompt section exists
    await expect(page.getByText('System Prompt')).toBeVisible();

    // ── Step 2: Fill in the Name field ──────────────────────────────────
    await nameField.fill('autocomplete-test');

    // ── Step 3 & 4: Click System Prompt textarea and type "Hello {{" ────
    // The system prompt textarea uses aria-label="System prompt editor"
    const systemPromptTextarea = page.locator(
      'textarea[aria-label="System prompt editor"]',
    );
    await expect(systemPromptTextarea).toBeVisible({ timeout: 5000 });

    // Click to focus the textarea
    await systemPromptTextarea.click();

    // Type "Hello " then "{{" character by character to trigger autocomplete
    // Must use pressSequentially (not fill) to trigger the onChange/input handler
    await systemPromptTextarea.pressSequentially('Hello {{', { delay: 50 });

    // Wait for the autocomplete dropdown to appear
    // The autocomplete uses role="listbox" with aria-label="Variable autocomplete"
    const autocompleteListbox = page.locator(
      '[role="listbox"][aria-label="Variable autocomplete"]',
    );
    await expect(autocompleteListbox).toBeVisible({ timeout: 5000 });

    // ── Checkpoint 2: Autocomplete Dropdown Visible ─────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-autocomplete-dropdown-visible.png`,
      fullPage: true,
    });

    // Check if variables loaded or if "No matching variables" is shown
    // The /ai/variables API endpoint may not be implemented yet
    const noMatchingText = autocompleteListbox.getByText('No matching variables');
    const hasNoVariables = await noMatchingText.isVisible({ timeout: 2000 }).catch(() => false);

    if (hasNoVariables) {
      // MISSING FEATURE: The /ai/variables API endpoint is not implemented,
      // so the autocomplete has no data. The autocomplete trigger mechanism
      // works correctly but cannot display variables without backend support.
      //
      // We still verify the autocomplete popup appeared and dismiss it.
      console.log(
        'MISSING: /ai/variables API endpoint — autocomplete shows "No matching variables"',
      );

      // Verify the autocomplete popup itself is structurally correct
      await expect(autocompleteListbox).toHaveAttribute('role', 'listbox');

      // Dismiss autocomplete with Escape
      await systemPromptTextarea.press('Escape');
      await expect(autocompleteListbox).not.toBeVisible({ timeout: 3000 });

      // ── Checkpoint 3: Autocomplete dismissed (no variables available) ──
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-5-variable-inserted.png`,
        fullPage: true,
      });

      // Annotate and fail — missing backend endpoint prevents full journey completion
      test.info().annotations.push({
        type: 'missing-feature',
        description: 'Missing /ai/variables API endpoint — autocomplete has no data to display',
      });
      expect(hasNoVariables, 'Expected variables to be available but /ai/variables API endpoint is missing — autocomplete shows "No matching variables"').toBe(false);
    }

    // ── If variables ARE available, proceed with selection ───────────────

    // Verify variables are grouped by source type — look for "System" group header
    await expect(
      autocompleteListbox.getByText('System', { exact: false }),
    ).toBeVisible();

    // Verify specific system variables are present
    const companyNameOption = autocompleteListbox
      .locator('[role="option"]')
      .filter({ hasText: 'company.name' });
    await expect(companyNameOption).toBeVisible({ timeout: 5000 });

    // Verify multiple options exist
    const optionCount = await autocompleteListbox
      .locator('[role="option"]')
      .count();
    expect(optionCount).toBeGreaterThan(0);

    // ── Step 5: Click company.name in autocomplete dropdown ─────────────
    await companyNameOption.click();

    // Wait for variable insertion
    await page.waitForTimeout(500);

    // ── Checkpoint 3: Variable Inserted ─────────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-variable-inserted.png`,
      fullPage: true,
    });

    // Verify the textarea now contains "Hello {{company.name}}"
    const textareaValue = await systemPromptTextarea.inputValue();
    expect(textareaValue).toContain('Hello {{company.name}}');

    // Verify the autocomplete dropdown is dismissed
    await expect(autocompleteListbox).not.toBeVisible({ timeout: 3000 });
  });
});
