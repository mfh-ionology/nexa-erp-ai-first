import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR = '../../screenshots/epic-E5c/journey-5';

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

test.describe('Journey 5: Create a New Prompt Template', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    // Login as admin user
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const emailInput = page.getByLabel('Email');
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    // Use click + clear + type to ensure React Hook Form registers changes
    await emailInput.click();
    await emailInput.fill('');
    await emailInput.pressSequentially('admin@nexa-erp.dev', { delay: 10 });

    const passwordInput = page.getByLabel('Password');
    await passwordInput.click();
    await passwordInput.fill('');
    await passwordInput.pressSequentially('NexaDev2026!', { delay: 10 });

    // Wait for login API response after clicking Sign In
    const loginResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/auth/login') && resp.request().method() === 'POST',
      { timeout: 15000 },
    );

    const signInButton = page.getByRole('button', { name: /sign in/i });
    await signInButton.waitFor({ state: 'visible' });
    await signInButton.click();

    // Wait for login API to respond first
    await loginResponsePromise;

    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 30000,
    });
    await page.waitForLoadState('networkidle');
  });

  test('Full prompt creation flow: list, create, fill fields, save, verify in list', async ({
    page,
  }) => {
    // Log API responses for debugging
    page.on('response', async (response) => {
      if (response.url().includes('/ai/admin/prompts')) {
        const body = await response.text().catch(() => 'no body');
        console.log(`[API] ${response.status()} ${response.url()} → ${body.substring(0, 500)}`);
      }
    });

    // ── Step 1: Navigate to /ai/admin/prompts ────────────────────────────────
    await spaNavigate(page, '/ai/admin/prompts');
    await expect(
      page.getByLabel('breadcrumb').getByText('Prompt Templates'),
    ).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // ── Checkpoint 1: Prompt Templates List Page ─────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-prompt-list-loaded.png`,
      fullPage: true,
    });

    // ── Step 2: Verify seeded prompts are visible ────────────────────────────
    const tableRows = page.locator('table tbody tr');
    const rowCount = await tableRows.count();
    expect(rowCount).toBeGreaterThanOrEqual(6);

    // Verify different category badges exist (at least a few distinct ones)
    await expect(page.locator('table').getByText('record-creation').first()).toBeVisible();
    await expect(page.locator('table').getByText('query').first()).toBeVisible();

    // Verify search input is visible
    await expect(page.getByPlaceholder(/search/i)).toBeVisible();

    // Verify category filter dropdown is visible
    await expect(page.getByLabel('Filter by category')).toBeVisible();

    // ── Step 3: Click "New" button to create a new prompt ────────────────────
    const newButton = page.getByRole('button', { name: /^New$/i });
    await expect(newButton).toBeVisible();
    await newButton.click();

    // Wait for navigation to /ai/admin/prompts/new
    await page.waitForURL('**/ai/admin/prompts/new', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Verify the editor page loaded in create mode
    await expect(
      page.getByText('New Prompt Template'),
    ).toBeVisible({ timeout: 10000 });

    // ── Checkpoint 2: Prompt Editor Create Mode ──────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-prompt-editor-create-mode.png`,
      fullPage: true,
    });

    // Verify key form elements are present
    await expect(page.getByLabel('Name')).toBeVisible();
    await expect(page.getByText('System Prompt')).toBeVisible();
    await expect(page.getByText('User Template')).toBeVisible();
    await expect(page.getByText('Parameters Schema')).toBeVisible();
    await expect(page.getByRole('button', { name: /save/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();

    // Save button should be disabled initially (form not dirty)
    await expect(page.getByRole('button', { name: /save/i })).toBeDisabled();

    // ── Step 4: Fill metadata fields ─────────────────────────────────────────
    const nameInput = page.getByLabel('Name');
    await nameInput.fill('test-invoice-reminder');

    // Select category "Automation" from the dropdown
    // The category uses a Shadcn Select (not native), trigger has role="combobox"
    const categoryTrigger = page.locator('button[role="combobox"]').first();
    await categoryTrigger.click();
    await page.waitForTimeout(300);
    await page.getByRole('option', { name: 'Automation' }).click();
    await page.waitForTimeout(300);

    // Fill description
    const descriptionInput = page.getByLabel('Description');
    await descriptionInput.fill('Generates personalised invoice reminder emails');

    // ── Step 5: Fill system prompt ───────────────────────────────────────────
    const systemPromptTextarea = page.locator('textarea[aria-label="System prompt editor"]');
    await expect(systemPromptTextarea).toBeVisible();
    await systemPromptTextarea.fill(
      'You are an accounts receivable specialist for {{company.name}}. Today is {{today}}. Generate a professional reminder email for overdue invoices.',
    );

    // ── Step 6: Fill user template ───────────────────────────────────────────
    const userTemplateTextarea = page.locator('textarea[aria-label="User template editor"]');
    await expect(userTemplateTextarea).toBeVisible();
    await userTemplateTextarea.fill(
      'Draft a reminder for invoice {{customer.name}} overdue by {{overdueCount}} days. Use a {{reminderTone}} tone.',
    );

    // Wait for form to register as dirty
    await page.waitForTimeout(500);

    // ── Checkpoint 3: Form Filled Before Save ────────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-form-filled-before-save.png`,
      fullPage: true,
    });

    // Save button should now be enabled (form is dirty)
    await expect(page.getByRole('button', { name: /save/i })).toBeEnabled();

    // ── Step 7: Click Save ───────────────────────────────────────────────────
    // Listen for the POST response
    const createResponsePromise = page.waitForResponse(
      (resp) =>
        resp.url().includes('/ai/admin/prompts') &&
        resp.request().method() === 'POST' &&
        !resp.url().includes('/test'),
      { timeout: 15000 },
    );

    await page.getByRole('button', { name: /save/i }).click();

    // Wait for the API response
    const createResponse = await createResponsePromise;
    const createStatus = createResponse.status();

    // In create mode, no changeReason dialog should appear — saves directly
    expect(createStatus).toBeLessThan(300);

    // Wait for navigation to the newly created prompt's edit page
    await page.waitForURL((url) => {
      const path = url.pathname;
      return path.includes('/ai/admin/prompts/') && !path.endsWith('/new');
    }, { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify success toast
    await expect(
      page.getByText(/prompt.*created/i).or(page.getByText('Prompt template created')),
    ).toBeVisible({ timeout: 10000 });

    // Verify we're on the edit page showing saved data
    await expect(page.getByText('test-invoice-reminder')).toBeVisible({ timeout: 10000 });

    // Verify version badge shows v1 (edit mode shows Active badge + version)
    await expect(page.getByText('v1')).toBeVisible();

    // Verify version sidebar is visible (edit mode only)
    await expect(page.getByText('Version History')).toBeVisible();

    // ── Checkpoint 4: Prompt Created Successfully ────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-7-prompt-created-success.png`,
      fullPage: true,
    });

    // ── Step 8: Navigate back to prompt list and verify new prompt appears ───
    await spaNavigate(page, '/ai/admin/prompts');
    await expect(
      page.getByLabel('breadcrumb').getByText('Prompt Templates'),
    ).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // Verify the new prompt appears in the list
    await expect(
      page.locator('table').getByText('test-invoice-reminder'),
    ).toBeVisible({ timeout: 10000 });

    // Verify the automation category badge in the row
    const newPromptRow = page.getByRole('row').filter({ hasText: 'test-invoice-reminder' });
    await expect(newPromptRow.getByText('automation')).toBeVisible();

    // Verify version v1 in the row
    await expect(newPromptRow.getByText('v1')).toBeVisible();

    // ── Checkpoint 5: New Prompt in List ──────────────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-8-prompt-in-list.png`,
      fullPage: true,
    });
  });
});
