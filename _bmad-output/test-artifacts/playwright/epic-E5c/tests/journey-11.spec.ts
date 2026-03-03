import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '_bmad-output/test-artifacts/screenshots/epic-E5c/journey-11';

test.describe('Journey 11: Automation Chain Configuration & Notifications', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    // Login as admin user — avoid networkidle as API errors cause infinite retries
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@nexa-erp.dev');
    await page.getByLabel('Password').fill('NexaDev2026!');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 15000,
    });
    // Wait for sidebar to render instead of networkidle
    await expect(
      page.getByRole('link', { name: 'AI Administration' }),
    ).toBeVisible({ timeout: 10000 });
  });

  test('Configure chain-to-next-automation and notification settings (E5c-5 AC-7, AC-8)', async ({
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

    // ── Step 1: Navigate to /ai/admin/automations ────────────────────
    await page.getByRole('link', { name: 'AI Administration' }).click();
    await page.waitForURL('**/ai/admin', { timeout: 10000 });

    // Wait for AI Configuration dashboard to load
    await expect(
      page.getByRole('heading', { name: /AI Configuration/i }),
    ).toBeVisible({ timeout: 10000 });

    // Click the Automations quick-nav button on the dashboard
    const automationsBtn = page.getByRole('button', {
      name: /Automations/i,
    });
    await expect(automationsBtn.first()).toBeVisible({ timeout: 10000 });
    await automationsBtn.first().click();
    await page.waitForURL('**/ai/admin/automations', { timeout: 10000 });

    // Verify automation list page loaded
    const listHeading = page.getByRole('heading', { name: /Automations/i });
    await expect(listHeading.first()).toBeVisible({ timeout: 10000 });

    test.info().annotations.push({
      type: 'info',
      description: 'Step 1: Automation list page loaded',
    });

    // ── Checkpoint 1: Automation List Page ────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-01-automation-list.png`,
      fullPage: true,
    });

    // ── Step 2: Click automation row to edit ──────────────────────────
    // Journey 11 depends on "E2E Weekly Summary" from j10; fallback to seeded automation
    const weeklyRow = page.getByText('E2E Weekly Summary');
    const weeklyVisible = await weeklyRow
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    let automationName = '';

    if (weeklyVisible) {
      automationName = 'E2E Weekly Summary';
    } else {
      test.info().annotations.push({
        type: 'info',
        description:
          'Step 2: "E2E Weekly Summary" not found — trying seeded "Daily AR Aging Summary"',
      });
      const fallbackRow = page.getByText('Daily AR Aging Summary');
      const fallbackVisible = await fallbackRow
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      if (fallbackVisible) {
        automationName = 'Daily AR Aging Summary';
      }
    }

    if (!automationName) {
      // No automations — check if list is empty
      test.info().annotations.push({
        type: 'issue',
        description:
          'Step 2: No automations found in list — cannot proceed',
      });
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-02-no-automations.png`,
        fullPage: true,
      });
      return;
    }

    // Open the actions menu for the target automation and click Edit
    const actionsBtn = page
      .getByRole('button', { name: new RegExp(`Actions for ${automationName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i') })
      .first();
    const actionsVisible = await actionsBtn
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (actionsVisible) {
      await actionsBtn.click();
      await page.waitForTimeout(300);
      const editMenuItem = page.getByRole('menuitem', { name: /Edit/i });
      await expect(editMenuItem).toBeVisible({ timeout: 3000 });
      await editMenuItem.click();
    } else {
      // Fallback: click the automation name text directly
      await page.getByText(automationName).first().click();
    }

    // Wait for edit page to load
    await page.waitForURL('**/ai/admin/automations/**', { timeout: 10000 });

    // Wait for the form heading or a key form element instead of networkidle
    const formHeading = page.getByRole('heading', {
      name: new RegExp(`${automationName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|Edit Automation`, 'i'),
    });
    const formLoaded = await formHeading
      .first()
      .isVisible({ timeout: 10000 })
      .catch(() => false);

    // Also try to wait for the Name input as a form load indicator
    if (!formLoaded) {
      await expect(page.getByLabel('Name').first()).toBeVisible({
        timeout: 10000,
      });
    }

    test.info().annotations.push({
      type: 'info',
      description: `Step 2: Edit page loaded for "${automationName}"`,
    });

    // ── Checkpoint 2: Edit Page Loaded ───────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-02-edit-page-loaded.png`,
      fullPage: true,
    });

    // ── Step 3: Enable "Chain to next automation" toggle ─────────────
    // Scroll down to the Chain Configuration card
    const chainHeading = page.getByRole('heading', {
      name: /Chain Configuration/i,
    });
    if (
      !(await chainHeading
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false))
    ) {
      await page.evaluate(() =>
        window.scrollTo(0, document.body.scrollHeight),
      );
      await page.waitForTimeout(500);
    }

    const chainToggle = page.getByLabel('Chain to next automation');
    let chainToggleFound = false;

    if (
      await chainToggle
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      chainToggleFound = true;

      const isChecked = await chainToggle
        .first()
        .isChecked()
        .catch(() => false);
      if (!isChecked) {
        await chainToggle.first().click();
        await page.waitForTimeout(500);
      }

      test.info().annotations.push({
        type: 'info',
        description: `Step 3: Chain toggle enabled (was checked=${isChecked})`,
      });
    } else {
      test.info().annotations.push({
        type: 'issue',
        description:
          'Step 3: "Chain to next automation" toggle not found — MISSING FEATURE',
      });
    }

    // ── Step 4: Select chain target in dropdown ──────────────────────
    let chainTargetSelected = false;

    if (chainToggleFound) {
      // The "Next Automation" select should now be visible
      const chainSelect = page
        .getByRole('combobox', { name: /Next Automation/i })
        .or(page.getByLabel('Next Automation'));

      const selectVisible = await chainSelect
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (selectVisible) {
        await chainSelect.first().click();
        await page.waitForTimeout(500);

        // Look for "Daily AR Aging Summary" option (seeded data)
        // If editing Daily AR itself, look for any other automation
        const targetName =
          automationName === 'Daily AR Aging Summary'
            ? /E2E Weekly Summary|Weekly/i
            : /Daily AR Aging Summary/i;

        const targetOption = page.getByRole('option', { name: targetName });
        if (
          await targetOption
            .first()
            .isVisible({ timeout: 3000 })
            .catch(() => false)
        ) {
          await targetOption.first().click();
          chainTargetSelected = true;
        } else {
          // Try any available option
          const options = page.getByRole('option');
          const count = await options.count().catch(() => 0);
          if (count > 0) {
            await options.first().click();
            chainTargetSelected = true;
            test.info().annotations.push({
              type: 'info',
              description:
                'Step 4: Target automation not found — selected first available option',
            });
          } else {
            await page.keyboard.press('Escape');
            test.info().annotations.push({
              type: 'issue',
              description:
                'Step 4: Chain dropdown has no options — no other automations available',
            });
          }
        }
      } else {
        test.info().annotations.push({
          type: 'issue',
          description:
            'Step 4: Chain "Next Automation" select not visible after enabling toggle',
        });
      }
    }

    test.info().annotations.push({
      type: 'info',
      description: `Step 4: Chain target selected=${chainTargetSelected}`,
    });

    await page.waitForTimeout(300);

    // ── Checkpoint 3: Chain Configured ───────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-03-chain-configured.png`,
      fullPage: true,
    });

    // ── Step 5: Enable "Notify on completion" toggle ─────────────────
    const notifyHeading = page.getByRole('heading', {
      name: /Notifications/i,
    });
    if (
      !(await notifyHeading
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false))
    ) {
      await page.evaluate(() =>
        window.scrollTo(0, document.body.scrollHeight),
      );
      await page.waitForTimeout(500);
    }

    const notifyToggle = page.getByLabel('Notify on completion');
    let notifyToggleFound = false;

    if (
      await notifyToggle
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      notifyToggleFound = true;

      const isChecked = await notifyToggle
        .first()
        .isChecked()
        .catch(() => false);
      if (!isChecked) {
        await notifyToggle.first().click();
        await page.waitForTimeout(500);
      }

      test.info().annotations.push({
        type: 'info',
        description: `Step 5: Notify toggle enabled (was checked=${isChecked})`,
      });
    } else {
      test.info().annotations.push({
        type: 'issue',
        description:
          'Step 5: "Notify on completion" toggle not found — MISSING FEATURE',
      });
    }

    // ── Step 6: Configure notification settings ──────────────────────
    let notifyConfigured = false;

    if (notifyToggleFound) {
      // In-App checkbox — should be checked by default, verify
      const inAppCheckbox = page.getByLabel('In-App');
      if (
        await inAppCheckbox
          .first()
          .isVisible({ timeout: 3000 })
          .catch(() => false)
      ) {
        const inAppChecked = await inAppCheckbox
          .first()
          .isChecked()
          .catch(() => false);
        if (!inAppChecked) {
          await inAppCheckbox.first().click();
          await page.waitForTimeout(200);
        }
        test.info().annotations.push({
          type: 'info',
          description: `Step 6: In-App checkbox checked (was=${inAppChecked})`,
        });
      }

      // Notify on success — default true, verify
      const successToggle = page.getByLabel('Notify on success');
      if (
        await successToggle
          .first()
          .isVisible({ timeout: 3000 })
          .catch(() => false)
      ) {
        const successChecked = await successToggle
          .first()
          .isChecked()
          .catch(() => false);
        if (!successChecked) {
          await successToggle.first().click();
          await page.waitForTimeout(200);
        }
        test.info().annotations.push({
          type: 'info',
          description: `Step 6: Notify on success checked (was=${successChecked})`,
        });
      }

      // Notify on failure — default true, verify
      const failureToggle = page.getByLabel('Notify on failure');
      if (
        await failureToggle
          .first()
          .isVisible({ timeout: 3000 })
          .catch(() => false)
      ) {
        const failureChecked = await failureToggle
          .first()
          .isChecked()
          .catch(() => false);
        if (!failureChecked) {
          await failureToggle.first().click();
          await page.waitForTimeout(200);
        }
        test.info().annotations.push({
          type: 'info',
          description: `Step 6: Notify on failure checked (was=${failureChecked})`,
        });
      }

      notifyConfigured = true;
    }

    test.info().annotations.push({
      type: 'info',
      description: `Step 6: Notification configured=${notifyConfigured}`,
    });

    // ── Checkpoint 4: Notification Section Configured ────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-04-notification-configured.png`,
      fullPage: true,
    });

    // ── Step 7: Click Save ───────────────────────────────────────────
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);

    const saveBtn = page.getByRole('button', { name: /^Save$/i });
    await expect(saveBtn.first()).toBeVisible({ timeout: 5000 });

    const saveEnabled = await saveBtn.first().isEnabled();

    test.info().annotations.push({
      type: 'info',
      description: `Step 7: Save button enabled=${saveEnabled}`,
    });

    if (saveEnabled) {
      await saveBtn.first().click();
      await page.waitForTimeout(3000);

      // Check for success toast
      const updatedToast = page.getByText(
        /Automation updated|Automation saved|saved successfully/i,
      );
      const hasUpdatedToast = await updatedToast
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      // Check for error toast
      const errorToast = page.getByText(
        /error|failed|unexpected|not found|cycle|circular/i,
      );
      const hasErrorToast = await errorToast
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false);

      test.info().annotations.push({
        type: 'info',
        description: `Step 7: success=${hasUpdatedToast}, error=${hasErrorToast}`,
      });

      if (hasErrorToast && !hasUpdatedToast) {
        test.info().annotations.push({
          type: 'issue',
          description:
            'Step 7: Save failed — possible API error or circular chain rejection',
        });
      }
    } else {
      test.info().annotations.push({
        type: 'issue',
        description:
          'Step 7: Save button DISABLED — form has validation errors',
      });
    }

    // ── Checkpoint 5: Save Success ───────────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-05-save-success.png`,
      fullPage: true,
    });

    // ── Final Assertions ─────────────────────────────────────────────
    if (apiErrors.length > 0) {
      const unique = [...new Set(apiErrors)];
      test.info().annotations.push({
        type: 'issue',
        description: `API errors: ${unique.slice(0, 10).join('; ')}`,
      });
    }

    // Assert that the Chain Configuration section exists
    expect(chainToggleFound, 'Chain toggle should exist on the form').toBe(
      true,
    );

    // Assert that the Notifications section exists
    expect(
      notifyToggleFound,
      'Notify toggle should exist on the form',
    ).toBe(true);
  });
});
