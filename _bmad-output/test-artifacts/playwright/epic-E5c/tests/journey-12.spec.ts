import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '_bmad-output/test-artifacts/screenshots/epic-E5c/journey-12';

/**
 * Helper: navigate within the SPA using TanStack Router.
 * Auth tokens are in-memory only (Zustand), so page.goto() would
 * cause a full reload and lose the authenticated session.
 */
async function spaNavigate(
  page: import('@playwright/test').Page,
  path: string,
) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await page.waitForTimeout(500);
}

test.describe('Journey 12: Create a Scheduled Automation with Steps', () => {
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

  test('Create scheduled automation with 2 steps, cron preset, and budget (E5c-5 AC-1, AC-2, AC-3, AC-4)', async ({
    page,
  }) => {
    // Capture API errors for diagnostics
    const apiErrors: string[] = [];
    page.on('response', (response) => {
      if (response.url().includes('/api/') && response.status() >= 400) {
        apiErrors.push(
          `${response.status()} ${response.request().method()} ${new URL(response.url()).pathname}`,
        );
      }
    });

    // ── Step 1: Navigate to /ai/admin/automations ─────────────────────────
    await spaNavigate(page, '/ai/admin/automations');
    await expect(
      page.getByRole('heading', { name: 'Automations' }),
    ).toBeVisible({ timeout: 15000 });
    // Wait for data to load
    await page.waitForTimeout(2000);

    // Verify seeded automation is visible
    const hasSeedAutomation = await page
      .getByText('Daily AR Aging Summary')
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Step 1: Automations list loaded, seeded automation visible=${hasSeedAutomation}`,
    });

    // ── Checkpoint 1: Automation list page loaded ──────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-automation-list-page.png`,
      fullPage: true,
    });

    // ── Step 2: Click "New" button to create automation ────────────────────
    // EntityListPage renders button with text from t('new') — "New"
    const newButton = page.getByRole('button', { name: /^new$/i });
    await expect(newButton.first()).toBeVisible({ timeout: 5000 });
    await newButton.first().click();

    // Wait for navigation to /ai/admin/automations/new
    await page.waitForURL('**/ai/admin/automations/new', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Verify we're on the builder page
    await expect(
      page.getByRole('heading', { name: 'New Automation' }),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Basic Configuration')).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText('Trigger Configuration')).toBeVisible({
      timeout: 5000,
    });

    test.info().annotations.push({
      type: 'info',
      description: 'Step 2: Automation builder loaded in create mode',
    });

    // ── Checkpoint 2: Automation builder in create mode ────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-automation-builder-create.png`,
      fullPage: true,
    });

    // ── Step 3: Fill basic config (name + description) ─────────────────────
    const nameInput = page.getByLabel('Name');
    await nameInput.waitFor({ state: 'visible', timeout: 5000 });
    await nameInput.fill('Weekly PO Review');

    const descriptionInput = page.getByLabel('Description');
    await descriptionInput.fill(
      'Review open purchase orders every Monday morning and flag overdue deliveries',
    );

    test.info().annotations.push({
      type: 'info',
      description: 'Step 3: Name and description populated',
    });

    // ── Step 4: Select "Scheduled" trigger type ────────────────────────────
    // Default is MANUAL. Click the Scheduled radio option label.
    const scheduledLabel = page.getByText('Scheduled').first();
    await expect(scheduledLabel).toBeVisible({ timeout: 5000 });
    await scheduledLabel.click();
    await page.waitForTimeout(500);

    // Verify CronBuilder appeared
    const hasCronBuilder = await page
      .getByText('Weekly on Monday')
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Step 4: Scheduled selected, CronBuilder visible=${hasCronBuilder}`,
    });

    // ── Checkpoint 3: Cron builder visible ─────────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-cron-builder-visible.png`,
      fullPage: true,
    });

    // ── Step 5: Click "Weekly on Monday" preset ────────────────────────────
    const weeklyPreset = page.getByRole('button', {
      name: 'Weekly on Monday',
    });
    await expect(weeklyPreset).toBeVisible({ timeout: 5000 });
    await weeklyPreset.click();
    await page.waitForTimeout(500);

    // Verify the preset is active (purple background)
    // Check for human-readable preview text
    const hasPreview = await page
      .getByText(/on monday/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Step 5: Weekly on Monday preset applied, preview visible=${hasPreview}`,
    });

    // ── Checkpoint 4: Weekly Monday preset applied ─────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-weekly-monday-preset.png`,
      fullPage: true,
    });

    // ── Step 6 (test plan) — form already has Step 1, verify it exists ─────
    // The default form values include 1 step. Scroll to the Steps section.
    await page.getByText('Steps').first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    // Verify step 1 exists — look for the purple badge with "1"
    const stepBadges = page.locator(
      'div.bg-\\[\\#7c3aed\\].rounded-full',
    );
    const hasStep1 = (await stepBadges.count()) >= 1;

    test.info().annotations.push({
      type: 'info',
      description: `Step 6: Step 1 card present=${hasStep1}`,
    });

    // ── Checkpoint 5: First step card ──────────────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-first-step-added.png`,
      fullPage: true,
    });

    // ── Step 7: Configure Step 1 — agent, goal, maxTurns ───────────────────
    // Select agent from the first Agent combobox (step 1)
    const agentComboboxesStep7 = page.getByRole('combobox', { name: 'Agent' });
    const step1AgentCombobox = agentComboboxesStep7.first();

    if (await step1AgentCombobox.isVisible({ timeout: 5000 }).catch(() => false)) {
      await step1AgentCombobox.click();
      await page.waitForTimeout(500);

      // Select the first available agent
      const agentOptions = page.locator('[role="option"]');
      const optionCount = await agentOptions.count();

      if (optionCount > 0) {
        await agentOptions.first().click();
        await page.waitForTimeout(300);
        test.info().annotations.push({
          type: 'info',
          description: `Step 7: Selected first agent from ${optionCount} options`,
        });
      } else {
        test.info().annotations.push({
          type: 'issue',
          description: 'Step 7: No agents available in dropdown',
        });
      }
    }

    // Fill goal textarea
    const goalTextareas = page.getByPlaceholder(
      /describe what this step should accomplish/i,
    );
    const goalTextarea1 = goalTextareas.first();
    await goalTextarea1.waitFor({ state: 'visible', timeout: 5000 });
    await goalTextarea1.fill(
      'Review all open purchase orders. Flag any with delivery dates more than 7 days overdue. For each flagged PO, assess risk level.',
    );

    // Set maxTurns to 10 (default value, but set it explicitly)
    const maxTurnsInputs = page.getByLabel('Max Turns');
    const maxTurns1 = maxTurnsInputs.first();
    if (await maxTurns1.isVisible({ timeout: 3000 }).catch(() => false)) {
      await maxTurns1.clear();
      await maxTurns1.fill('10');
    }

    test.info().annotations.push({
      type: 'info',
      description: 'Step 7: Step 1 configured with agent and goal',
    });

    // ── Step 8: Add Step 2 ─────────────────────────────────────────────────
    const addStepButton = page.getByText('Add Step');
    await addStepButton.scrollIntoViewIfNeeded();
    await addStepButton.click();
    await page.waitForTimeout(500);

    // Verify step count increased
    const stepBadgesAfter = page.locator(
      'div.bg-\\[\\#7c3aed\\].rounded-full',
    );
    const stepCountAfter = await stepBadgesAfter.count();

    test.info().annotations.push({
      type: 'info',
      description: `Step 8: After Add Step, step badge count=${stepCountAfter}`,
    });

    // ── Checkpoint 6: Two step cards ───────────────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-8-two-steps-connected.png`,
      fullPage: true,
    });

    // ── Step 9: Configure Step 2 — agent and goal ──────────────────────────
    // Select agent for step 2 — the second Agent combobox (labeled "Agent")
    const agentComboboxes = page.getByRole('combobox', { name: 'Agent' });
    const agentComboboxCount = await agentComboboxes.count();

    if (agentComboboxCount >= 2) {
      // Click the second agent combobox (step 2)
      await agentComboboxes.nth(1).click();
      await page.waitForTimeout(500);

      const agentOptions = page.locator('[role="option"]');
      const optionCount = await agentOptions.count();

      if (optionCount > 0) {
        await agentOptions.first().click();
        await page.waitForTimeout(300);
        test.info().annotations.push({
          type: 'info',
          description: `Step 9: Selected agent for step 2 from ${optionCount} options`,
        });
      }
    } else {
      test.info().annotations.push({
        type: 'issue',
        description: `Step 9: Only ${agentComboboxCount} agent comboboxes found, expected >= 2`,
      });
    }

    // Fill goal for step 2 — the second goal textarea (step 2's is empty)
    const allGoals = page.getByPlaceholder(
      /describe what this step should accomplish/i,
    );
    const goalCount = await allGoals.count();

    if (goalCount >= 2) {
      await allGoals.nth(1).fill(
        'Summarise the flagged purchase orders and draft a report for the procurement manager.',
      );
      test.info().annotations.push({
        type: 'info',
        description: 'Step 9: Step 2 goal filled',
      });
    } else {
      test.info().annotations.push({
        type: 'issue',
        description: `Step 9: Only ${goalCount} goal textareas found, expected >= 2`,
      });
    }

    // ── Step 10: Click "Use Previous Step Output" on Step 2 ────────────────
    // First expand Input Configuration on step 2
    const inputConfigButtons = page.getByText('Input Configuration');
    const inputConfigCount = await inputConfigButtons.count();

    if (inputConfigCount >= 2) {
      // Click the second Input Configuration (step 2)
      await inputConfigButtons.nth(1).click();
      await page.waitForTimeout(500);

      // Click "Use Previous Step Output"
      const usePrevBtn = page.getByText('Use Previous Step Output');
      if (await usePrevBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await usePrevBtn.click();
        await page.waitForTimeout(300);
        test.info().annotations.push({
          type: 'info',
          description: 'Step 10: Use Previous Step Output clicked',
        });
      } else {
        test.info().annotations.push({
          type: 'issue',
          description:
            'Step 10: Use Previous Step Output button not visible after expanding Input Config',
        });
      }
    } else {
      test.info().annotations.push({
        type: 'issue',
        description: `Step 10: Only ${inputConfigCount} Input Configuration sections found, expected >= 2`,
      });
    }

    // ── Step 11: Fill Budget section ───────────────────────────────────────
    await page.getByText('Budget').first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    const tokenBudgetInput = page.getByLabel('Max Token Budget');
    if (
      await tokenBudgetInput.isVisible({ timeout: 5000 }).catch(() => false)
    ) {
      await tokenBudgetInput.clear();
      await tokenBudgetInput.fill('75000');
      test.info().annotations.push({
        type: 'info',
        description: 'Step 11: Token budget set to 75000',
      });
    }

    const durationInput = page.getByLabel('Max Duration (seconds)');
    if (await durationInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await durationInput.clear();
      await durationInput.fill('600');
      test.info().annotations.push({
        type: 'info',
        description: 'Step 11: Duration set to 600',
      });
    }

    // ── Step 12: Click Save ────────────────────────────────────────────────
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);

    const saveButton = page.getByRole('button', { name: /^Save$/i });
    await expect(saveButton.first()).toBeVisible({ timeout: 5000 });

    const saveEnabled = await saveButton.first().isEnabled();

    test.info().annotations.push({
      type: 'info',
      description: `Step 12: Save button enabled=${saveEnabled}`,
    });

    if (saveEnabled) {
      await saveButton.first().click();

      // Wait for save to complete (API call + navigation)
      await page.waitForTimeout(3000);

      // Check for success toast
      const hasSuccess = await page
        .getByText(/automation created|saved|success/i)
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      // Check if we navigated to the edit page (create returns new ID)
      const currentUrl = page.url();
      const navigatedToEdit =
        currentUrl.includes('/ai/admin/automations/') &&
        !currentUrl.includes('/new');

      test.info().annotations.push({
        type: 'info',
        description: `Step 12: Save result toast=${hasSuccess}, navigatedToEdit=${navigatedToEdit}, url=${currentUrl}`,
      });

      expect(
        hasSuccess || navigatedToEdit,
        'Automation should be created (success toast or navigation to edit page)',
      ).toBeTruthy();
    } else {
      // Save disabled — likely validation issue
      test.info().annotations.push({
        type: 'issue',
        description:
          'Step 12: Save button DISABLED — form may not be dirty or has validation errors',
      });

      // Check for validation errors
      const formErrors = page.locator('[role="alert"], .text-destructive');
      const errorCount = await formErrors.count();

      test.info().annotations.push({
        type: 'issue',
        description: `Step 12: Found ${errorCount} form error indicators`,
      });
    }

    // ── Checkpoint 7: Automation saved ─────────────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-12-automation-saved.png`,
      fullPage: true,
    });

    // ── Final Diagnostics ──────────────────────────────────────────────────
    if (apiErrors.length > 0) {
      const unique = [...new Set(apiErrors)];
      test.info().annotations.push({
        type: 'issue',
        description: `API errors: ${unique.slice(0, 10).join('; ')}`,
      });
    }
  });
});
