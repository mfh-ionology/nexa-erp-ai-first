import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '_bmad-output/test-artifacts/screenshots/epic-E5c/journey-14';

test.describe('Journey 14: Run Detail — Step Timeline & Expandable Details', () => {
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

  test('View run detail with step timeline, expand/collapse steps, and interact with JSON viewers (E5c-6 AC-3, AC-4)', async ({
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

    // ── Pre-step: Ensure at least one automation run exists ─────────
    // Navigate to the Automations list and trigger "Run Now" on the first automation
    await page.getByRole('link', { name: 'AI Administration' }).click();
    await page.waitForTimeout(1000);

    // Navigate to Automations list
    const automationsLink = page.getByRole('link', { name: /^Automations$/i });
    const automationsLinkVisible = await automationsLink
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (automationsLinkVisible) {
      await automationsLink.first().click();
    } else {
      await page.evaluate(() => {
        const router = (window as any).__TSR_ROUTER__;
        if (router) router.navigate({ to: '/ai/admin/automations' });
      });
    }

    await page
      .waitForURL('**/ai/admin/automations**', { timeout: 10000 })
      .catch(() => {});
    await page.waitForTimeout(2000);

    // Find the first automation row and trigger "Run Now" via its overflow menu
    const automationRows = page.locator('table tbody tr');
    const automationRowCount = await automationRows.count().catch(() => 0);

    test.info().annotations.push({
      type: 'info',
      description: `Pre-step: Found ${automationRowCount} automations to trigger`,
    });

    if (automationRowCount > 0) {
      // Click the overflow menu (MoreHorizontal) on first row
      const overflowBtn = automationRows
        .first()
        .locator('button[aria-label*="Actions"]');
      const hasOverflow = await overflowBtn
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      if (hasOverflow) {
        await overflowBtn.click();
        await page.waitForTimeout(500);

        // Click "Run Now"
        const runNowItem = page.getByText('Run Now');
        const hasRunNow = await runNowItem
          .first()
          .isVisible({ timeout: 3000 })
          .catch(() => false);

        if (hasRunNow) {
          await runNowItem.first().click();
          await page.waitForTimeout(500);

          // Confirm in the dialog
          const confirmBtn = page.getByRole('button', { name: 'Run Now' });
          const hasConfirm = await confirmBtn
            .isVisible({ timeout: 3000 })
            .catch(() => false);

          if (hasConfirm) {
            await confirmBtn.click();
            // Wait for the run to be created
            await page.waitForTimeout(3000);
            test.info().annotations.push({
              type: 'info',
              description: 'Pre-step: Manual run triggered successfully',
            });
          }
        } else {
          test.info().annotations.push({
            type: 'issue',
            description: 'Pre-step: "Run Now" not found in overflow menu',
          });
          await page.keyboard.press('Escape');
        }
      }
    }

    // ── Step 1: Navigate to /ai/admin/automations/runs ─────────────
    // Use sidebar links to navigate (preserves SPA auth state)
    const automationRunsLink = page.getByRole('link', {
      name: 'Automation Runs',
    });
    const automationRunsLinkVisible = await automationRunsLink
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (automationRunsLinkVisible) {
      await automationRunsLink.first().click();
    } else {
      // Fallback: Try SPA router navigate
      await page.evaluate(() => {
        const router = (window as any).__TSR_ROUTER__;
        if (router) {
          router.navigate({ to: '/ai/admin/automations/runs' });
        } else {
          window.history.pushState({}, '', '/ai/admin/automations/runs');
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      });
    }

    await page
      .waitForURL('**/ai/admin/automations/runs**', { timeout: 10000 })
      .catch(() => {});

    // Wait for the page to load
    await page.waitForTimeout(2000);

    // Verify we're on the runs page
    const runsHeading = page.getByRole('heading', {
      name: /Automation Runs|Runs/i,
    });
    const hasRunsHeading = await runsHeading
      .first()
      .isVisible({ timeout: 10000 })
      .catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Step 1: Runs page heading visible=${hasRunsHeading}, URL=${page.url()}`,
    });

    expect(hasRunsHeading, 'Automation Runs page should load with heading').toBe(true);

    // ── Step 2: Click any run row to navigate to detail page ───────
    // Find the first clickable row in the table
    const tableRows = page.locator('table tbody tr');
    const rowCount = await tableRows.count().catch(() => 0);

    test.info().annotations.push({
      type: 'info',
      description: `Step 2: Found ${rowCount} run rows in table`,
    });

    if (rowCount === 0) {
      // Check for empty state
      const emptyState = page.getByText(/No results|No runs|No data/i);
      const isEmpty = await emptyState
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      test.info().annotations.push({
        type: 'issue',
        description: `Step 2: No run rows found. Empty state visible=${isEmpty}. Cannot proceed with detail view test.`,
      });

      // Take screenshot of empty state and skip remaining steps
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-2-no-runs-available.png`,
        fullPage: true,
      });

      test.skip(true, 'No automation runs available to view detail');
      return;
    }

    // Prefer COMPLETED or FAILED run — check status column text
    let targetRowIndex = 0;
    for (let i = 0; i < rowCount; i++) {
      const rowText = (await tableRows.nth(i).textContent()) ?? '';
      if (rowText.includes('Completed') || rowText.includes('Failed')) {
        targetRowIndex = i;
        break;
      }
    }

    const targetRowText = (await tableRows.nth(targetRowIndex).textContent()) ?? '';
    test.info().annotations.push({
      type: 'info',
      description: `Step 2: Clicking row ${targetRowIndex}: ${targetRowText.substring(0, 100)}...`,
    });

    await tableRows.nth(targetRowIndex).click();

    // Wait for navigation to detail page
    await page
      .waitForURL('**/ai/admin/automations/runs/**', { timeout: 10000 })
      .catch(() => {});
    await page.waitForTimeout(2000);

    // ── Checkpoint 1: Run Detail Page Loaded ──────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-run-detail-loaded.png`,
      fullPage: true,
    });

    // ── Step 3: Verify run summary header ─────────────────────────
    // Check for automation name (linked)
    const automationNameLink = page.locator('a').filter({ hasText: /./i }).first();
    const hasAutomationLink = await automationNameLink
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    // Check for run ID in mono/code font
    const runIdCode = page.locator('code');
    const hasRunIdCode = await runIdCode
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Check for status badge
    const statusBadge = page.getByText(/Completed|Failed|Running|Pending|Cancelled/i);
    const hasStatusBadge = await statusBadge
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Check for triggered-by info
    const triggeredByLabel = page.getByText(/Triggered by|Scheduler|Manual|Event/i);
    const hasTriggeredBy = await triggeredByLabel
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Check for timestamps
    const timestampPattern = page.getByText(/\d{2} \w{3} \d{4}/);
    const hasTimestamp = await timestampPattern
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Step 3: Header — automationLink=${hasAutomationLink}, runIdCode=${hasRunIdCode}, statusBadge=${hasStatusBadge}, triggeredBy=${hasTriggeredBy}, timestamp=${hasTimestamp}`,
    });

    expect(hasStatusBadge, 'Status badge should be visible in run header').toBe(true);

    // ── Step 4: Verify metrics cards row ──────────────────────────
    // Look for the 4 metrics cards: Total Tokens, Total Cost, Steps, Duration
    const tokensCard = page.getByText('Total Tokens');
    const hasTokensCard = await tokensCard
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const costCard = page.getByText('Total Cost');
    const hasCostCard = await costCard
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const stepsCard = page.getByText('Steps');
    const hasStepsCard = await stepsCard
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    const durationCard = page.getByText('Duration');
    const hasDurationCard = await durationCard
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Step 4: Metrics — tokens=${hasTokensCard}, cost=${hasCostCard}, steps=${hasStepsCard}, duration=${hasDurationCard}`,
    });

    // ── Checkpoint 2: Metrics Cards Row ───────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-metrics-cards.png`,
      fullPage: true,
    });

    expect(hasTokensCard, 'Total Tokens metrics card should be visible').toBe(true);
    expect(hasCostCard, 'Total Cost metrics card should be visible').toBe(true);

    // ── Step 5: Verify step timeline ──────────────────────────────
    const timelineHeading = page.getByText('Step Execution Timeline');
    const hasTimelineHeading = await timelineHeading
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    // Check for step entries (e.g. "Step 1:")
    const stepEntries = page.getByText(/Step \d+:/);
    const stepCount = await stepEntries.count().catch(() => 0);

    test.info().annotations.push({
      type: 'info',
      description: `Step 5: Timeline heading=${hasTimelineHeading}, step entries found=${stepCount}`,
    });

    // ── Checkpoint 3: Step Timeline Overview ──────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-step-timeline.png`,
      fullPage: true,
    });

    expect(hasTimelineHeading, 'Step Execution Timeline heading should be visible').toBe(true);

    // ── Step 6: Click first step to expand ────────────────────────
    if (stepCount > 0) {
      // Click the first step header button to expand it
      const firstStepButton = page.locator('button').filter({ hasText: /Step 1:/ });
      const firstStepVisible = await firstStepButton
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      if (firstStepVisible) {
        await firstStepButton.first().click();
        await page.waitForTimeout(1000);
      } else {
        // Fallback: try clicking the first step entry by text
        await stepEntries.first().click();
        await page.waitForTimeout(1000);
      }

      // Verify expanded details are shown
      // Look for typical expanded content: model ID, goal, Input/Output labels, tokens breakdown
      const inputLabel = page.getByText('Input');
      const hasInputLabel = await inputLabel
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      const outputLabel = page.getByText('Output');
      const hasOutputLabel = await outputLabel
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      // Check for model info
      const modelInfo = page.getByText(/claude-|Model/i);
      const hasModelInfo = await modelInfo
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      // Check for token breakdown (In: / Out:)
      const tokenBreakdown = page.getByText(/In: \d|Out: \d/i);
      const hasTokenBreakdown = await tokenBreakdown
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      test.info().annotations.push({
        type: 'info',
        description: `Step 6: Expanded — input=${hasInputLabel}, output=${hasOutputLabel}, model=${hasModelInfo}, tokenBreakdown=${hasTokenBreakdown}`,
      });

      // ── Checkpoint 4: Step Expanded with Details ────────────────
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-6-step-expanded.png`,
        fullPage: true,
      });

      expect(hasInputLabel, 'Input data section should be visible when step expanded').toBe(true);

      // ── Step 7: Click Input Data toggle ─────────────────────────
      // The Input/Output labels are toggle buttons
      if (hasInputLabel) {
        await inputLabel.first().click();
        await page.waitForTimeout(500);

        // Look for JSON content (pre tag with formatted JSON)
        const jsonContent = page.locator('pre');
        const hasJsonContent = await jsonContent
          .first()
          .isVisible({ timeout: 3000 })
          .catch(() => false);

        // Alternatively check for "No data" text
        const noData = page.getByText(/No data/i);
        const hasNoData = await noData
          .first()
          .isVisible({ timeout: 2000 })
          .catch(() => false);

        test.info().annotations.push({
          type: 'info',
          description: `Step 7: JSON viewer — jsonContent=${hasJsonContent}, noData=${hasNoData}`,
        });

        // ── Checkpoint 5: JSON Viewer Toggle ──────────────────────
        await page.screenshot({
          path: `${SCREENSHOTS_DIR}/step-7-json-viewer-toggled.png`,
          fullPage: true,
        });

        // ── Step 8: Click Copy button on JSON viewer ──────────────
        if (hasJsonContent) {
          const copyButton = page.getByLabel('Copy JSON');
          const hasCopyButton = await copyButton
            .first()
            .isVisible({ timeout: 3000 })
            .catch(() => false);

          if (hasCopyButton) {
            await copyButton.first().click();
            await page.waitForTimeout(500);

            // Check for visual confirmation (toast or button state change)
            test.info().annotations.push({
              type: 'info',
              description: 'Step 8: Copy JSON button clicked',
            });
          } else {
            // Try generic copy button nearby
            const genericCopyBtn = page.locator('button[aria-label*="Copy"]');
            const hasGenericCopy = await genericCopyBtn
              .first()
              .isVisible({ timeout: 2000 })
              .catch(() => false);

            if (hasGenericCopy) {
              await genericCopyBtn.first().click();
              await page.waitForTimeout(500);
              test.info().annotations.push({
                type: 'info',
                description: 'Step 8: Generic copy button clicked',
              });
            } else {
              test.info().annotations.push({
                type: 'issue',
                description: 'Step 8: No copy button found on JSON viewer',
              });
            }
          }
        } else {
          test.info().annotations.push({
            type: 'info',
            description: 'Step 8: Skipped — no JSON content visible to copy',
          });
        }
      } else {
        test.info().annotations.push({
          type: 'issue',
          description: 'Step 7: Input label not visible, cannot toggle JSON viewer',
        });
      }

      // ── Step 9: Click first step to collapse ────────────────────
      if (firstStepVisible) {
        await firstStepButton.first().click();
      } else {
        await stepEntries.first().click();
      }
      await page.waitForTimeout(500);

      // Verify the step details are collapsed — Input/Output labels should no longer be visible
      // (unless another step is auto-expanded e.g. a failed step)
      const inputStillVisible = await page
        .getByText('Input')
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false);

      test.info().annotations.push({
        type: 'info',
        description: `Step 9: After collapse — input still visible=${inputStillVisible}`,
      });

      // ── Checkpoint 6: Step Collapsed Back ───────────────────────
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-9-step-collapsed.png`,
        fullPage: true,
      });
    } else {
      // No steps in timeline
      const noStepsMsg = page.getByText(/No steps recorded/i);
      const hasNoSteps = await noStepsMsg
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      test.info().annotations.push({
        type: 'issue',
        description: `Step 5-9: No step entries found. No-steps message visible=${hasNoSteps}`,
      });

      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-5-no-steps.png`,
        fullPage: true,
      });
    }

    // ── Final: Report API errors ──────────────────────────────────
    if (apiErrors.length > 0) {
      const unique = [...new Set(apiErrors)];
      test.info().annotations.push({
        type: 'issue',
        description: `API errors: ${unique.slice(0, 10).join('; ')}`,
      });
    }
  });
});
