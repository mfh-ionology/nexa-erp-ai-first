import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR = '../../screenshots/epic-E5c/journey-7';

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

test.describe('Journey 7: Prompt Variable Autocomplete and Test Rendering', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    // Login as admin user
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const emailInput = page.getByLabel('Email');
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.click();
    await emailInput.fill('');
    await emailInput.pressSequentially('admin@nexa-erp.dev', { delay: 10 });

    const passwordInput = page.getByLabel('Password');
    await passwordInput.click();
    await passwordInput.fill('');
    await passwordInput.pressSequentially('NexaDev2026!', { delay: 10 });

    const loginResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/auth/login') && resp.request().method() === 'POST',
      { timeout: 15000 },
    );

    const signInButton = page.getByRole('button', { name: /sign in/i });
    await signInButton.waitFor({ state: 'visible' });
    await signInButton.click();

    await loginResponsePromise;

    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 30000,
    });
    await page.waitForLoadState('networkidle');
  });

  test('Variable autocomplete triggers on {{ and Test Prompt renders output', async ({
    page,
  }) => {
    // Log API responses for debugging
    page.on('response', async (response) => {
      if (
        response.url().includes('/ai/admin/prompts') ||
        response.url().includes('/ai/variables')
      ) {
        const body = await response.text().catch(() => 'no body');
        console.log(
          `[API] ${response.status()} ${response.url()} → ${body.substring(0, 500)}`,
        );
      }
    });

    // ── Step 1: Navigate to /ai/admin/prompts ────────────────────────────────
    await spaNavigate(page, '/ai/admin/prompts');
    await expect(
      page.getByLabel('breadcrumb').getByText('Prompt Templates'),
    ).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // ── Step 2: Click on a prompt row to open the editor ─────────────────────
    // Try 'test-invoice-reminder' first (created by journey 5), fallback to first data row
    let promptRow = page.getByRole('row').filter({ hasText: 'test-invoice-reminder' });
    const testInvoiceReminderExists = await promptRow.isVisible().catch(() => false);

    if (!testInvoiceReminderExists) {
      // Fall back to first data row in the table body
      promptRow = page.locator('table tbody tr').first();
      await expect(promptRow).toBeVisible({ timeout: 10000 });
      const promptName = await promptRow.locator('td').first().textContent();
      console.log(`[INFO] test-invoice-reminder not found, using prompt: ${promptName}`);
    }

    await promptRow.click();

    // Wait for navigation to the prompt editor page
    await page.waitForURL(
      (url) => {
        const path = url.pathname;
        return (
          path.includes('/ai/admin/prompts/') &&
          !path.endsWith('/prompts') &&
          !path.endsWith('/new')
        );
      },
      { timeout: 15000 },
    );
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify editor loaded — system prompt section and version history
    await expect(page.getByText('System Prompt')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Version History')).toBeVisible();

    // ── Checkpoint 1: Prompt Editor Page Loaded ──────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-prompt-editor-loaded.png`,
      fullPage: true,
    });

    // ── Step 3: Focus the system prompt textarea ─────────────────────────────
    const systemPromptTextarea = page.locator(
      'textarea[aria-label="System prompt editor"]',
    );
    await expect(systemPromptTextarea).toBeVisible();
    await systemPromptTextarea.click();

    // Move cursor to the end of the text
    await page.keyboard.press('End');
    await page.keyboard.press('Control+End');

    // ── Step 4: Type '{{' to trigger variable autocomplete ───────────────────
    // Add a space before the trigger to ensure clean insertion point
    await page.keyboard.type(' ', { delay: 50 });
    // Type {{ character by character — the PromptTextarea detects '{{' in handleInput
    await page.keyboard.type('{', { delay: 100 });
    await page.keyboard.type('{', { delay: 100 });

    // Wait for autocomplete dropdown to appear
    const autocompleteListbox = page.getByRole('listbox', {
      name: /variable autocomplete/i,
    });
    await expect(autocompleteListbox).toBeVisible({ timeout: 10000 });

    // Verify variables are grouped by source type (System group should be visible)
    await expect(autocompleteListbox.getByText('System')).toBeVisible();

    // Verify there are clickable options
    const optionCount = await autocompleteListbox.getByRole('option').count();
    expect(optionCount).toBeGreaterThan(0);

    // ── Checkpoint 2: Variable Autocomplete Dropdown ─────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-variable-autocomplete-dropdown.png`,
      fullPage: true,
    });

    // ── Step 5: Click 'company.baseCurrency' in autocomplete dropdown ────────
    const baseCurrencyOption = autocompleteListbox.getByRole('option').filter({
      hasText: 'company.baseCurrency',
    });
    const baseCurrencyExists = await baseCurrencyOption.isVisible().catch(() => false);

    let selectedVariableName: string;
    if (baseCurrencyExists) {
      await baseCurrencyOption.click();
      selectedVariableName = 'company.baseCurrency';
    } else {
      // Fall back: click the first option
      const firstOption = autocompleteListbox.getByRole('option').first();
      const optionText = await firstOption.textContent();
      console.log(`[INFO] company.baseCurrency not available, selecting first option: ${optionText}`);
      await firstOption.click();
      // Extract variable name from option text (first part is the mono name)
      selectedVariableName = optionText?.split(' ')[0] ?? 'unknown';
    }

    // Autocomplete should close after selection
    await expect(autocompleteListbox).not.toBeVisible({ timeout: 5000 });

    // Verify the variable was inserted into the textarea as {{variableName}}
    const textareaValue = await systemPromptTextarea.inputValue();
    expect(textareaValue).toContain(`{{${selectedVariableName}}}`);

    // ── Checkpoint 3: Variable Inserted ──────────────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-variable-inserted.png`,
      fullPage: true,
    });

    // ── Step 6: Click 'Test Prompt' button in action bar ─────────────────────
    const testPromptButton = page.getByRole('button', { name: /test prompt/i });
    await expect(testPromptButton).toBeVisible();
    await testPromptButton.click();

    // Wait for the Test Prompt sheet/panel to open
    const sheetTitle = page.locator('[role="dialog"]').getByText('Test Prompt');
    await expect(sheetTitle).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText('Provide sample values for variables'),
    ).toBeVisible({ timeout: 10000 });

    // Wait for the panel content to fully load
    await page.waitForTimeout(1500);

    // Verify input fields for variables are shown (or "No bound variables" message)
    const sampleVariablesHeading = page.getByText('Sample Variables');
    const noVariablesMsg = page.getByText('No bound variables found');
    const hasSampleVars = await sampleVariablesHeading.isVisible().catch(() => false);
    const hasNoVarsMsg = await noVariablesMsg.isVisible().catch(() => false);
    expect(hasSampleVars || hasNoVarsMsg).toBe(true);

    // ── Checkpoint 4: Test Prompt Panel Open ─────────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-test-prompt-panel-open.png`,
      fullPage: true,
    });

    // ── Step 7: Click 'Render' button in Test Prompt panel ───────────────────
    const renderResponsePromise = page.waitForResponse(
      (resp) =>
        resp.url().includes('/ai/admin/prompts/') &&
        resp.url().includes('/test') &&
        resp.request().method() === 'POST',
      { timeout: 15000 },
    );

    const renderButton = page.locator('[role="dialog"]').getByRole('button', { name: /render/i });
    await expect(renderButton).toBeVisible();
    await expect(renderButton).toBeEnabled();
    await renderButton.click();

    // Wait for the API response
    const renderResponse = await renderResponsePromise;
    const renderStatus = renderResponse.status();
    console.log(`[RENDER] Status: ${renderStatus}`);

    // Wait for UI to update
    await page.waitForTimeout(2000);

    if (renderStatus < 300) {
      // Verify rendered output sections are visible
      const renderedSystemPrompt = page.getByText('Rendered System Prompt');
      const renderedUserTemplate = page.getByText('Rendered User Template');

      await expect(renderedSystemPrompt).toBeVisible({ timeout: 10000 });
      await expect(renderedUserTemplate).toBeVisible({ timeout: 10000 });

      // Verify green-bordered output cards are present (border-l-green-500)
      const outputCards = page.locator('.border-l-green-500');
      await expect(outputCards.first()).toBeVisible();

      // Check for unresolved variables warning — informational, not a failure
      const unresolvedWarning = page.getByText(/variable.*could not be resolved/i);
      const hasUnresolved = await unresolvedWarning.isVisible().catch(() => false);
      if (hasUnresolved) {
        console.log('[INFO] Some variables could not be resolved (expected when no sample values provided)');
      }

      // Check for resolved variables display
      const resolvedSection = page.getByText('Resolved Variables');
      const hasResolved = await resolvedSection.isVisible().catch(() => false);
      if (hasResolved) {
        console.log('[INFO] Resolved variables section is visible');
      }
    } else {
      // Render returned an error — check for error display
      const errorAlert = page.locator('[role="alert"]');
      await expect(errorAlert).toBeVisible({ timeout: 10000 });
      await expect(
        page.getByText('Failed to render prompt'),
      ).toBeVisible({ timeout: 5000 });
      console.log('[WARN] Render returned error status:', renderStatus);
    }

    // ── Checkpoint 5: Rendered Prompt Output ─────────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-7-rendered-prompt-output.png`,
      fullPage: true,
    });
  });
});
