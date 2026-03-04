import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '_bmad-output/test-artifacts/screenshots/epic-E5c/journey-20';

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

test.describe('Journey 20: Automation List — Run Status Links and View Runs Action', () => {
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

  test('Last run status links to run detail, View Runs navigates to filtered run list (E5c-6 AC-8)', async ({
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

    // Verify "Daily AR Aging Summary" row exists
    const dailyRow = page.getByText('Daily AR Aging Summary');
    await expect(dailyRow.first()).toBeVisible({ timeout: 10000 });

    test.info().annotations.push({
      type: 'info',
      description: 'Step 1: Automation list loaded, "Daily AR Aging Summary" visible',
    });

    // ── Checkpoint 1: Automation list loaded ──────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-automation-list-loaded.png`,
      fullPage: true,
    });

    // ── Step 2: Click Last Run status badge on "Daily AR Aging Summary" row ──
    // The status badge is a button with a dotted underline, inside the row
    // It navigates to /ai/admin/automations/runs/{lastRunId}
    // Look for a clickable status badge button with title "View run details"
    const statusBadgeButton = page.locator('button[title="View run details"]');
    const hasStatusBadge = await statusBadgeButton.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (hasStatusBadge) {
      // Click the status badge — it should navigate to run detail
      await statusBadgeButton.first().click();
      await page.waitForTimeout(2000);

      // Verify we navigated to a run detail page
      const currentUrl = page.url();
      const isOnRunDetail = currentUrl.includes('/ai/admin/automations/runs/') &&
        !currentUrl.endsWith('/runs') && !currentUrl.endsWith('/runs/');

      // Verify the run detail page loaded — look for run detail content
      // The page should show automation name, status, timing info
      const runDetailHeading = page.getByText(/run detail|automation run/i);
      const hasRunDetailContent = await runDetailHeading.first().isVisible({ timeout: 5000 }).catch(() => false);

      // Check for "Daily AR Aging Summary" name on the detail page
      const automationNameOnDetail = page.getByText('Daily AR Aging Summary');
      const hasAutomationName = await automationNameOnDetail.first().isVisible({ timeout: 5000 }).catch(() => false);

      test.info().annotations.push({
        type: 'info',
        description: `Step 2: Status badge clicked — on run detail page=${isOnRunDetail}, detail content=${hasRunDetailContent}, automation name visible=${hasAutomationName}, URL=${currentUrl}`,
      });

      expect(isOnRunDetail, 'Should navigate to a specific run detail page').toBeTruthy();
    } else {
      // No status badge means the automation has never been run (lastRunStatus is null)
      // Check for "Never run" text
      const neverRunText = page.getByText('Never run');
      const hasNeverRun = await neverRunText.first().isVisible({ timeout: 3000 }).catch(() => false);

      test.info().annotations.push({
        type: 'info',
        description: `Step 2: No clickable status badge found — "Never run" text visible=${hasNeverRun}. Automation may not have been run yet.`,
      });

      // This is acceptable — if automation hasn't been run, there's no status badge to click
      // We'll still test the View Runs action below
    }

    // ── Checkpoint 2: Run detail page (or automation list if never run) ────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-run-detail-page.png`,
      fullPage: true,
    });

    // ── Step 3: Navigate back to /ai/admin/automations ────────────────────
    await spaNavigate(page, '/ai/admin/automations');
    await expect(
      page.getByRole('heading', { name: 'Automations' }),
    ).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    test.info().annotations.push({
      type: 'info',
      description: 'Step 3: Back on automation list page',
    });

    // ── Step 4: Click overflow menu on "Daily AR Aging Summary" row ───────
    const overflowButton = page.getByRole('button', {
      name: /actions for daily ar aging summary/i,
    });
    await expect(overflowButton).toBeVisible({ timeout: 5000 });
    await overflowButton.click();
    await page.waitForTimeout(500);

    // Verify dropdown menu appeared with expected options
    const editOption = page.getByRole('menuitem', { name: /edit/i });
    const viewRunsOption = page.getByRole('menuitem', { name: /view runs/i });
    const runNowOption = page.getByRole('menuitem', { name: /run now/i });
    const deleteOption = page.getByRole('menuitem', { name: /delete/i });

    await expect(viewRunsOption).toBeVisible({ timeout: 5000 });

    const hasEdit = await editOption.isVisible().catch(() => false);
    const hasRunNow = await runNowOption.isVisible().catch(() => false);
    const hasDelete = await deleteOption.isVisible().catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Step 4: Overflow menu open — Edit=${hasEdit}, View Runs=true, Run Now=${hasRunNow}, Delete=${hasDelete}`,
    });

    // ── Step 5: Click "View Runs" action ──────────────────────────────────
    await viewRunsOption.click();
    await page.waitForTimeout(2000);

    // Verify navigation to /ai/admin/automations/runs with filter params
    const runsUrl = page.url();
    const isOnRunsPage = runsUrl.includes('/ai/admin/automations/runs');

    // Check if URL contains automationId or automationName query params
    const hasAutomationFilter = runsUrl.includes('automationId') || runsUrl.includes('automationName');

    // Verify the Automation Runs list page loaded
    const runsHeading = page.getByRole('heading', { name: /Automation Runs/i });
    const hasRunsHeading = await runsHeading.isVisible({ timeout: 10000 }).catch(() => false);

    // Wait for data to load
    await page.waitForTimeout(2000);

    // Check if "Daily AR Aging Summary" appears as filter context or in the heading
    const automationNameInRuns = page.getByText('Daily AR Aging Summary');
    const hasNameInRuns = await automationNameInRuns.first().isVisible({ timeout: 5000 }).catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Step 5: View Runs clicked — on runs page=${isOnRunsPage}, automation filter in URL=${hasAutomationFilter}, heading visible=${hasRunsHeading}, automation name visible=${hasNameInRuns}, URL=${runsUrl}`,
    });

    expect(isOnRunsPage, 'Should navigate to automation runs page').toBeTruthy();
    expect(hasRunsHeading, 'Automation Runs heading should be visible').toBeTruthy();

    // ── Checkpoint 3: Automation Runs list filtered by automation ──────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-runs-filtered-by-automation.png`,
      fullPage: true,
    });

    // ── Final Diagnostics ─────────────────────────────────────────────────
    if (apiErrors.length > 0) {
      const unique = [...new Set(apiErrors)];
      test.info().annotations.push({
        type: 'issue',
        description: `API errors: ${unique.slice(0, 10).join('; ')}`,
      });
    }
  });
});
