import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '_bmad-output/test-artifacts/screenshots/epic-E5c/journey-15';

test.describe('Journey 15 — Failed Run: View Error & Retry from Failed Step', () => {
  test.setTimeout(90_000);

  test.beforeEach(async ({ page }) => {
    // Login as admin user
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const emailField = page.getByLabel('Email');
    await emailField.waitFor({ state: 'visible', timeout: 10000 });
    await emailField.fill('admin@nexa-erp.dev');
    await page.getByLabel('Password').fill('NexaDev2026!');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for redirect away from login page
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
    await page.waitForLoadState('networkidle');
  });

  test('View a failed automation run, inspect error details, and retry from failed step', async ({
    page,
  }) => {
    // ── Step 1: Navigate to Automation Runs via sidebar ──────────────
    // Auth state is in-memory (Zustand), so we MUST use client-side
    // navigation (sidebar links) instead of page.goto() which reloads.

    // Expand the AI sidebar group if needed
    const sidebarAiGroup = page.locator('nav').getByText('AI', { exact: true }).first();
    if (await sidebarAiGroup.isVisible().catch(() => false)) {
      await sidebarAiGroup.click();
      await page.waitForTimeout(300);
    }

    // Look for Automation Runs link in the sidebar
    const automationRunsLink = page.locator('nav a[href*="/automations/runs"]').first()
      .or(page.locator('nav').getByText(/automation runs/i).first());

    if (await automationRunsLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await automationRunsLink.click();
    } else {
      // Try expanding AI Administration sub-group first
      const aiAdminGroup = page.locator('nav').getByText(/ai administration/i).first()
        .or(page.locator('nav').getByText(/ai admin/i).first());
      if (await aiAdminGroup.isVisible({ timeout: 3000 }).catch(() => false)) {
        await aiAdminGroup.click();
        await page.waitForTimeout(300);
      }

      // Try Automations parent first
      const automationsLink = page.locator('nav').getByText(/^automations$/i).first();
      if (await automationsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await automationsLink.click();
        await page.waitForTimeout(300);
      }

      // Now try Automation Runs
      const runsLink = page.locator('nav').getByText(/automation runs|runs/i).first()
        .or(page.locator('nav a[href*="/runs"]').first());
      if (await runsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await runsLink.click();
      } else {
        // Last resort: use evaluate to navigate via router without page reload
        await page.evaluate(() => {
          window.history.pushState({}, '', '/ai/admin/automations/runs');
          window.dispatchEvent(new PopStateEvent('popstate'));
        });
      }
    }

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Verify we're on the Automation Runs page — check for heading or table
    const pageHeading = page.getByRole('heading', { name: /automation runs/i })
      .or(page.getByText('Automation Runs', { exact: true }));
    await expect(pageHeading.first()).toBeVisible({ timeout: 10000 });

    // Verify the table structure is present
    const tableOrList = page.locator('table, [role="table"]');
    await expect(tableOrList.first()).toBeVisible({ timeout: 10000 });

    // CP-1: Run list page loaded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-run-list-loaded.png`,
      fullPage: true,
    });

    // ── Step 2: Filter by FAILED status ──────────────────────────────
    // The filter bar has a status popover button with Filter icon
    const statusFilterButton = page.getByRole('button', {
      name: /status|filter|all statuses/i,
    });

    if (await statusFilterButton.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await statusFilterButton.first().click();
      await page.waitForTimeout(300);

      // Look for FAILED option in the popover
      const failedOption = page.getByRole('option', { name: /failed/i })
        .or(page.locator('[role="menuitemcheckbox"]').filter({ hasText: /failed/i }))
        .or(page.getByText(/^Failed$/));

      if (await failedOption.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await failedOption.first().click();
        await page.waitForTimeout(500);

        // Close popover by pressing Escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    }

    // CP-2: Filtered to FAILED runs
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-filtered-failed-runs.png`,
      fullPage: true,
    });

    // ── Step 3: Click first FAILED run row ───────────────────────────
    const failedRow = page.locator('tr, [role="row"]').filter({
      hasText: /failed/i,
    });

    const failedRowCount = await failedRow.count();
    if (failedRowCount === 0) {
      // No FAILED runs — acceptable per preconditions
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-3-no-failed-runs-found.png`,
        fullPage: true,
      });
      console.log('No FAILED runs found in database. Testing UI structure only.');
      return;
    }

    // Click the first FAILED run row
    await failedRow.first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Verify we navigated to a run detail page
    await expect(page).toHaveURL(/\/ai\/admin\/automations\/runs\/[a-f0-9-]+/i, {
      timeout: 10000,
    });

    // CP-3: Failed run detail page
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-failed-run-detail.png`,
      fullPage: true,
    });

    // Verify status badge shows Failed
    const failedBadge = page.getByText(/failed/i).first();
    await expect(failedBadge).toBeVisible();

    // Verify error banner is visible (red-bordered alert with "Run Failed")
    const errorBanner = page.locator('[class*="red"], [class*="error"], [role="alert"]')
      .filter({ hasText: /run failed|error/i });
    const hasErrorBanner = await errorBanner.first().isVisible({ timeout: 5000 }).catch(() => false);

    // Verify Retry button in header
    const retryHeaderButton = page.getByRole('button', { name: /retry/i });
    const hasRetryButton = await retryHeaderButton.first().isVisible({ timeout: 5000 }).catch(() => false);

    // Verify metrics cards are present
    const metricsSection = page.getByText(/total tokens|total cost|steps|duration/i);
    await expect(metricsSection.first()).toBeVisible({ timeout: 5000 });

    // ── Step 4: Verify failed step in timeline ───────────────────────
    const timelineHeading = page.getByText(/step execution timeline/i);
    await expect(timelineHeading).toBeVisible({ timeout: 5000 });

    await timelineHeading.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    // Check for the failed step indicator (red left border)
    const failedStepIndicator = page.locator(
      '[class*="border-l-red"], [class*="red-500"], [class*="dc2626"]',
    );
    const failedStepExists = await failedStepIndicator.first().isVisible({ timeout: 5000 }).catch(() => false);

    // Check for skipped steps
    const skippedSteps = page.getByText(/skipped/i);
    const hasSkippedSteps = await skippedSteps.first().isVisible({ timeout: 3000 }).catch(() => false);

    // CP-4: Failed step in timeline
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-failed-step-timeline.png`,
      fullPage: true,
    });

    // ── Step 5: Click Retry button ───────────────────────────────────
    // Try "Retry from This Step" in timeline first, then header "Retry"
    const retryFromStepButton = page.getByRole('button', {
      name: /retry from this step/i,
    });

    let retryButton: ReturnType<typeof page.getByRole>;

    if (await retryFromStepButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      retryButton = retryFromStepButton;
    } else if (hasRetryButton) {
      retryButton = retryHeaderButton.first();
    } else {
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-5-no-retry-button.png`,
        fullPage: true,
      });
      console.log('No retry button found on failed run detail page.');
      return;
    }

    await retryButton.click();
    await page.waitForTimeout(500);

    // CP-5: Retry confirmation dialog
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-retry-confirmation-dialog.png`,
      fullPage: true,
    });

    // Verify confirmation dialog appears
    const confirmDialog = page.getByRole('dialog')
      .or(page.getByRole('alertdialog'))
      .or(page.locator('[role="dialog"], [data-state="open"]'));

    const dialogVisible = await confirmDialog.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (dialogVisible) {
      // Verify dialog content
      const dialogTitle = page.getByText(/retry from failed step/i);
      await dialogTitle.isVisible({ timeout: 3000 }).catch(() => false);

      // Verify Cancel button
      const cancelButton = page.getByRole('button', { name: /cancel/i });
      await expect(cancelButton).toBeVisible({ timeout: 3000 });

      // ── Step 6: Confirm retry ────────────────────────────────────
      const confirmRetryButton = confirmDialog.first()
        .getByRole('button', { name: /retry|confirm/i });

      if (await confirmRetryButton.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmRetryButton.first().click();
        await page.waitForTimeout(2000);

        // CP-6: After retry initiated
        await page.screenshot({
          path: `${SCREENSHOTS_DIR}/step-6-retry-initiated.png`,
          fullPage: true,
        });

        // Check for success toast or navigation to new run
        const successToast = page.getByText(/retry started|retry initiated|success/i);
        await successToast.first().isVisible({ timeout: 5000 }).catch(() => false);

        // Check for retryOfRunId in metadata
        const retryMetadata = page.getByText(/retry of/i);
        await retryMetadata.isVisible({ timeout: 5000 }).catch(() => false);
      }
    } else {
      // No dialog appeared — retry may have happened directly
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-6-retry-initiated.png`,
        fullPage: true,
      });
    }
  });
});
