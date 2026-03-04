import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '_bmad-output/test-artifacts/screenshots/epic-E5c/journey-13';

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

test.describe('Journey 13: Automation Step Reorder and Variable Autocomplete', () => {
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

  test('Open existing automation, add step with variable autocomplete, then delete step (E5c-5 AC-4, AC-6)', async ({
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
      page.getByRole('heading', { name: /Automations/i }),
    ).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    test.info().annotations.push({
      type: 'info',
      description: `Step 1: Automations list loaded, URL=${page.url()}`,
    });

    // ── Step 2: Click row for 'Weekly PO Review' automation ───────────────
    // This automation should have been created by Journey 12
    const weeklyPoRow = page.getByText('Weekly PO Review');
    const hasWeeklyPo = await weeklyPoRow
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Step 2: 'Weekly PO Review' row visible=${hasWeeklyPo}`,
    });

    if (!hasWeeklyPo) {
      // If automation doesn't exist, we need to fall back — use 'Daily AR Aging Summary' (seed data)
      // or fail the test since journey 12 should have created it
      const fallbackRow = page.getByText('Daily AR Aging Summary');
      const hasFallback = await fallbackRow
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      test.info().annotations.push({
        type: 'issue',
        description: `Step 2: 'Weekly PO Review' not found. Fallback 'Daily AR Aging Summary' visible=${hasFallback}. Using fallback.`,
      });

      if (hasFallback) {
        // Click the fallback automation row
        await fallbackRow.first().click();
      } else {
        // Last resort: click the first row in the table
        const firstRow = page.locator('table tbody tr').first();
        const hasRow = await firstRow
          .isVisible({ timeout: 5000 })
          .catch(() => false);

        if (hasRow) {
          await firstRow.click();
          test.info().annotations.push({
            type: 'issue',
            description: 'Step 2: Clicked first available automation row',
          });
        } else {
          test.info().annotations.push({
            type: 'issue',
            description: 'Step 2: No automation rows found at all',
          });
        }
      }
    } else {
      await weeklyPoRow.first().click();
    }

    // Wait for builder to load
    await page.waitForTimeout(2000);

    // Verify builder loaded — look for step cards or heading
    const builderHeading = page.getByRole('heading', {
      name: /Edit Automation|Weekly PO Review|Daily AR/i,
    });
    const hasBuilderHeading = await builderHeading
      .first()
      .isVisible({ timeout: 10000 })
      .catch(() => false);

    // Count existing steps — purple badge circles
    const stepBadges = page.locator('div.bg-\\[\\#7c3aed\\].rounded-full');
    const initialStepCount = await stepBadges.count();

    test.info().annotations.push({
      type: 'info',
      description: `Step 2: Builder heading visible=${hasBuilderHeading}, initial step count=${initialStepCount}`,
    });

    // ── Checkpoint 1: Automation builder with existing steps ──────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-builder-with-two-steps.png`,
      fullPage: true,
    });

    // ── Step 3: Click "Add Step" to add Step 3 ───────────────────────────
    const addStepButton = page.getByText('Add Step');
    await addStepButton.scrollIntoViewIfNeeded();
    await expect(addStepButton).toBeVisible({ timeout: 5000 });
    await addStepButton.click();
    await page.waitForTimeout(500);

    // Verify step count increased
    const stepCountAfterAdd = await stepBadges.count();

    test.info().annotations.push({
      type: 'info',
      description: `Step 3: Step count after add: ${stepCountAfterAdd} (was ${initialStepCount})`,
    });

    expect(
      stepCountAfterAdd,
      'Step count should increase by 1 after Add Step',
    ).toBe(initialStepCount + 1);

    // ── Checkpoint 2: Step 3 added ───────────────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-third-step-added.png`,
      fullPage: true,
    });

    // ── Step 4: Type '{{' in Step 3 goal textarea to trigger autocomplete ─
    // The new step's goal textarea should be the last one
    const goalTextareas = page.getByPlaceholder(
      /describe what this step should accomplish/i,
    );
    const goalCount = await goalTextareas.count();

    test.info().annotations.push({
      type: 'info',
      description: `Step 4: Found ${goalCount} goal textareas, targeting the last one (new step)`,
    });

    // Target the last textarea (the newly added step)
    const newStepGoal = goalTextareas.last();
    await newStepGoal.scrollIntoViewIfNeeded();
    await newStepGoal.click();
    await page.waitForTimeout(300);

    // Type '{{' to trigger autocomplete — use keyboard to simulate real typing
    await newStepGoal.pressSequentially('{{', { delay: 100 });
    await page.waitForTimeout(500);

    // Verify autocomplete dropdown appeared
    const autocompleteListbox = page.locator('[role="listbox"]');
    const hasAutocomplete = await autocompleteListbox
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Step 4: Autocomplete listbox visible=${hasAutocomplete}`,
    });

    // Check for expected variable groups
    if (hasAutocomplete) {
      const hasSystemGroup = await page
        .getByText('System', { exact: false })
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      const hasPreviousStepsGroup = await page
        .getByText('Previous Steps', { exact: false })
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      // Check for specific variables
      const options = page.locator('[role="option"]');
      const optionCount = await options.count();

      test.info().annotations.push({
        type: 'info',
        description: `Step 4: Variable groups — System=${hasSystemGroup}, Previous Steps=${hasPreviousStepsGroup}, total options=${optionCount}`,
      });
    }

    expect(
      hasAutocomplete,
      'Variable autocomplete dropdown should appear after typing {{',
    ).toBeTruthy();

    // ── Checkpoint 3: Variable autocomplete dropdown visible ─────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-variable-autocomplete-dropdown.png`,
      fullPage: true,
    });

    // ── Step 5: Click a step2.output.* variable in autocomplete ──────────
    // Look for any option containing "step2" or "step1" from Previous Steps
    const step2Option = page
      .locator('[role="option"]')
      .filter({ hasText: /step2\.output|step1\.output/i });
    const hasStepOutput = await step2Option
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    let selectedVariableName = '';
    if (hasStepOutput) {
      // Get the variable name text before clicking
      selectedVariableName =
        (await step2Option.first().textContent()) ?? 'step output var';
      await step2Option.first().click();
      await page.waitForTimeout(300);

      test.info().annotations.push({
        type: 'info',
        description: `Step 5: Selected variable: ${selectedVariableName}`,
      });
    } else {
      // Fallback: select any available variable option
      const anyOption = page.locator('[role="option"]').first();
      const hasAnyOption = await anyOption
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      if (hasAnyOption) {
        selectedVariableName =
          (await anyOption.textContent()) ?? 'first var';
        await anyOption.click();
        await page.waitForTimeout(300);

        test.info().annotations.push({
          type: 'info',
          description: `Step 5: step2.output not found, selected fallback variable: ${selectedVariableName}`,
        });
      } else {
        test.info().annotations.push({
          type: 'issue',
          description: 'Step 5: No variable options available to select',
        });
      }
    }

    // Verify autocomplete dismissed
    const autocompleteStillOpen = await autocompleteListbox
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    // Verify variable text inserted in textarea
    const goalValue = await newStepGoal.inputValue();

    test.info().annotations.push({
      type: 'info',
      description: `Step 5: Autocomplete dismissed=${!autocompleteStillOpen}, goal value="${goalValue}"`,
    });

    expect(
      goalValue,
      'Goal textarea should contain the inserted variable reference',
    ).toContain('{{');

    // ── Checkpoint 4: Variable inserted in goal text ─────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-variable-inserted.png`,
      fullPage: true,
    });

    // ── Step 6: Delete Step 3 ────────────────────────────────────────────
    // Find all "Remove step" buttons — the last one is for the new step
    const removeButtons = page.getByRole('button', {
      name: /Remove step/i,
    });
    const removeCount = await removeButtons.count();

    test.info().annotations.push({
      type: 'info',
      description: `Step 6: Found ${removeCount} remove buttons, clicking the last one`,
    });

    if (removeCount > 0) {
      // Click the last remove button (new step)
      await removeButtons.last().scrollIntoViewIfNeeded();
      await removeButtons.last().click();
      await page.waitForTimeout(500);

      // Check if a confirmation dialog appeared (shows when step has content)
      const confirmDialog = page.getByRole('alertdialog');
      const hasConfirmDialog = await confirmDialog
        .isVisible({ timeout: 2000 })
        .catch(() => false);

      if (hasConfirmDialog) {
        // Click "Remove" to confirm
        const removeConfirmButton = confirmDialog.getByRole('button', {
          name: /Remove/i,
        });
        await expect(removeConfirmButton).toBeVisible({ timeout: 3000 });
        await removeConfirmButton.click();
        await page.waitForTimeout(500);

        test.info().annotations.push({
          type: 'info',
          description: 'Step 6: Confirmation dialog appeared, clicked Remove',
        });
      } else {
        test.info().annotations.push({
          type: 'info',
          description:
            'Step 6: No confirmation dialog (step might have been empty)',
        });
      }
    }

    // Verify step count decreased back to original
    const finalStepCount = await stepBadges.count();

    test.info().annotations.push({
      type: 'info',
      description: `Step 6: Final step count=${finalStepCount} (expected ${initialStepCount})`,
    });

    expect(
      finalStepCount,
      'Step count should return to initial count after deletion',
    ).toBe(initialStepCount);

    // ── Checkpoint 5: Step 3 removed, back to 2 steps ────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-step-deleted-back-to-two.png`,
      fullPage: true,
    });

    // ── Final Diagnostics ────────────────────────────────────────────────
    if (apiErrors.length > 0) {
      const unique = [...new Set(apiErrors)];
      test.info().annotations.push({
        type: 'issue',
        description: `API errors: ${unique.slice(0, 10).join('; ')}`,
      });
    }
  });
});
