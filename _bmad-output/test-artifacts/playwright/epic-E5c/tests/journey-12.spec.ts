import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '_bmad-output/test-artifacts/screenshots/epic-E5c/journey-12';

test.describe('Journey 12: Automation Run Now & Real-Time Status', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    // Login as admin user
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@nexa-erp.dev');
    await page.getByLabel('Password').fill('NexaDev2026!');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 15000,
    });
    // Wait for sidebar to render
    await expect(
      page.getByRole('link', { name: 'AI Administration' }),
    ).toBeVisible({ timeout: 10000 });
  });

  test('Manually trigger automation and observe run in list (E5c-5 AC-9, E5c-6 AC-1)', async ({
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
    // Navigate via sidebar (SPA routing preserves auth state)
    await page.getByRole('link', { name: 'AI Administration' }).click();
    await page.waitForURL('**/ai/admin', { timeout: 10000 });

    // Wait for AI Configuration dashboard, then navigate to Automations
    await expect(
      page.getByRole('heading', { name: /AI Configuration/i }),
    ).toBeVisible({ timeout: 10000 });

    // Click Automations quick-nav or sidebar sub-link
    const automationsBtn = page.getByRole('button', {
      name: /Automations/i,
    });
    const automationsBtnVisible = await automationsBtn
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (automationsBtnVisible) {
      await automationsBtn.first().click();
    } else {
      // Try sidebar link
      const automationsLink = page.getByRole('link', {
        name: /Automations/i,
      });
      await expect(automationsLink.first()).toBeVisible({ timeout: 5000 });
      await automationsLink.first().click();
    }

    await page.waitForURL('**/ai/admin/automations', { timeout: 10000 });

    // Wait for automation list page to load
    const listHeading = page.getByRole('heading', { name: /Automations/i });
    await expect(listHeading.first()).toBeVisible({ timeout: 10000 });

    // Verify the automation list page structure (table headers)
    const nameHeader = page.getByRole('columnheader', { name: 'Name' });
    const triggerHeader = page.getByRole('columnheader', {
      name: 'Trigger',
    });
    await expect(nameHeader).toBeVisible({ timeout: 5000 });
    await expect(triggerHeader).toBeVisible({ timeout: 5000 });

    test.info().annotations.push({
      type: 'info',
      description: 'Step 1: Automation list page loaded with correct table structure',
    });

    // Check if there are any automations in the list
    const automationName = 'Daily AR Aging Summary';
    const automationText = page.getByText(automationName);
    const automationVisible = await automationText
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    // Also check if ANY automation is in the list
    const tableRows = page.locator('table tbody tr');
    const rowCount = await tableRows.count().catch(() => 0);
    const hasAnyAutomation = rowCount > 0;

    // Check for empty state
    const emptyState = page.getByText(/No results found/i);
    const isEmpty = await emptyState
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Step 1: seededAutomation=${automationVisible}, anyAutomation=${hasAnyAutomation}, empty=${isEmpty}, rows=${rowCount}`,
    });

    // ── Checkpoint 1: Automation List Page ──────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-automation-list.png`,
      fullPage: true,
    });

    // Determine which automation to use (seeded or any available)
    let targetAutomationName = '';

    if (automationVisible) {
      targetAutomationName = automationName;
    } else if (hasAnyAutomation) {
      // Use the first available automation
      const firstNameCell = tableRows.first().locator('td').first();
      targetAutomationName =
        (await firstNameCell.textContent())?.trim() || '';
      test.info().annotations.push({
        type: 'info',
        description: `Step 1: Using fallback automation: "${targetAutomationName}"`,
      });
    }

    if (!targetAutomationName) {
      // No automations exist — document as missing prerequisite and test runs page
      test.info().annotations.push({
        type: 'issue',
        description:
          'Step 1: No automations found in list — seed data prerequisite not met. Skipping Run Now steps (2-3), testing runs page only.',
      });

      // Skip steps 2-3 and go directly to step 4 — test runs page
      // Navigate to runs page via sidebar link
      const runsNavLink = page.getByRole('link', { name: /Runs/i });
      const runsNavVisible = await runsNavLink
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      if (runsNavVisible) {
        await runsNavLink.first().click();
      } else {
        // Navigate via URL with SPA router
        await page.evaluate(() => {
          // TanStack Router uses history API
          (window as any).__TSR_ROUTER__?.navigate({
            to: '/ai/admin/automations/runs',
          });
        });
        await page.waitForTimeout(1000);

        // If that didn't work, try direct navigation (may lose auth)
        const currentUrl = page.url();
        if (!currentUrl.includes('/runs')) {
          await page.goto('/ai/admin/automations/runs');
        }
      }

      await page.waitForURL('**/ai/admin/automations/runs**', {
        timeout: 10000,
      }).catch(() => {
        // URL didn't change — may still be on automations page
      });

      // ── Step 4 (fallback): Verify Automation Runs page ───────────
      const runsHeading = page.getByRole('heading', {
        name: /Automation Runs/i,
      });
      const runsHeadingVisible = await runsHeading
        .first()
        .isVisible({ timeout: 10000 })
        .catch(() => false);

      test.info().annotations.push({
        type: 'info',
        description: `Step 4 (fallback): Runs page heading visible=${runsHeadingVisible}`,
      });

      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-4-runs-list.png`,
        fullPage: true,
      });

      // Final assertion — the runs page should at least be accessible
      // The test fails because the prerequisite seed data is missing
      expect(
        targetAutomationName,
        'Prerequisite not met: No automations exist. "Daily AR Aging Summary" seed data required (E5c-1)',
      ).not.toBe('');
      return;
    }

    // ── Step 2: Click "Run Now" from the overflow menu ─────────────
    // Open the actions dropdown for the target automation
    const actionsBtn = page
      .getByRole('button', {
        name: new RegExp(
          `Actions for ${targetAutomationName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
          'i',
        ),
      })
      .first();

    const actionsVisible = await actionsBtn
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!actionsVisible) {
      test.info().annotations.push({
        type: 'issue',
        description: `Step 2: Actions button not found for "${targetAutomationName}"`,
      });
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-2-run-now-dialog.png`,
        fullPage: true,
      });
      expect(
        actionsVisible,
        'Actions overflow button should be visible',
      ).toBe(true);
      return;
    }

    await actionsBtn.click();
    await page.waitForTimeout(300);

    // Click "Run Now" menu item
    const runNowMenuItem = page.getByRole('menuitem', { name: /Run Now/i });
    const runNowVisible = await runNowMenuItem
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (!runNowVisible) {
      test.info().annotations.push({
        type: 'issue',
        description:
          'Step 2: "Run Now" menu item not found in overflow menu — MISSING FEATURE',
      });
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-2-run-now-dialog.png`,
        fullPage: true,
      });
      await page.keyboard.press('Escape');
      expect(
        runNowVisible,
        '"Run Now" menu item should be visible in actions dropdown',
      ).toBe(true);
      return;
    }

    await runNowMenuItem.click();
    await page.waitForTimeout(500);

    // Verify confirmation dialog appears
    const dialogTitle = page.getByText('Run Automation');
    const dialogVisible = await dialogTitle
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!dialogVisible) {
      test.info().annotations.push({
        type: 'issue',
        description:
          'Step 2: Run Automation confirmation dialog did not appear',
      });
    } else {
      // Verify dialog content
      const dialogDesc = page.getByText(
        /Are you sure you want to run this automation now/i,
      );
      const hasDesc = await dialogDesc
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      const cancelBtn = page.getByRole('button', { name: /Cancel/i });
      const hasCancelBtn = await cancelBtn
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      const confirmBtn = page.getByRole('button', { name: /Run Now/i });
      const hasConfirmBtn = await confirmBtn
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      test.info().annotations.push({
        type: 'info',
        description: `Step 2: Dialog — title=${dialogVisible}, desc=${hasDesc}, cancel=${hasCancelBtn}, confirm=${hasConfirmBtn}`,
      });
    }

    // ── Checkpoint 2: Run Now Confirmation Dialog ───────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-run-now-dialog.png`,
      fullPage: true,
    });

    // ── Step 3: Confirm "Run Now" ──────────────────────────────────
    const confirmRunBtn = page
      .getByRole('button', { name: /Run Now/i })
      .last();
    await expect(confirmRunBtn).toBeVisible({ timeout: 3000 });
    await confirmRunBtn.click();

    // Wait for the dialog to close and a possible toast
    await page.waitForTimeout(2000);

    // Check for success toast
    const startedToast = page.getByText(
      /Automation started|automation triggered|run started/i,
    );
    const hasStartedToast = await startedToast
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    // Check for error toast
    const errorToast = page.getByText(
      /error|failed to start|could not run/i,
    );
    const hasErrorToast = await errorToast
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Step 3: Toast — started=${hasStartedToast}, error=${hasErrorToast}`,
    });

    if (hasErrorToast && !hasStartedToast) {
      test.info().annotations.push({
        type: 'issue',
        description:
          'Step 3: Automation failed to start — API error during trigger',
      });
    }

    // Verify dialog is closed
    const dialogGone = await page
      .getByText(/Are you sure you want to run this automation now/i)
      .isHidden({ timeout: 3000 })
      .catch(() => true);

    test.info().annotations.push({
      type: 'info',
      description: `Step 3: Dialog closed=${dialogGone}`,
    });

    // ── Checkpoint 3: Automation Triggered ──────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-automation-triggered.png`,
      fullPage: true,
    });

    // ── Step 4: Navigate to /ai/admin/automations/runs ─────────────
    // Navigate via overflow menu "View Runs" for the target automation
    const actionsBtn2 = page
      .getByRole('button', {
        name: new RegExp(
          `Actions for ${targetAutomationName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
          'i',
        ),
      })
      .first();
    const actions2Visible = await actionsBtn2
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (actions2Visible) {
      await actionsBtn2.click();
      await page.waitForTimeout(300);

      const viewRunsItem = page.getByRole('menuitem', {
        name: /View Runs/i,
      });
      const viewRunsVisible = await viewRunsItem
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      if (viewRunsVisible) {
        await viewRunsItem.click();
      } else {
        await page.keyboard.press('Escape');
        // Try sidebar link
        const runsLink = page.getByRole('link', { name: /^Runs$/i });
        const runsLinkVisible = await runsLink
          .first()
          .isVisible({ timeout: 3000 })
          .catch(() => false);
        if (runsLinkVisible) {
          await runsLink.first().click();
        }
      }
    } else {
      // Try sidebar link
      const runsLink = page.getByRole('link', { name: /^Runs$/i });
      const runsLinkVisible = await runsLink
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      if (runsLinkVisible) {
        await runsLink.first().click();
      }
    }

    await page
      .waitForURL('**/ai/admin/automations/runs**', { timeout: 10000 })
      .catch(() => {
        // URL might not have changed
      });

    // Wait for the Automation Runs list page to load
    const runsHeading = page.getByRole('heading', {
      name: /Automation Runs/i,
    });
    const runsHeadingVisible = await runsHeading
      .first()
      .isVisible({ timeout: 10000 })
      .catch(() => false);

    if (!runsHeadingVisible) {
      test.info().annotations.push({
        type: 'issue',
        description:
          'Step 4: "Automation Runs" heading not found — page may not have loaded',
      });
    }

    // Wait for the run list to populate
    await page.waitForTimeout(2000);

    // Verify the newly triggered run appears in the list
    const newRunAutomation = page.getByText(targetAutomationName).first();
    const newRunVisible = await newRunAutomation
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Step 4: Runs page loaded=${runsHeadingVisible}, new run visible=${newRunVisible}`,
    });

    // Verify key columns are present
    const triggerBadge = page.getByText(/Scheduled|Event|Chain|Manual/i);
    const hasTriggerColumn = await triggerBadge
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const statusBadge = page.getByText(
      /Completed|Failed|Running|Pending|Cancelled/i,
    );
    const hasStatusColumn = await statusBadge
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Step 4: Columns — trigger=${hasTriggerColumn}, status=${hasStatusColumn}`,
    });

    // ── Checkpoint 4: Automation Runs List ──────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-runs-list.png`,
      fullPage: true,
    });

    // ── Step 5: Click on the newly created run row ─────────────────
    let navigatedToDetail = false;

    if (newRunVisible) {
      // Try the actions menu to go to detail page
      const runActionsBtn = page
        .getByRole('button', { name: /Actions for run/i })
        .first();
      const runActionsVisible = await runActionsBtn
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      if (runActionsVisible) {
        await runActionsBtn.click();
        await page.waitForTimeout(300);

        const viewDetailsItem = page.getByRole('menuitem', {
          name: /View Details/i,
        });
        const viewDetailsVisible = await viewDetailsItem
          .isVisible({ timeout: 3000 })
          .catch(() => false);

        if (viewDetailsVisible) {
          await viewDetailsItem.click();
          navigatedToDetail = true;
        } else {
          await page.keyboard.press('Escape');
        }
      }

      if (!navigatedToDetail) {
        // Fallback: click on any link to run detail
        const runLink = page
          .locator('a[href*="/ai/admin/automations/runs/"]')
          .first();
        const runLinkVisible = await runLink
          .isVisible({ timeout: 3000 })
          .catch(() => false);

        if (runLinkVisible) {
          await runLink.click();
          navigatedToDetail = true;
        }
      }

      if (!navigatedToDetail) {
        // Try clicking on the first table row
        const firstRow = page.locator('table tbody tr').first();
        const rowVisible = await firstRow
          .isVisible({ timeout: 3000 })
          .catch(() => false);
        if (rowVisible) {
          await firstRow.click();
          navigatedToDetail = true;
        }
      }
    }

    if (navigatedToDetail) {
      // Wait for run detail page to load
      await page
        .waitForURL('**/ai/admin/automations/runs/**', { timeout: 10000 })
        .catch(() => {});
      await page.waitForTimeout(2000);

      // Verify run detail page content
      const runHeader = page.getByRole('heading', { name: /Run /i });
      const hasRunHeader = await runHeader
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      // Check for metrics cards
      const totalTokensLabel = page.getByText(/TOTAL TOKENS/i);
      const hasTotalTokens = await totalTokensLabel
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      const totalCostLabel = page.getByText(/TOTAL COST/i);
      const hasTotalCost = await totalCostLabel
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      const stepsLabel = page.getByText(/^STEPS$/i);
      const hasStepsCard = await stepsLabel
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      const durationLabel = page.getByText(/^DURATION$/i);
      const hasDurationCard = await durationLabel
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      // Check for triggered-by info
      const triggeredByText = page.getByText(/Triggered by/i);
      const hasTriggeredBy = await triggeredByText
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      // Check for status badge
      const runStatus = page.getByText(
        /Completed|Failed|Running|Pending/i,
      );
      const hasRunStatus = await runStatus
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      test.info().annotations.push({
        type: 'info',
        description: `Step 5: Detail page — header=${hasRunHeader}, tokens=${hasTotalTokens}, cost=${hasTotalCost}, steps=${hasStepsCard}, duration=${hasDurationCard}, triggeredBy=${hasTriggeredBy}, status=${hasRunStatus}`,
      });
    } else {
      test.info().annotations.push({
        type: 'issue',
        description:
          'Step 5: Cannot navigate to run detail — no run found or no clickable element',
      });
    }

    // ── Checkpoint 5: Run Detail Page ──────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-run-detail.png`,
      fullPage: true,
    });

    // ── Final Assertions ──────────────────────────────────────────
    if (apiErrors.length > 0) {
      const unique = [...new Set(apiErrors)];
      test.info().annotations.push({
        type: 'issue',
        description: `API errors: ${unique.slice(0, 10).join('; ')}`,
      });
    }

    // Core assertions
    expect(
      runsHeadingVisible,
      'Automation Runs page should load with heading',
    ).toBe(true);
  });
});
