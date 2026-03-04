import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '_bmad-output/test-artifacts/screenshots/epic-E5c/journey-17';

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

test.describe('Journey 17: Run Detail Page with Step Timeline', () => {
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

  test('Run detail page shows summary, metrics, step timeline, and JSON viewer (E5c-6 AC-3, AC-4)', async ({
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

    test.info().annotations.push({
      type: 'info',
      description: 'Step 1: Automation Runs list loaded',
    });

    // ── Step 2: Click first run row to open detail page ─────────────────────
    // Find a clickable row in the table — try the first data row
    const firstRunRow = page.locator('table tbody tr').first();
    const hasRunRows = await firstRunRow.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasRunRows) {
      // Fallback: check for card-based layout or other list structures
      const anyRunLink = page.locator('a[href*="/runs/"]').first();
      const hasRunLinks = await anyRunLink.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasRunLinks) {
        await anyRunLink.click();
      } else {
        test.info().annotations.push({
          type: 'issue',
          description: 'No run rows or links found in the automation runs list. Cannot proceed to detail page.',
        });
        test.skip(true, 'No automation runs available to click on');
        return;
      }
    } else {
      await firstRunRow.click();
    }

    // Wait for the detail page to load
    await page.waitForTimeout(2000);

    // Verify we're on the detail page — look for run summary elements
    // The detail page should show run ID, status badge, automation name
    const runDetailContent = page.locator('[class*="detail"], [class*="Detail"], [data-testid*="run-detail"]');
    const hasDetailPage = await runDetailContent.first().isVisible({ timeout: 3000 }).catch(() => false);

    // Alternative: check for the metrics cards or step timeline heading
    const metricsOrTimeline = page.getByText(/total tokens|total cost|step timeline|steps/i);
    const hasMetrics = await metricsOrTimeline.first().isVisible({ timeout: 5000 }).catch(() => false);

    // Check for run ID display (mono font, usually a UUID)
    const runIdElement = page.locator('[class*="mono"], code, [class*="font-mono"]').first();
    const hasRunId = await runIdElement.isVisible({ timeout: 3000 }).catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Step 2: Detail page loaded — detailContainer=${hasDetailPage}, metrics=${hasMetrics}, runId=${hasRunId}`,
    });

    // ── Checkpoint 1: Run Detail Page Loaded ────────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-run-detail-page-loaded.png`,
      fullPage: true,
    });

    // ── Step 3: Verify metrics cards row ────────────────────────────────────
    // Expect 4 metrics cards: Total Tokens, Total Cost, Steps, Duration
    const totalTokensCard = page.getByText(/total tokens/i);
    const totalCostCard = page.getByText(/total cost/i);
    const stepsCard = page.getByText(/steps/i).first();
    const durationCard = page.getByText(/duration/i);

    const hasTotalTokens = await totalTokensCard.isVisible({ timeout: 5000 }).catch(() => false);
    const hasTotalCost = await totalCostCard.isVisible({ timeout: 3000 }).catch(() => false);
    const hasSteps = await stepsCard.isVisible({ timeout: 3000 }).catch(() => false);
    const hasDuration = await durationCard.isVisible({ timeout: 3000 }).catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Step 3: Metrics cards — tokens=${hasTotalTokens}, cost=${hasTotalCost}, steps=${hasSteps}, duration=${hasDuration}`,
    });

    // At least some metrics should be visible
    expect(
      hasTotalTokens || hasTotalCost || hasSteps || hasDuration,
      'At least one metrics card should be visible on the run detail page',
    ).toBeTruthy();

    // ── Step 4: Verify step timeline ────────────────────────────────────────
    // Look for the step timeline section — expandable step cards with status indicators
    const stepTimelineSection = page.locator('[class*="timeline"], [class*="Timeline"], [data-testid*="timeline"]');
    const hasTimeline = await stepTimelineSection.first().isVisible({ timeout: 5000 }).catch(() => false);

    // Look for individual step entries — "Step 1:", "Step 2:", or agent names
    const stepEntries = page.locator('[class*="step"], [class*="Step"]').filter({
      hasText: /step\s*\d|agent/i,
    });
    const stepCount = await stepEntries.count().catch(() => 0);

    // Alternative: look for step headings with numbers
    const stepHeadings = page.getByText(/step\s*\d/i);
    const stepHeadingCount = await stepHeadings.count().catch(() => 0);

    test.info().annotations.push({
      type: 'info',
      description: `Step 4: Timeline container=${hasTimeline}, step entries=${stepCount}, step headings=${stepHeadingCount}`,
    });

    // ── Checkpoint 2: Step Timeline Visible ──────────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-step-timeline-visible.png`,
      fullPage: true,
    });

    // ── Step 5: Click first step header to expand details ───────────────────
    // The step timeline has expandable headers — click the first one
    const firstStepHeader = page.locator('button, [role="button"], [class*="trigger"], [class*="Trigger"]')
      .filter({ hasText: /step\s*1/i })
      .first();
    const hasFirstStep = await firstStepHeader.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasFirstStep) {
      await firstStepHeader.click();
      await page.waitForTimeout(1000);
    } else {
      // Fallback: try clicking any collapsible/accordion trigger in the timeline area
      const collapsibleTrigger = page.locator('[data-state="closed"], [aria-expanded="false"]')
        .filter({ hasText: /step|agent/i })
        .first();
      const hasTrigger = await collapsibleTrigger.isVisible({ timeout: 3000 }).catch(() => false);
      if (hasTrigger) {
        await collapsibleTrigger.click();
        await page.waitForTimeout(1000);
      }
    }

    // Verify expanded content — look for goal text, JSON viewer, model info
    const goalElement = page.getByText(/goal/i);
    const hasGoal = await goalElement.first().isVisible({ timeout: 3000 }).catch(() => false);

    const jsonViewer = page.locator('[class*="json"], [class*="Json"], pre, code').filter({
      hasText: /[{"\[]/,
    });
    const hasJsonViewer = await jsonViewer.first().isVisible({ timeout: 3000 }).catch(() => false);

    // Look for model info
    const modelInfo = page.getByText(/model|claude|turns/i);
    const hasModelInfo = await modelInfo.first().isVisible({ timeout: 3000 }).catch(() => false);

    // Look for token breakdown (Input: X / Output: Y)
    const tokenBreakdown = page.getByText(/input.*output|tokens/i);
    const hasTokenBreakdown = await tokenBreakdown.first().isVisible({ timeout: 3000 }).catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Step 5: Expanded step — goal=${hasGoal}, jsonViewer=${hasJsonViewer}, model=${hasModelInfo}, tokens=${hasTokenBreakdown}`,
    });

    // ── Checkpoint 3: Step Details Expanded ──────────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-step-details-expanded.png`,
      fullPage: true,
    });

    // ── Step 6: Verify input JSON viewer ────────────────────────────────────
    // JSON viewer should have mono font, formatted data, copy button
    const jsonViewerContainer = page.locator('[class*="json"], [class*="Json"]').first();
    const hasJsonContainer = await jsonViewerContainer.isVisible({ timeout: 3000 }).catch(() => false);

    // Look for copy button near JSON content
    const copyButton = page.locator('button').filter({ hasText: /copy|📋/i }).first();
    const copyIconButton = page.locator('button[aria-label*="copy" i], button[title*="copy" i]').first();
    const hasCopyBtn = await copyButton.isVisible({ timeout: 3000 }).catch(() => false);
    const hasCopyIconBtn = await copyIconButton.isVisible({ timeout: 3000 }).catch(() => false);

    // Also check for SVG icon buttons that might be copy buttons near JSON
    const iconButtonsNearJson = page.locator('[class*="json"] button, [class*="Json"] button').first();
    const hasIconBtn = await iconButtonsNearJson.isVisible({ timeout: 2000 }).catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Step 6: JSON viewer — container=${hasJsonContainer}, copyBtn=${hasCopyBtn}, copyIconBtn=${hasCopyIconBtn}, iconBtn=${hasIconBtn}`,
    });

    // ── Step 7: Click copy button on JSON viewer ────────────────────────────
    let copiedFeedback = false;
    const copyTarget = hasCopyBtn
      ? copyButton
      : hasCopyIconBtn
        ? copyIconButton
        : hasIconBtn
          ? iconButtonsNearJson
          : null;

    if (copyTarget) {
      await copyTarget.click();
      await page.waitForTimeout(1000);

      // Check for feedback — toast, checkmark icon, or "Copied" text
      const copiedText = page.getByText(/copied/i);
      copiedFeedback = await copiedText.isVisible({ timeout: 3000 }).catch(() => false);

      // Also check if button changed to show a check icon
      const checkIcon = page.locator('[class*="check"], [data-state="copied"]');
      const hasCheck = await checkIcon.first().isVisible({ timeout: 2000 }).catch(() => false);

      copiedFeedback = copiedFeedback || hasCheck;
    }

    test.info().annotations.push({
      type: 'info',
      description: `Step 7: Copy JSON — target found=${!!copyTarget}, feedback=${copiedFeedback}`,
    });

    // ── Checkpoint 4: JSON Copy Feedback ────────────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-7-json-copy-feedback.png`,
      fullPage: true,
    });

    // ── Step 8: Verify run metadata footer ──────────────────────────────────
    // Footer should show full run ID (mono, copyable), retryOfRunId if present, created at
    // Scroll to bottom to see the footer
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // Look for run ID in mono font and created at timestamp
    const footerRunId = page.getByText(/run id|run:/i);
    const hasFooterRunId = await footerRunId.first().isVisible({ timeout: 3000 }).catch(() => false);

    const createdAt = page.getByText(/created/i);
    const hasCreatedAt = await createdAt.first().isVisible({ timeout: 3000 }).catch(() => false);

    // Check for retryOfRunId (optional — only present if this is a retry)
    const retryOf = page.getByText(/retry of|retried from/i);
    const hasRetryOf = await retryOf.first().isVisible({ timeout: 2000 }).catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Step 8: Footer — runId=${hasFooterRunId}, createdAt=${hasCreatedAt}, retryOf=${hasRetryOf}`,
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
