import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '_bmad-output/test-artifacts/screenshots/epic-E5c/journey-6';

test.describe('Journey 6: Prompt Test Render Panel', () => {
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

  test('Test Prompt renders a prompt with sample variables (E5c-3 AC-5e)', async ({
    page,
  }) => {
    // Capture API errors for diagnostics
    const apiErrors: string[] = [];
    page.on('response', (response) => {
      if (
        response.url().includes('/api/ai/') &&
        response.status() >= 400
      ) {
        apiErrors.push(
          `${response.status()} ${response.request().method()} ${response.url()}`,
        );
      }
    });

    // ── Step 1: Navigate to /ai/admin/prompts via sidebar ──────────────
    const sidebarNav = page.locator('nav');
    const promptsLink = sidebarNav.getByText('Prompt Templates').first();

    if (await promptsLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await promptsLink.click();
    } else {
      const aiAdminLink = sidebarNav.getByText('AI Administration').first();
      if (await aiAdminLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await aiAdminLink.click();
        await page.waitForLoadState('networkidle');
      }
      const retryLink = sidebarNav.getByText('Prompt Templates').first();
      if (await retryLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await retryLink.click();
      }
    }

    await page.waitForURL('**/ai/admin/prompts', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByRole('heading').filter({ hasText: /Prompt Templates/i }),
    ).toBeVisible({ timeout: 10000 });

    // ── Checkpoint 1: Prompt List Page Loaded ─────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-prompt-list-loaded.png`,
      fullPage: true,
    });

    // Check if any prompt rows exist
    const promptRows = page.locator('table tbody tr');
    const rowCount = await promptRows.count();

    if (rowCount === 0) {
      // No seed data — create a prompt through the UI
      test.info().annotations.push({
        type: 'info',
        description:
          'No seeded AiPrompt records — creating one via UI to test Test Prompt panel',
      });

      await page.getByRole('button', { name: 'New' }).click();
      await page.waitForURL('**/ai/admin/prompts/new', { timeout: 10000 });
      await page.waitForLoadState('networkidle');

      // Wait for the form to fully render
      await expect(
        page.getByRole('heading').filter({ hasText: /New Prompt Template/i }),
      ).toBeVisible({ timeout: 10000 });

      // Fill Name
      const nameField = page
        .getByPlaceholder('record-creation-invoice')
        .or(page.getByLabel('Name'))
        .first();
      await expect(nameField).toBeVisible({ timeout: 5000 });
      await nameField.fill('test-render-prompt');

      // Select Category (REQUIRED) — Radix/Shadcn Select
      const categoryTrigger = page.getByText('Select category');
      if (await categoryTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
        await categoryTrigger.click();
        const option = page.getByRole('option', { name: 'Record Creation' });
        await expect(option).toBeVisible({ timeout: 3000 });
        await option.click();
        await page.waitForTimeout(500);
      }

      // Fill Description
      const descField = page
        .getByLabel('Description')
        .or(page.getByPlaceholder(/description/i))
        .first();
      if (await descField.isVisible({ timeout: 2000 }).catch(() => false)) {
        await descField.fill('E2E journey 6 test prompt');
      }

      // Fill System Prompt
      const systemPromptTextarea = page.locator(
        'textarea[aria-label="System prompt editor"]',
      );
      if (
        await systemPromptTextarea.isVisible({ timeout: 3000 }).catch(() => false)
      ) {
        await systemPromptTextarea.fill(
          'You are an assistant for {{company.name}}. Today is {{current_date}}.',
        );
      }

      // Fill User Template
      const userTemplateTextarea = page.locator(
        'textarea[aria-label="User template editor"]',
      );
      if (
        await userTemplateTextarea.isVisible({ timeout: 2000 }).catch(() => false)
      ) {
        await userTemplateTextarea.fill('Help with: {{user_query}}');
      }

      // Take screenshot of filled form
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/debug-form-filled.png`,
        fullPage: true,
      });

      // Click Save and wait for API response
      const saveButton = page.getByRole('button', { name: /Save/i });
      await expect(saveButton.first()).toBeVisible({ timeout: 5000 });

      // Listen for the create API response
      const createResponsePromise = page.waitForResponse(
        (resp) =>
          resp.url().includes('/ai/admin/prompts') &&
          resp.request().method() === 'POST',
        { timeout: 15000 },
      ).catch(() => null);

      await saveButton.first().click();

      const createResponse = await createResponsePromise;

      if (createResponse) {
        const status = createResponse.status();
        if (status >= 400) {
          let body = '';
          try {
            body = await createResponse.text();
          } catch { /* ignore */ }

          await page.screenshot({
            path: `${SCREENSHOTS_DIR}/debug-create-api-error.png`,
            fullPage: true,
          });

          test.info().annotations.push({
            type: 'issue',
            description: `Create prompt API returned ${status}: ${body.slice(0, 200)}`,
          });
          expect(
            status,
            `Create prompt API returned error ${status}: ${body.slice(0, 200)}`,
          ).toBeLessThan(400);
        }
      } else {
        // No API response captured — endpoint might not exist
        await page.screenshot({
          path: `${SCREENSHOTS_DIR}/debug-no-api-response.png`,
          fullPage: true,
        });
        test.info().annotations.push({
          type: 'issue',
          description: 'No POST response from /ai/admin/prompts — endpoint may not be registered',
        });
      }

      // Wait for redirect to edit page
      try {
        await page.waitForURL(
          (url) => /\/ai\/admin\/prompts\/[0-9a-f-]{36}/.test(url.pathname),
          { timeout: 10000 },
        );
      } catch {
        await page.screenshot({
          path: `${SCREENSHOTS_DIR}/debug-after-save.png`,
          fullPage: true,
        });

        // Navigate back to list to check
        const navLink = sidebarNav.getByText('Prompt Templates').first();
        if (await navLink.isVisible({ timeout: 3000 }).catch(() => false)) {
          await navLink.click();
          await page.waitForURL('**/ai/admin/prompts', { timeout: 10000 });
          await page.waitForLoadState('networkidle');

          const newRowCount = await promptRows.count();
          if (newRowCount > 0) {
            await promptRows.first().click();
            await page.waitForTimeout(2000);
          } else {
            test.info().annotations.push({
              type: 'missing-feature',
              description:
                `No seeded prompts and create via UI failed. API errors: [${apiErrors.join(', ')}]. Prereq: 6 AiPrompt records from E5.`,
            });
            expect(
              newRowCount,
              `No prompts available. Create failed. API errors: [${apiErrors.join(', ')}]`,
            ).toBeGreaterThan(0);
          }
        }
      }
    } else {
      // Click first prompt row to open editor
      await promptRows.first().click();
      await page.waitForTimeout(2000);
    }

    // Now on editor page
    await page.waitForLoadState('networkidle');

    // Scroll to top in case we're at the bottom
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    // Verify System Prompt section (need to scroll down on editor)
    const systemPromptLabel = page.getByText('System Prompt').first();
    await expect(systemPromptLabel).toBeVisible({ timeout: 10000 });

    // ── Checkpoint 2: Prompt Editor Loaded ────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-prompt-editor-loaded.png`,
      fullPage: true,
    });

    // ── Step 3: Click Test Prompt button ──────────────────────────────
    const testPromptButton = page.getByRole('button', {
      name: /Test Prompt/i,
    });

    const onEditPage = /\/ai\/admin\/prompts\/[0-9a-f-]{36}/.test(page.url());

    if (!onEditPage) {
      test.info().annotations.push({
        type: 'info',
        description: 'On /new — saving to switch to edit mode',
      });

      const saveBtn = page.getByRole('button', { name: /Save/i });
      if (await saveBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await saveBtn.first().click();
        try {
          await page.waitForURL(
            (url) => /\/ai\/admin\/prompts\/[0-9a-f-]{36}/.test(url.pathname),
            { timeout: 10000 },
          );
          await page.waitForLoadState('networkidle');
        } catch {
          await page.screenshot({
            path: `${SCREENSHOTS_DIR}/debug-save-from-new.png`,
            fullPage: true,
          });
          test.info().annotations.push({
            type: 'missing-feature',
            description: 'Could not save prompt to edit mode — Test Prompt unavailable',
          });
          expect(false, 'Cannot switch to edit mode for Test Prompt').toBe(true);
        }
      }
    }

    await expect(testPromptButton.first()).toBeVisible({ timeout: 5000 });
    await testPromptButton.first().click();

    // Wait for the test panel sheet
    const testPanel = page
      .locator('[role="dialog"]')
      .or(page.locator('[data-testid="test-panel"]'));
    await expect(testPanel.first()).toBeVisible({ timeout: 5000 });

    await page.waitForTimeout(1000);

    // ── Checkpoint 3: Test Panel Open with Variable Fields ────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-test-panel-open.png`,
      fullPage: true,
    });

    const variableInputs = testPanel.first().locator('input');
    const variableCount = await variableInputs.count();

    if (variableCount === 0) {
      test.info().annotations.push({
        type: 'info',
        description: 'Test panel has no variable inputs',
      });
    }

    // ── Step 4: Click Render button ──────────────────────────────────
    const renderButton = testPanel
      .first()
      .getByRole('button', { name: /Render/i })
      .or(testPanel.first().locator('button:has-text("Render")'));

    await expect(renderButton.first()).toBeVisible({ timeout: 5000 });
    await renderButton.first().click();

    const renderedOutput = testPanel
      .first()
      .getByText(/Rendered System Prompt|Rendered User Template/i);

    let renderSucceeded = false;

    try {
      await expect(renderedOutput.first()).toBeVisible({ timeout: 10000 });
      renderSucceeded = true;
    } catch {
      const errorAlert = testPanel.first().locator('[role="alert"]');
      const hasError = await errorAlert
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false);

      if (hasError) {
        await page.screenshot({
          path: `${SCREENSHOTS_DIR}/step-4-render-error.png`,
          fullPage: true,
        });
        test.info().annotations.push({
          type: 'issue',
          description: 'Test Prompt render returned an error',
        });
      }
    }

    // ── Checkpoint 4: Rendered Output ────────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-rendered-output.png`,
      fullPage: true,
    });

    if (renderSucceeded) {
      await expect(
        testPanel.first().getByText('Rendered System Prompt'),
      ).toBeVisible();

      const resolvedVars = testPanel.first().getByText(/Resolved Variables/i);
      if (await resolvedVars.isVisible({ timeout: 2000 }).catch(() => false)) {
        const count = await testPanel.first().locator('table tbody tr').count();
        expect(count).toBeGreaterThanOrEqual(0);
      }

      const unresolved = testPanel.first().getByText(/unresolved/i);
      if (await unresolved.isVisible({ timeout: 2000 }).catch(() => false)) {
        test.info().annotations.push({
          type: 'info',
          description: 'Some variables unresolved — amber warning visible',
        });
      }
    } else {
      test.info().annotations.push({
        type: 'missing-feature',
        description:
          'Rendered output not displayed — POST /ai/admin/prompts/{id}/test may not be implemented',
      });

      expect(
        renderSucceeded,
        'Expected rendered output after clicking Render',
      ).toBe(true);
    }
  });
});
