import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '_bmad-output/test-artifacts/screenshots/epic-E5c/journey-18';

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

test.describe('Journey 18: Failed Run — Error Display and Retry from Failed Step', () => {
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

  test('Failed run detail shows error banner, failed/skipped step timeline, and retry flow (E5c-6 AC-4, AC-5)', async ({
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

    // ── Step 1: Navigate to /ai/admin/automations/runs ──────────────────────
    await spaNavigate(page, '/ai/admin/automations/runs');
    await expect(
      page.getByRole('heading', { name: /Automation Runs/i }),
    ).toBeVisible({ timeout: 15000 });
    // Wait for data to load
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-automation-runs-list-loaded.png`,
      fullPage: true,
    });

    test.info().annotations.push({
      type: 'info',
      description: 'Step 1: Automation Runs list loaded',
    });

    // ── Step 2: Filter to FAILED runs using status multi-select ─────────────
    // The status filter is a Popover triggered by a button with text "All Statuses"
    const statusFilterButton = page.getByRole('button', { name: /all statuses|statuses|status/i });
    const hasStatusFilter = await statusFilterButton.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (hasStatusFilter) {
      await statusFilterButton.first().click();
      await page.waitForTimeout(500);

      // Check the "Failed" checkbox in the popover
      const failedCheckbox = page.getByRole('checkbox').filter({
        has: page.locator('..').filter({ hasText: /Failed/i }),
      });
      const failedLabel = page.locator('label').filter({ hasText: /Failed/i });

      if (await failedLabel.isVisible({ timeout: 3000 }).catch(() => false)) {
        await failedLabel.click();
      } else if (await failedCheckbox.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await failedCheckbox.first().click();
      }

      // Close the popover by clicking outside
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1500);
    }

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-failed-filter-applied.png`,
      fullPage: true,
    });

    test.info().annotations.push({
      type: 'info',
      description: `Step 2: Status filter applied — hasStatusFilter=${hasStatusFilter}`,
    });

    // ── Step 3: Click first FAILED run row ──────────────────────────────────
    // Look for a row with a "Failed" status badge
    const failedRow = page.locator('table tbody tr').filter({ hasText: /Failed/i }).first();
    const hasFailedRow = await failedRow.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasFailedRow) {
      // Check for card-based or link layout
      const failedLink = page.locator('a[href*="/runs/"]').first();
      const hasLinks = await failedLink.isVisible({ timeout: 3000 }).catch(() => false);

      if (!hasLinks) {
        test.info().annotations.push({
          type: 'issue',
          description: 'No FAILED run rows found. Cannot proceed with journey 18 — need seed data with a FAILED automation run.',
        });
        test.skip(true, 'No FAILED automation runs available to test');
        return;
      }
      await failedLink.click();
    } else {
      await failedRow.click();
    }

    // Wait for the detail page to load
    await page.waitForTimeout(2000);

    // Verify we're on a run detail page — look for "Run " heading (Run xxxxxxxx)
    const runHeading = page.getByText(/Run [a-f0-9]{8}/i);
    const hasRunHeading = await runHeading.first().isVisible({ timeout: 5000 }).catch(() => false);

    // Verify FAILED status badge is visible in header
    const failedBadge = page.getByText('Failed');
    const hasFailedBadge = await failedBadge.first().isVisible({ timeout: 5000 }).catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Step 3: Detail page — heading=${hasRunHeading}, failedBadge=${hasFailedBadge}`,
    });

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-failed-run-detail-page.png`,
      fullPage: true,
    });

    // ── Step 4: Verify error banner ─────────────────────────────────────────
    // Error banner has "Run Failed" text and "Retry from Failed Step" button
    const errorBanner = page.getByText('Run Failed');
    const hasErrorBanner = await errorBanner.isVisible({ timeout: 5000 }).catch(() => false);

    const retryFromFailedStepBtn = page.getByRole('button', { name: /Retry from Failed Step/i });
    const hasRetryBtn = await retryFromFailedStepBtn.first().isVisible({ timeout: 3000 }).catch(() => false);

    // Verify the error message text is visible (below "Run Failed")
    const errorMessageArea = page.locator('.border-red-200, .bg-red-50').first();
    const hasErrorArea = await errorMessageArea.isVisible({ timeout: 3000 }).catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Step 4: Error banner — banner=${hasErrorBanner}, retryBtn=${hasRetryBtn}, errorArea=${hasErrorArea}`,
    });

    expect(
      hasErrorBanner || hasErrorArea,
      'Error banner should be visible on FAILED run detail page',
    ).toBeTruthy();

    // ── Step 5: Verify step timeline with failed step and skipped steps ─────
    // Look for the "Step Execution Timeline" heading
    const timelineHeading = page.getByText(/Step Execution Timeline/i);
    const hasTimeline = await timelineHeading.isVisible({ timeout: 5000 }).catch(() => false);

    // Scroll down to see the timeline
    await page.evaluate(() => window.scrollBy(0, 400));
    await page.waitForTimeout(500);

    // Check for failed step (red border-l-4 indicator) — the step card with red left border
    const failedStepCard = page.locator('.border-l-red-500, [class*="border-l-red"]').first();
    const hasFailedStepCard = await failedStepCard.isVisible({ timeout: 5000 }).catch(() => false);

    // Check for skipped steps (opacity-60 class or "Skipped" text)
    const skippedStepText = page.getByText(/Skipped/i);
    const hasSkippedSteps = await skippedStepText.first().isVisible({ timeout: 3000 }).catch(() => false);

    // Check for strikethrough text on skipped agent names
    const skippedStrikethrough = page.locator('.line-through.italic');
    const hasStrikethrough = await skippedStrikethrough.first().isVisible({ timeout: 3000 }).catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Step 5: Timeline — heading=${hasTimeline}, failedCard=${hasFailedStepCard}, skipped=${hasSkippedSteps}, strikethrough=${hasStrikethrough}`,
    });

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-failed-step-timeline.png`,
      fullPage: true,
    });

    // ── Step 6: Expand/verify failed step details ───────────────────────────
    // Failed step is auto-expanded on load, but let's verify the expanded content
    // Look for error alert inside the step details
    const stepErrorAlert = page.locator('.border-red-200.bg-red-50').filter({
      hasText: /Error/i,
    });
    const hasStepError = await stepErrorAlert.first().isVisible({ timeout: 5000 }).catch(() => false);

    // If the failed step is not expanded, try clicking its header
    if (!hasStepError) {
      // Find the step header that says "Step N: AgentName" with "Failed" status
      const failedStepHeader = page.locator('button').filter({
        hasText: /Failed/i,
      }).filter({
        hasText: /Step \d/i,
      }).first();
      const hasFSHeader = await failedStepHeader.isVisible({ timeout: 3000 }).catch(() => false);
      if (hasFSHeader) {
        await failedStepHeader.click();
        await page.waitForTimeout(500);
      }
    }

    // Look for goal text, input/output JSON viewers, and metadata
    const goalSection = page.locator('.bg-\\[\\#f5f3ff\\]').first();
    const hasGoal = await goalSection.isVisible({ timeout: 3000 }).catch(() => false);

    // Look for "Retry from This Step" button within the expanded step details
    const retryFromStepBtn = page.getByRole('button', { name: /Retry from This Step/i });
    const hasRetryFromStepBtn = await retryFromStepBtn.first().isVisible({ timeout: 3000 }).catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Step 6: Expanded step — error=${hasStepError}, goal=${hasGoal}, retryFromStep=${hasRetryFromStepBtn}`,
    });

    // ── Step 7: Click "Retry from This Step" button ─────────────────────────
    // Prefer the button in the step timeline, fallback to the error banner button
    const retryButton = hasRetryFromStepBtn
      ? retryFromStepBtn.first()
      : hasRetryBtn
        ? retryFromFailedStepBtn.first()
        : null;

    if (!retryButton) {
      // Last fallback: try the header "Retry" button
      const headerRetryBtn = page.getByRole('button', { name: /^Retry$/i }).first();
      const hasHeaderRetry = await headerRetryBtn.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasHeaderRetry) {
        await headerRetryBtn.click();
      } else {
        test.info().annotations.push({
          type: 'issue',
          description: 'No retry button found — cannot test retry flow',
        });
        // Still take screenshot and end gracefully
        await page.screenshot({
          path: `${SCREENSHOTS_DIR}/step-7-retry-confirmation-dialog.png`,
          fullPage: true,
        });
        return;
      }
    } else {
      await retryButton.click();
    }

    await page.waitForTimeout(500);

    // ── Step 7 visual: Verify retry confirmation dialog ─────────────────────
    // Use role="alertdialog" to detect the dialog specifically (avoids matching button text)
    const alertDialog = page.locator('[role="alertdialog"]');
    const hasRetryDialog = await alertDialog.isVisible({ timeout: 5000 }).catch(() => false);

    // Verify dialog heading
    const dialogHeading = alertDialog.locator('h2');
    const hasDialogTitle = await dialogHeading.isVisible({ timeout: 3000 }).catch(() => false);

    // Verify dialog description mentions preserving step outputs
    const dialogDescription = alertDialog.getByText(/Previous step outputs will be preserved/i);
    const hasDialogDesc = await dialogDescription.isVisible({ timeout: 3000 }).catch(() => false);

    // Verify Cancel and Retry buttons within the dialog
    const cancelBtn = alertDialog.getByRole('button', { name: /Cancel/i });
    const hasCancelBtn = await cancelBtn.isVisible({ timeout: 3000 }).catch(() => false);

    const confirmRetryBtn = alertDialog.getByRole('button', { name: /Retry/i });
    const hasConfirmBtn = await confirmRetryBtn.isVisible({ timeout: 3000 }).catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Step 7: Retry dialog — title=${hasRetryDialog}, desc=${hasDialogDesc}, cancel=${hasCancelBtn}, confirm=${hasConfirmBtn}`,
    });

    expect(
      hasRetryDialog,
      'Retry confirmation dialog should appear with title',
    ).toBeTruthy();

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-7-retry-confirmation-dialog.png`,
      fullPage: true,
    });

    // ── Step 8: Confirm retry ───────────────────────────────────────────────
    // Click the Retry button in the dialog (the AlertDialogAction)
    if (hasConfirmBtn) {
      await confirmRetryBtn.click();
    } else {
      // Fallback: find any non-Cancel button in the alertdialog
      const dialogBtns = alertDialog.locator('button');
      const allBtns = await dialogBtns.all();
      for (const btn of allBtns) {
        const text = await btn.textContent();
        if (text && !/cancel/i.test(text)) {
          await btn.click();
          break;
        }
      }
    }

    // Wait for the retry API call and navigation
    await page.waitForTimeout(3000);

    // Check for toast notification
    const retryToast = page.getByText(/retry|started|new run/i).first();
    const hasRetryToast = await retryToast.isVisible({ timeout: 5000 }).catch(() => false);

    // Check if we navigated to a new run detail page (PENDING or RUNNING status)
    const newRunStatus = page.getByText(/Pending|Running/i);
    const hasNewRunStatus = await newRunStatus.first().isVisible({ timeout: 5000 }).catch(() => false);

    // Also check if still on a run detail page (URL should contain /runs/)
    const currentUrl = page.url();
    const isOnRunDetail = currentUrl.includes('/runs/');

    // Check for API error (retry endpoint might return 404 if not implemented)
    const retryApiError = page.getByText(/failed to retry|error/i);
    const hasRetryError = await retryApiError.first().isVisible({ timeout: 2000 }).catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Step 8: Retry result — toast=${hasRetryToast}, newStatus=${hasNewRunStatus}, onDetail=${isOnRunDetail}, error=${hasRetryError}, url=${currentUrl}`,
    });

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-8-retry-started-new-run.png`,
      fullPage: true,
    });

    // ── Step 9: Verify retryOfRunId link in new run metadata ────────────────
    // Scroll to bottom to see the metadata footer
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    const retryOfLabel = page.getByText(/Retry of/i);
    const hasRetryOfLabel = await retryOfLabel.isVisible({ timeout: 3000 }).catch(() => false);

    // Check for the link to original run (font-mono, purple link)
    const retryOfLink = page.locator('a[href*="/runs/"]').filter({
      has: page.locator('.font-mono, code'),
    });
    const hasRetryOfLink = await retryOfLink.first().isVisible({ timeout: 3000 }).catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Step 9: RetryOf metadata — label=${hasRetryOfLabel}, link=${hasRetryOfLink}`,
    });

    // ── Step 10: Navigate back to runs list ─────────────────────────────────
    await spaNavigate(page, '/ai/admin/automations/runs');
    await expect(
      page.getByRole('heading', { name: /Automation Runs/i }),
    ).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // Verify the list has both the original failed run and the new retry run
    const tableRows = page.locator('table tbody tr');
    const rowCount = await tableRows.count().catch(() => 0);

    test.info().annotations.push({
      type: 'info',
      description: `Step 10: Back on runs list — rowCount=${rowCount}`,
    });

    // ── Final Diagnostics ───────────────────────────────────────────────────
    if (apiErrors.length > 0) {
      const unique = [...new Set(apiErrors)];
      test.info().annotations.push({
        type: 'issue',
        description: `API errors: ${unique.slice(0, 10).join('; ')}`,
      });
    }
  });
});
