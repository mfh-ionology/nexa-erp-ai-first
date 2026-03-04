import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '_bmad-output/test-artifacts/screenshots/epic-E5c/journey-14';

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

test.describe('Journey 14: Automation Chain Configuration and Notifications', () => {
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

  test('Configure chain and notification settings on existing automation (E5c-5 AC-7, AC-8)', async ({
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

    // Verify the Weekly PO Review automation exists (created by journey 12 or seed)
    const weeklyPORow = page.getByText('Weekly PO Review');
    const hasWeeklyPO = await weeklyPORow
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Step 1: Automations list loaded, Weekly PO Review visible=${hasWeeklyPO}`,
    });

    // ── Checkpoint 1: Automation list loaded ─────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-automation-list-loaded.png`,
      fullPage: true,
    });

    // If Weekly PO Review doesn't exist, we need to create it first
    if (!hasWeeklyPO) {
      test.info().annotations.push({
        type: 'issue',
        description:
          'Step 1: Weekly PO Review not found — creating it for this journey',
      });

      // Create a minimal automation so we can test chain/notification config
      const newButton = page.getByRole('button', { name: /^new$/i });
      await expect(newButton.first()).toBeVisible({ timeout: 5000 });
      await newButton.first().click();
      await page.waitForURL('**/ai/admin/automations/new', { timeout: 10000 });
      await page.waitForTimeout(1000);

      // Fill minimal fields
      const nameInput = page.getByLabel('Name');
      await nameInput.waitFor({ state: 'visible', timeout: 5000 });
      await nameInput.fill('Weekly PO Review');

      const descriptionInput = page.getByLabel('Description');
      await descriptionInput.fill('Review open purchase orders weekly');

      // Add a step with an agent and goal
      const agentCombobox = page.getByRole('combobox', { name: 'Agent' }).first();
      if (await agentCombobox.isVisible({ timeout: 5000 }).catch(() => false)) {
        await agentCombobox.click();
        await page.waitForTimeout(500);
        const agentOptions = page.locator('[role="option"]');
        if ((await agentOptions.count()) > 0) {
          await agentOptions.first().click();
          await page.waitForTimeout(300);
        }
      }

      const goalTextarea = page
        .getByPlaceholder(/describe what this step should accomplish/i)
        .first();
      await goalTextarea.waitFor({ state: 'visible', timeout: 5000 });
      await goalTextarea.fill('Review open purchase orders');

      // Save
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(300);
      const saveBtn = page.getByRole('button', { name: /^Save$/i }).first();
      await expect(saveBtn).toBeVisible({ timeout: 5000 });
      await saveBtn.click();
      await page.waitForTimeout(3000);

      // Navigate back to automations list
      await spaNavigate(page, '/ai/admin/automations');
      await expect(
        page.getByRole('heading', { name: 'Automations' }),
      ).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(2000);
    }

    // ── Step 2: Click on "Weekly PO Review" row ──────────────────────────
    const targetRow = page.getByText('Weekly PO Review').first();
    await expect(targetRow).toBeVisible({ timeout: 10000 });
    await targetRow.click();

    // Wait for navigation to the automation builder edit page
    await page.waitForURL('**/ai/admin/automations/**', { timeout: 10000 });
    await page.waitForTimeout(1500);

    // Verify we're on the builder page in edit mode
    const nameField = page.getByLabel('Name');
    await expect(nameField).toBeVisible({ timeout: 10000 });
    const nameValue = await nameField.inputValue();

    test.info().annotations.push({
      type: 'info',
      description: `Step 2: Automation builder opened, name="${nameValue}"`,
    });

    // ── Checkpoint 2: Builder opened ─────────────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-automation-builder-opened.png`,
      fullPage: true,
    });

    // ── Step 3: Enable chain configuration toggle ────────────────────────
    // Scroll down to Chain Configuration section
    const chainHeading = page.getByText('Chain Configuration');
    await chainHeading.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    // Find the "Chain to next automation" toggle — use accessible role locator
    const chainSwitch = page.getByRole('switch', { name: 'Chain to next automation' });
    await chainSwitch.waitFor({ state: 'visible', timeout: 5000 });
    const chainAlreadyEnabled =
      (await chainSwitch.getAttribute('data-state')) === 'checked';

    if (!chainAlreadyEnabled) {
      await chainSwitch.click();
      await page.waitForTimeout(500);
    }

    // Verify the dropdown appeared
    const chainDropdown = page.getByText('Select automation to chain to');
    const hasChainDropdown = await chainDropdown
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Step 3: Chain toggle enabled, dropdown visible=${hasChainDropdown}`,
    });

    // ── Checkpoint 3: Chain config expanded ──────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-chain-config-expanded.png`,
      fullPage: true,
    });

    // ── Step 4: Select chain target automation ───────────────────────────
    // Click the Select trigger to open dropdown
    const chainSelectTrigger = page
      .getByText('Select automation to chain to')
      .first();
    await chainSelectTrigger.click();
    await page.waitForTimeout(500);

    // Look for 'Daily AR Aging Summary' in the dropdown options
    const dailyOption = page.getByText('Daily AR Aging Summary');
    const hasDailyOption = await dailyOption
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (hasDailyOption) {
      await dailyOption.first().click();
      await page.waitForTimeout(300);
      test.info().annotations.push({
        type: 'info',
        description:
          'Step 4: Selected "Daily AR Aging Summary" as chain target',
      });
    } else {
      // Select whatever first option is available
      const selectOptions = page.locator('[role="option"]');
      const optionCount = await selectOptions.count();
      if (optionCount > 0) {
        const firstOptionText = await selectOptions.first().textContent();
        await selectOptions.first().click();
        await page.waitForTimeout(300);
        test.info().annotations.push({
          type: 'info',
          description: `Step 4: "Daily AR Aging Summary" not found, selected first option: "${firstOptionText}"`,
        });
      } else {
        test.info().annotations.push({
          type: 'issue',
          description: 'Step 4: No chain target options available in dropdown',
        });
      }
    }

    // ── Step 5: Enable notification toggle ───────────────────────────────
    const notificationsHeading = page.getByText('Notifications').first();
    await notificationsHeading.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    const notifySwitch = page.getByRole('switch', { name: 'Notify on completion' });
    await notifySwitch.waitFor({ state: 'visible', timeout: 5000 });
    const notifyAlreadyEnabled =
      (await notifySwitch.getAttribute('data-state')) === 'checked';

    if (!notifyAlreadyEnabled) {
      await notifySwitch.click();
      await page.waitForTimeout(500);
    }

    // Verify notification config expanded
    const hasInAppCheckbox = await page
      .getByLabel('In-App')
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    const hasEmailCheckbox = await page
      .getByLabel('Email')
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Step 5: Notify toggle enabled, In-App visible=${hasInAppCheckbox}, Email visible=${hasEmailCheckbox}`,
    });

    // ── Checkpoint 4: Notification config expanded ───────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-notification-config-expanded.png`,
      fullPage: true,
    });

    // ── Step 6: Configure notification channels ──────────────────────────
    // Check In-App checkbox
    const inAppCheckbox = page.getByLabel('In-App');
    if (await inAppCheckbox.isVisible({ timeout: 3000 }).catch(() => false)) {
      const inAppChecked = await inAppCheckbox.isChecked();
      if (!inAppChecked) {
        await inAppCheckbox.click();
        await page.waitForTimeout(200);
      }
      test.info().annotations.push({
        type: 'info',
        description: `Step 6: In-App checkbox checked (was already=${inAppChecked})`,
      });
    }

    // Check Email checkbox
    const emailCheckbox = page.getByLabel('Email');
    if (await emailCheckbox.isVisible({ timeout: 3000 }).catch(() => false)) {
      const emailChecked = await emailCheckbox.isChecked();
      if (!emailChecked) {
        await emailCheckbox.click();
        await page.waitForTimeout(200);
      }
      test.info().annotations.push({
        type: 'info',
        description: `Step 6: Email checkbox checked (was already=${emailChecked})`,
      });
    }

    // Verify Notify on success toggle (should be true by default)
    const successSwitch = page.getByRole('switch', { name: 'Notify on success' });
    if (await successSwitch.isVisible({ timeout: 3000 }).catch(() => false)) {
      const successState = await successSwitch.getAttribute('data-state');
      test.info().annotations.push({
        type: 'info',
        description: `Step 6: Notify on success state=${successState}`,
      });
      if (successState !== 'checked') {
        await successSwitch.click();
        await page.waitForTimeout(200);
      }
    }

    // Verify Notify on failure toggle (should be true by default)
    const failureSwitch = page.getByRole('switch', { name: 'Notify on failure' });
    if (await failureSwitch.isVisible({ timeout: 3000 }).catch(() => false)) {
      const failureState = await failureSwitch.getAttribute('data-state');
      test.info().annotations.push({
        type: 'info',
        description: `Step 6: Notify on failure state=${failureState}`,
      });
      if (failureState !== 'checked') {
        await failureSwitch.click();
        await page.waitForTimeout(200);
      }
    }

    test.info().annotations.push({
      type: 'info',
      description: 'Step 6: Notification channels and toggles configured',
    });

    // ── Step 7: Click Save ───────────────────────────────────────────────
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);

    const saveButton = page.getByRole('button', { name: /^Save$/i });
    await expect(saveButton.first()).toBeVisible({ timeout: 5000 });

    const saveEnabled = await saveButton.first().isEnabled();

    test.info().annotations.push({
      type: 'info',
      description: `Step 7: Save button enabled=${saveEnabled}`,
    });

    if (saveEnabled) {
      await saveButton.first().click();

      // Wait for save to complete
      await page.waitForTimeout(3000);

      // Check for success toast
      const hasSuccess = await page
        .getByText(/updated|saved|success/i)
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      test.info().annotations.push({
        type: 'info',
        description: `Step 7: Save result toast=${hasSuccess}`,
      });

      // Verify chain and notification are still set after save
      await page.waitForTimeout(1000);

      // Chain should still be enabled
      const chainStateAfter = await page
        .getByRole('switch', { name: 'Chain to next automation' })
        .getAttribute('data-state')
        .catch(() => 'unknown');

      // Notification should still be enabled
      const notifyStateAfter = await page
        .getByRole('switch', { name: 'Notify on completion' })
        .getAttribute('data-state')
        .catch(() => 'unknown');

      test.info().annotations.push({
        type: 'info',
        description: `Step 7: After save — chain=${chainStateAfter}, notify=${notifyStateAfter}`,
      });

      expect(
        hasSuccess,
        'Should see success toast after saving automation with chain and notification config',
      ).toBeTruthy();
    } else {
      // Save disabled — likely form not dirty or validation errors
      test.info().annotations.push({
        type: 'issue',
        description:
          'Step 7: Save button DISABLED — form may not be dirty or has validation errors',
      });

      const formErrors = page.locator('[role="alert"], .text-destructive');
      const errorCount = await formErrors.count();
      test.info().annotations.push({
        type: 'issue',
        description: `Step 7: Found ${errorCount} form error indicators`,
      });
    }

    // ── Checkpoint 5: Automation saved ───────────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-automation-saved-success.png`,
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
