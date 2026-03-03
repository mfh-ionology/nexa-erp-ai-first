import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '_bmad-output/test-artifacts/screenshots/epic-E5c/journey-4';

test.describe('Journey 4: Prompt Template CRUD with Versioning', () => {
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

  test('Create prompt, edit with versioning, view diff, and restore old version', async ({
    page,
  }) => {
    // ── Step 1: Navigate to Prompt Templates list via sidebar ───────────
    // Use SPA navigation (click sidebar link) to preserve in-memory auth state
    const sidebarNav = page.locator('nav');
    const promptsLink = sidebarNav.getByText('Prompt Templates').first();

    if (await promptsLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await promptsLink.click();
    } else {
      // Fallback: try the direct href link
      const directLink = page.locator('a[href*="/ai/admin/prompts"]').first();
      await directLink.click();
    }

    await page.waitForURL('**/ai/admin/prompts', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByRole('heading', { name: /Prompt Templates/i }),
    ).toBeVisible({ timeout: 15000 });

    // Wait for table data to load
    await page.waitForTimeout(2000);

    // ── Checkpoint 1: Prompt List Loaded ────────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-prompt-list-loaded.png`,
      fullPage: true,
    });

    // Verify table columns are present
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Category' })).toBeVisible();

    // ── Step 2: Click "New" button to create a prompt ──────────────────
    const newButton = page.getByRole('button', { name: /^New$/i });
    await newButton.click();

    // Wait for navigation to /ai/admin/prompts/new
    await page.waitForURL('**/ai/admin/prompts/new', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // ── Step 3: Verify prompt editor page in create mode ───────────────
    await expect(
      page.getByRole('heading').filter({ hasText: /New Prompt Template/i }),
    ).toBeVisible({ timeout: 10000 });

    // ── Checkpoint 2: New Prompt Editor Page ────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-new-prompt-editor.png`,
      fullPage: true,
    });

    // Verify form fields are present
    const nameField = page
      .getByPlaceholder('record-creation-invoice')
      .or(page.getByLabel('Name'))
      .first();
    await expect(nameField).toBeVisible();

    // ── Step 4: Fill in the prompt form ────────────────────────────────
    // Fill Name
    await nameField.fill('test-e2e-prompt');

    // Fill Category — select dropdown
    const categoryTrigger = page
      .getByText('Select category')
      .or(page.getByLabel('Category'))
      .first();
    await categoryTrigger.click();
    await page.waitForTimeout(300);

    // Select "Analysis" from dropdown options
    const analysisOption = page
      .getByRole('option', { name: /Analysis/i })
      .or(page.locator('[role="listbox"]').getByText('Analysis'))
      .first();
    await analysisOption.click();
    await page.waitForTimeout(300);

    // Fill Description
    const descriptionField = page
      .getByPlaceholder(/description/i)
      .or(page.getByLabel('Description'))
      .first();
    await descriptionField.fill('E2E test prompt for automated testing');

    // Fill System Prompt
    const systemPromptField = page
      .getByPlaceholder(/AI assistant/i)
      .or(page.getByLabel(/System Prompt/i))
      .first();
    await systemPromptField.fill(
      'You are an AI assistant helping with {{company.name}} data analysis. Today is {{today}}.',
    );

    // Fill User Template
    const userTemplateField = page
      .getByPlaceholder(/help me with/i)
      .or(page.getByLabel(/User Template/i))
      .first();
    await userTemplateField.fill(
      'Analyse the following data for {{currentUser.name}}: {{query_result}}',
    );

    // ── Step 5: Save the new prompt ────────────────────────────────────
    const saveButton = page.getByRole('button', { name: /save/i });
    await saveButton.click();

    // Wait for save to complete — expect success toast or navigation
    await page.waitForTimeout(3000);

    // ── Checkpoint 3: Prompt Created — Version 1 ───────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-prompt-created-v1.png`,
      fullPage: true,
    });

    // Verify version sidebar appears (edit mode)
    const versionHistoryText = page.getByText('Version History');
    await expect(versionHistoryText).toBeVisible({ timeout: 10000 });

    // Verify v1 is shown
    await expect(page.getByText('v1')).toBeVisible();

    // ── Step 6: Edit the System Prompt ─────────────────────────────────
    // Clear and update the system prompt with additional text
    const systemPromptEditor = page
      .getByPlaceholder(/AI assistant/i)
      .or(page.getByLabel(/System Prompt/i))
      .first();
    await systemPromptEditor.clear();
    await systemPromptEditor.fill(
      'You are an AI assistant helping with {{company.name}} data analysis. Today is {{today}}. You specialise in financial insights.',
    );

    // ── Step 7: Click Save to trigger change reason modal ──────────────
    await page.getByRole('button', { name: /save/i }).click();
    await page.waitForTimeout(500);

    // ── Checkpoint 4: Change Reason Modal ──────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-7-change-reason-modal.png`,
      fullPage: true,
    });

    // Verify the change reason dialog is visible
    await expect(page.getByText('Save Prompt Changes')).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText(/Describe what changed/i)).toBeVisible();

    // ── Step 8: Fill change reason ─────────────────────────────────────
    const changeReasonTextarea = page
      .getByPlaceholder(/Updated system prompt/i)
      .or(page.locator('[role="dialog"] textarea'))
      .first();
    await changeReasonTextarea.fill(
      'Added financial specialisation to system prompt',
    );

    // ── Step 9: Click Save in the change reason modal ──────────────────
    // The dialog has its own Save button — click the one inside the dialog
    const dialogSaveButton = page
      .locator('[role="dialog"]')
      .getByRole('button', { name: /save/i });
    await dialogSaveButton.click();

    // Wait for version 2 to be created
    await page.waitForTimeout(3000);

    // ── Checkpoint 5: Version 2 Created ────────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-9-version-2-created.png`,
      fullPage: true,
    });

    // Verify v2 is now shown in version sidebar
    await expect(page.getByText('v2')).toBeVisible({ timeout: 10000 });

    // v2 should be the active version
    await expect(page.getByText('Active').first()).toBeVisible();

    // ── Step 10: Click v1 in version history to see diff ───────────────
    // Click on the v1 entry in the version sidebar
    const v1Entry = page.getByText('v1');
    await v1Entry.click();
    await page.waitForTimeout(1000);

    // ── Checkpoint 6: Diff View ────────────────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-10-diff-view-v1-vs-v2.png`,
      fullPage: true,
    });

    // Verify diff view is showing
    await expect(
      page.getByText(/Changes.*v1.*current/i).or(page.getByText(/Changes/i)),
    ).toBeVisible({ timeout: 5000 });

    // ── Step 11: Click "Restore This Version" ──────────────────────────
    const restoreButton = page.getByRole('button', {
      name: /Restore This Version/i,
    });
    await expect(restoreButton).toBeVisible({ timeout: 5000 });
    await restoreButton.click();

    // Wait for restore to complete
    await page.waitForTimeout(3000);

    // ── Checkpoint 7: Version Restored — v3 Created ────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-11-version-restored-v3.png`,
      fullPage: true,
    });

    // Verify v3 is now in the version sidebar
    await expect(page.getByText('v3')).toBeVisible({ timeout: 10000 });

    // ── Step 12: Navigate back to prompt list via breadcrumb/sidebar ────
    // Use SPA navigation to preserve auth state
    const breadcrumbAiAdmin = page.getByRole('link', { name: /AI Administration/i });
    if (await breadcrumbAiAdmin.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Navigate up via breadcrumb, then to prompts
      await breadcrumbAiAdmin.click();
      await page.waitForLoadState('networkidle');
    }

    // Navigate to prompts list via sidebar
    const sidebarPromptsLink = page
      .locator('nav')
      .getByText('Prompt Templates')
      .first();
    await sidebarPromptsLink.click();

    await page.waitForURL('**/ai/admin/prompts', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByRole('heading', { name: /Prompt Templates/i }),
    ).toBeVisible({ timeout: 15000 });

    // Wait for table to load
    await page.waitForTimeout(2000);

    // ── Step 13: Verify test-e2e-prompt appears with v3 ────────────────
    const promptRow = page.getByText('test-e2e-prompt');
    await expect(promptRow).toBeVisible({ timeout: 10000 });

    // ── Checkpoint 8: List Shows v3 ────────────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-13-list-shows-v3.png`,
      fullPage: true,
    });

    // Verify the version column shows v3 for our prompt
    const promptTableRow = page
      .locator('tr')
      .filter({ hasText: 'test-e2e-prompt' });
    await expect(promptTableRow.getByText('v3')).toBeVisible();
  });
});
