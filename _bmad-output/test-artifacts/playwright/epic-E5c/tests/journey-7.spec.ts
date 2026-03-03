import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '_bmad-output/test-artifacts/screenshots/epic-E5c/journey-7';

test.describe('Journey 7: Agent Configuration CRUD Lifecycle', () => {
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

  test('Create a new agent with tools and guardrails (E5c-4 AC-1, AC-2)', async ({
    page,
  }) => {
    // Capture API errors for diagnostics
    const apiErrors: string[] = [];
    page.on('response', (response) => {
      if (
        response.url().includes('/api/') &&
        response.status() >= 400
      ) {
        apiErrors.push(
          `${response.status()} ${response.request().method()} ${response.url()}`,
        );
      }
    });

    // ── Step 1: Navigate to /ai/admin/agents via SPA ─────────────────────
    // IMPORTANT: page.goto() for authenticated routes resets the SPA session.
    // Must use sidebar/link navigation to preserve auth state.
    const sidebarNav = page.locator('nav');

    // Click "AI Administration" in sidebar
    const aiAdminLink = sidebarNav.getByText('AI Administration').first();
    await expect(aiAdminLink).toBeVisible({ timeout: 10000 });
    await aiAdminLink.click();
    await page.waitForURL('**/ai/admin', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Click "Agent Configuration" quick-nav button on the AI dashboard
    const agentNavButton = page.getByRole('button', {
      name: /Agent Configuration/i,
    });
    await expect(agentNavButton.first()).toBeVisible({ timeout: 10000 });
    await agentNavButton.first().click();
    await page.waitForURL('**/ai/admin/agents', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Verify page heading
    await expect(
      page.getByRole('heading').filter({ hasText: /Agent Configuration/i }),
    ).toBeVisible({ timeout: 10000 });

    // Verify table structure with correct column headers
    const tableEl = page.locator('table');
    await expect(tableEl).toBeVisible({ timeout: 10000 });
    await expect(page.locator('th').filter({ hasText: 'Name' }).first()).toBeVisible();
    await expect(page.locator('th').filter({ hasText: 'Display Name' }).first()).toBeVisible();
    await expect(page.locator('th').filter({ hasText: 'Model' }).first()).toBeVisible();
    await expect(page.locator('th').filter({ hasText: 'Prompt' }).first()).toBeVisible();
    await expect(page.locator('th').filter({ hasText: 'Tools' }).first()).toBeVisible();
    await expect(page.locator('th').filter({ hasText: 'Routing Tags' }).first()).toBeVisible();
    await expect(page.locator('th').filter({ hasText: 'Max Turns' }).first()).toBeVisible();
    await expect(page.locator('th').filter({ hasText: 'Status' }).first()).toBeVisible();

    // Check search bar exists
    await expect(page.getByPlaceholder(/Search/i)).toBeVisible();

    // Check "New" button exists
    await expect(page.getByRole('button', { name: /New/i }).first()).toBeVisible();

    // Note row count (may be zero if API returns 404)
    const agentRows = page.locator('table tbody tr');
    const rowCount = await agentRows.count();
    test.info().annotations.push({
      type: 'info',
      description: `Agent list loaded with ${rowCount} agent(s)`,
    });

    // ── Checkpoint 1: Agent List Page Loaded ──────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-agent-list-loaded.png`,
      fullPage: true,
    });

    // ── Step 2: Click "New" button ────────────────────────────────────────
    await page.getByRole('button', { name: /New/i }).first().click();
    await page.waitForURL('**/ai/admin/agents/new', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // ── Step 3: Verify form tabs ──────────────────────────────────────────
    const mainTab = page.getByRole('tab', { name: /Main/i });
    const toolsTab = page.getByRole('tab', { name: /Tools/i });
    const guardrailsTab = page.getByRole('tab', { name: /Guardrails/i });
    const triggersTab = page.getByRole('tab', { name: /Triggers/i });

    await expect(mainTab).toBeVisible({ timeout: 5000 });
    await expect(toolsTab).toBeVisible({ timeout: 5000 });
    await expect(guardrailsTab).toBeVisible({ timeout: 5000 });
    await expect(triggersTab).toBeVisible({ timeout: 5000 });
    await expect(mainTab).toHaveAttribute('aria-selected', 'true');

    // ── Checkpoint 2: Agent Form with Tabs ────────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-agent-form-tabs.png`,
      fullPage: true,
    });

    // ── Step 4: Fill Main tab form ────────────────────────────────────────
    const nameField = page.getByRole('textbox', { name: 'Name', exact: true });
    await expect(nameField).toBeVisible({ timeout: 5000 });
    await nameField.fill('test-e2e-agent');

    const displayNameField = page.getByRole('textbox', { name: 'Display Name' });
    await expect(displayNameField).toBeVisible({ timeout: 5000 });
    await displayNameField.fill('E2E Test Agent');

    const descriptionField = page.getByRole('textbox', { name: 'Description' });
    if (await descriptionField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await descriptionField.fill('Agent created during E2E testing');
    }

    // Model dropdown — try to select a model
    const modelCombobox = page.getByRole('combobox', { name: 'Model' });
    let modelSelected = false;
    if (await modelCombobox.isVisible({ timeout: 3000 }).catch(() => false)) {
      await modelCombobox.click();
      await page.waitForTimeout(500);
      const modelOptions = page.getByRole('option');
      const modelOptionCount = await modelOptions.count();
      if (modelOptionCount > 1) {
        const sonnetOption = page.getByRole('option', { name: /sonnet/i }).first();
        if (await sonnetOption.isVisible({ timeout: 2000 }).catch(() => false)) {
          await sonnetOption.click();
          modelSelected = true;
        } else {
          await modelOptions.nth(1).click();
          modelSelected = true;
        }
      } else {
        await page.keyboard.press('Escape');
        test.info().annotations.push({
          type: 'missing-feature',
          description:
            'No model options in dropdown — GET /ai/admin/models returns 404 (route not registered on backend)',
        });
      }
      await page.waitForTimeout(300);
    }

    // Prompt dropdown — required field
    const promptCombobox = page.getByRole('combobox', { name: 'Prompt' });
    let promptSelected = false;
    if (await promptCombobox.isVisible({ timeout: 3000 }).catch(() => false)) {
      await promptCombobox.click();
      await page.waitForTimeout(500);
      const promptOptions = page.getByRole('option');
      const promptOptionCount = await promptOptions.count();
      if (promptOptionCount > 0) {
        await promptOptions.first().click();
        promptSelected = true;
      } else {
        await page.keyboard.press('Escape');
        test.info().annotations.push({
          type: 'missing-feature',
          description:
            'No prompt options in dropdown — GET /ai/admin/prompts returns 404 (route not registered on backend). promptId is REQUIRED for agent creation.',
        });
      }
      await page.waitForTimeout(300);
    }

    // Routing Tags — click "+ standard"
    const standardTagButton = page.getByRole('button', { name: '+ standard' });
    if (await standardTagButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await standardTagButton.click();
      await page.waitForTimeout(300);
    }

    // Max Turns
    const maxTurnsField = page.getByRole('spinbutton', { name: 'Max Turns' });
    if (await maxTurnsField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await maxTurnsField.clear();
      await maxTurnsField.fill('15');
    }

    // ── Checkpoint 3: Main Tab Filled ─────────────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-main-tab-filled.png`,
      fullPage: true,
    });

    // ── Step 5: Click Tools tab ───────────────────────────────────────────
    await toolsTab.click();
    await page.waitForTimeout(500);

    // ── Step 6: Fill tools JSON editor ────────────────────────────────────
    const toolsTabPanel = page.getByRole('tabpanel');
    const toolsEditor = toolsTabPanel.locator('textarea').first();
    if (await toolsEditor.isVisible({ timeout: 3000 }).catch(() => false)) {
      await toolsEditor.clear();
      await toolsEditor.fill('["query_invoices", "create_draft"]');
    }

    // ── Step 7: Click Guardrails tab ──────────────────────────────────────
    await guardrailsTab.click();
    await page.waitForTimeout(500);

    // ── Checkpoint 4: Guardrails Tab ──────────────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-7-guardrails-tab.png`,
      fullPage: true,
    });

    // ── Step 8: Fill Guardrails form ──────────────────────────────────────
    const canReadInput = page.getByPlaceholder(/customers/i).first();
    if (await canReadInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await canReadInput.fill('invoice');
      await canReadInput.press('Enter');
      await page.waitForTimeout(300);
      await canReadInput.fill('customer');
      await canReadInput.press('Enter');
      await page.waitForTimeout(300);
    }

    const canWriteInput = page.getByPlaceholder(/invoices/i).first();
    if (await canWriteInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await canWriteInput.fill('invoice');
      await canWriteInput.press('Enter');
      await page.waitForTimeout(300);
    }

    const approvalSwitch = page.getByRole('switch', { name: /Require Approval/i });
    if (await approvalSwitch.isVisible({ timeout: 3000 }).catch(() => false)) {
      const isChecked = await approvalSwitch.getAttribute('aria-checked');
      if (isChecked !== 'true') {
        await approvalSwitch.click();
        await page.waitForTimeout(300);
      }
    }

    const dataScopeCombobox = page
      .getByRole('combobox')
      .filter({ hasText: /Own data|Module|All data/i });
    if (
      await dataScopeCombobox
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      await dataScopeCombobox.first().click();
      await page.waitForTimeout(500);
      const moduleOption = page.getByRole('option', { name: /Module data/i });
      if (await moduleOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await moduleOption.click();
      } else {
        await page.keyboard.press('Escape');
      }
      await page.waitForTimeout(300);
    }

    // ── Step 9: Click Save button ─────────────────────────────────────────
    const saveButton = page.getByRole('button', { name: /Save/i });
    await expect(saveButton.first()).toBeVisible({ timeout: 5000 });

    // Listen for create API response
    const createResponsePromise = page
      .waitForResponse(
        (resp) =>
          resp.url().includes('/ai/admin/agents') &&
          resp.request().method() === 'POST',
        { timeout: 15000 },
      )
      .catch(() => null);

    await saveButton.first().click();

    const createResponse = await createResponsePromise;
    let createSucceeded = false;

    if (createResponse) {
      const status = createResponse.status();
      if (status >= 400) {
        let body = '';
        try {
          body = await createResponse.text();
        } catch {
          /* ignore */
        }
        await page.screenshot({
          path: `${SCREENSHOTS_DIR}/debug-create-api-error.png`,
          fullPage: true,
        });
        test.info().annotations.push({
          type: 'issue',
          description: `Create agent API returned ${status}: ${body.slice(0, 300)}`,
        });
      } else {
        createSucceeded = true;
      }
    } else {
      // No POST response — likely client-side validation prevented submission
      test.info().annotations.push({
        type: 'info',
        description:
          'No POST response — form submission was likely blocked by client-side validation (promptId required but prompt dropdown empty due to API 404)',
      });
    }

    // Wait for possible redirect to edit page
    try {
      await page.waitForURL(
        (url) => /\/ai\/admin\/agents\/[0-9a-f-]{36}/.test(url.pathname),
        { timeout: 5000 },
      );
      createSucceeded = true;
    } catch {
      await page.waitForTimeout(1000);
    }

    await page.waitForLoadState('networkidle');

    // ── Checkpoint 5: Agent Saved (or validation error) ───────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-9-agent-saved.png`,
      fullPage: true,
    });

    if (createSucceeded) {
      // ── Steps 10-11: Navigate back and verify agent in list ──────────────
      const agentRegistryBreadcrumb = page.getByRole('link', {
        name: /Agent Registry|Agent Configuration/i,
      });
      if (
        await agentRegistryBreadcrumb
          .isVisible({ timeout: 3000 })
          .catch(() => false)
      ) {
        await agentRegistryBreadcrumb.click();
      } else {
        const sidebarAgentLink = sidebarNav
          .getByText('AI Administration')
          .first();
        await sidebarAgentLink.click();
        await page.waitForURL('**/ai/admin', { timeout: 10000 });
        await page.waitForLoadState('networkidle');
        const agentNavBtn = page.getByRole('button', {
          name: /Agent Configuration/i,
        });
        await agentNavBtn.first().click();
      }

      await page.waitForURL('**/ai/admin/agents', { timeout: 10000 });
      await page.waitForLoadState('networkidle');

      await expect(
        page.getByRole('heading').filter({ hasText: /Agent Configuration/i }),
      ).toBeVisible({ timeout: 10000 });

      const newAgentCell = page
        .locator('table tbody')
        .getByText('test-e2e-agent');
      await expect(newAgentCell.first()).toBeVisible({ timeout: 10000 });

      // ── Checkpoint 6: New Agent in List ──────────────────────────────────
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-11-agent-in-list.png`,
        fullPage: true,
      });

      const agentRow = page
        .locator('table tbody tr')
        .filter({ hasText: 'test-e2e-agent' });
      await expect(agentRow.first()).toBeVisible({ timeout: 5000 });
      await expect(
        agentRow.first().getByText('E2E Test Agent'),
      ).toBeVisible({ timeout: 3000 });
    } else {
      // Document the API issue as the blocking failure
      const has404Errors = apiErrors.some((e) => e.includes('404'));
      if (has404Errors) {
        test.info().annotations.push({
          type: 'missing-feature',
          description:
            'Backend AI admin API routes return 404 — routes are not registered in the Fastify app. All /ai/admin/* and /system/companies endpoints return "Route not found" for authenticated requests.',
        });
      }

      // Fail with descriptive message about what's missing
      expect(
        createSucceeded,
        `Agent creation failed. Root cause: backend API routes for AI admin are not registered (all return 404). ` +
          `The frontend UI is correctly built (pages, forms, tabs all work) but cannot save data. ` +
          `API errors: [${apiErrors.slice(0, 5).join('; ')}]`,
      ).toBe(true);
    }
  });
});
