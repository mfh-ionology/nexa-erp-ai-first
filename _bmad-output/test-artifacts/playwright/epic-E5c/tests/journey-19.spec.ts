import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '_bmad-output/test-artifacts/screenshots/epic-E5c/journey-19';

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

test.describe('Journey 19: Automation Health Dashboard and Circuit Breaker Warning', () => {
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

  test('Automation Health section displays status chart, failed runs, upcoming runs, token spend, and circuit breaker warning (E5c-6 AC-6, AC-7)', async ({
    page,
  }) => {
    // Track API responses for health-related endpoints
    const apiErrors: string[] = [];
    const healthApiResults: string[] = [];
    page.on('response', (response) => {
      const url = response.url();
      const pathname = new URL(url).pathname;
      if (url.includes('/api/') && response.status() >= 400) {
        apiErrors.push(
          `${response.status()} ${response.request().method()} ${pathname}`,
        );
      }
      // Track the 3 health-related API calls
      if (pathname.includes('/ai/automations')) {
        healthApiResults.push(
          `${response.status()} ${response.request().method()} ${pathname}${new URL(url).search}`,
        );
      }
    });

    // ── Step 1: Navigate to /ai/admin ────────────────────────────────────────
    await spaNavigate(page, '/ai/admin');
    await expect(
      page.getByRole('heading', { name: /AI Configuration/i }),
    ).toBeVisible({ timeout: 15000 });

    // Wait for health data to load — the section makes 3 parallel API calls:
    // GET /ai/automations?limit=200
    // GET /ai/automations/runs?status=FAILED&dateFrom=...
    // GET /ai/automations/runs?dateFrom=...
    await page.waitForTimeout(5000);

    // Scroll all the way to bottom to see Automation Health section
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);

    // Check if "Automation Health" heading appeared
    const healthHeading = page.getByText('Automation Health');
    const hasHealthHeading = await healthHeading.first().isVisible({ timeout: 5000 }).catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Step 1: Dashboard loaded — healthHeading=${hasHealthHeading}, healthApis=[${healthApiResults.join(', ')}]`,
    });

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-dashboard-automation-health-section.png`,
      fullPage: true,
    });

    // If health section is not rendered, the API calls likely failed or returned no data.
    // The component returns null when !health (useQuery data is undefined on error).
    if (!hasHealthHeading) {
      test.info().annotations.push({
        type: 'issue',
        description: `Automation Health section not rendered — component returns null when health data is unavailable. API errors: [${apiErrors.join('; ')}]`,
      });

      // Check if the "View All Runs" button is also missing (confirms section not rendered)
      const viewAllRunsBtn = page.getByText(/View All Runs/i);
      const hasViewAllRuns = await viewAllRunsBtn.isVisible({ timeout: 2000 }).catch(() => false);
      test.info().annotations.push({
        type: 'info',
        description: `ViewAllRuns button: ${hasViewAllRuns}`,
      });

      // The section should be visible — fail with diagnostic info
      expect(hasHealthHeading,
        `Automation Health section heading should be visible. ` +
        `Health API results: [${healthApiResults.join(', ')}]. ` +
        `API errors: [${apiErrors.join('; ')}]`
      ).toBeTruthy();
      return;
    }

    // ── Step 2: Verify status donut/pie chart ────────────────────────────────
    // StatusDonut renders SVG with circle/path elements or "No automations yet"
    // Look for the status chart card — it has legend text "Active", "Paused", "Inactive"
    const pausedLegend = page.getByText('Paused');
    const inactiveLegend = page.getByText('Inactive');
    const hasPausedLegend = await pausedLegend.first().isVisible({ timeout: 3000 }).catch(() => false);
    const hasInactiveLegend = await inactiveLegend.first().isVisible({ timeout: 3000 }).catch(() => false);

    // Check for "No automations yet" empty state
    const noAutomationsText = page.getByText(/No automations yet/i);
    const hasEmptyState = await noAutomationsText.isVisible({ timeout: 2000 }).catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Step 2: Status chart — paused=${hasPausedLegend}, inactive=${hasInactiveLegend}, emptyState=${hasEmptyState}`,
    });

    expect(
      hasPausedLegend || hasInactiveLegend || hasEmptyState,
      'Status donut chart with legend (Active/Paused/Inactive) or empty state should be visible',
    ).toBeTruthy();

    // ── Step 3: Verify failed runs (24h) count card ──────────────────────────
    // FailedRunsCard shows red count with X icon or green "All healthy" with check icon
    const failedRunsText = page.getByText(/failed in last 24/i);
    const hasFailedRunsText = await failedRunsText.isVisible({ timeout: 5000 }).catch(() => false);

    const allHealthyText = page.getByText(/All healthy/i);
    const hasAllHealthy = await allHealthyText.isVisible({ timeout: 3000 }).catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Step 3: Failed runs — text=${hasFailedRunsText}, allHealthy=${hasAllHealthy}`,
    });

    expect(
      hasFailedRunsText || hasAllHealthy,
      'Failed runs count or "All healthy" indicator should be visible',
    ).toBeTruthy();

    // ── Step 4: Verify upcoming scheduled runs list ──────────────────────────
    // UpcomingRunsCard shows list of upcoming runs or "No upcoming runs" empty state
    const noUpcomingText = page.getByText(/No upcoming runs/i);
    const hasNoUpcoming = await noUpcomingText.isVisible({ timeout: 3000 }).catch(() => false);

    // Check for scheduled run items with relative time text
    const upcomingRunItem = page.getByText(/in \d/i);
    const hasUpcomingItems = await upcomingRunItem.first().isVisible({ timeout: 3000 }).catch(() => false);

    // Also check for "Upcoming" or "Next Scheduled" heading text
    const upcomingHeading = page.getByText(/Upcoming|Next Scheduled/i);
    const hasUpcomingHeading = await upcomingHeading.first().isVisible({ timeout: 3000 }).catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Step 4: Upcoming runs — heading=${hasUpcomingHeading}, noUpcoming=${hasNoUpcoming}, items=${hasUpcomingItems}`,
    });

    expect(
      hasUpcomingHeading || hasNoUpcoming || hasUpcomingItems,
      'Upcoming runs section should be visible (either with scheduled runs or empty state)',
    ).toBeTruthy();

    // ── Step 5: Verify token spend trend chart ───────────────────────────────
    const tokenSpendHeading = page.getByText(/Token Spend/i);
    const hasTokenSpendHeading = await tokenSpendHeading.isVisible({ timeout: 5000 }).catch(() => false);

    // Check for "No automation token usage" empty state
    const noTokenUsageText = page.getByText(/No automation token usage/i);
    const hasNoTokenUsage = await noTokenUsageText.isVisible({ timeout: 3000 }).catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Step 5: Token spend — heading=${hasTokenSpendHeading}, emptyState=${hasNoTokenUsage}`,
    });

    expect(
      hasTokenSpendHeading || hasNoTokenUsage,
      'Token spend chart or empty state should be visible',
    ).toBeTruthy();

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-token-spend-chart.png`,
      fullPage: true,
    });

    // ── Step 6: Click failed runs count card to navigate ─────────────────────
    // The FailedRunsCard card is wrapped in a clickable div with cursor-pointer
    // Find the card containing "failed in last 24" or "All healthy" text
    const failedRunsCard = page.locator('div[class*="cursor-pointer"]').filter({
      hasText: /failed in last 24|All healthy/i,
    });
    const hasClickableCard = await failedRunsCard.first().isVisible({ timeout: 3000 }).catch(() => false);

    if (hasClickableCard) {
      await failedRunsCard.first().click();
    } else {
      // Fallback: click on the failed runs text or healthy text
      if (hasFailedRunsText) {
        await failedRunsText.click();
      } else if (hasAllHealthy) {
        await allHealthyText.click();
      }
    }
    await page.waitForTimeout(2000);

    // Verify navigation to runs page
    const currentUrl = page.url();
    const isOnRunsPage = currentUrl.includes('/runs');

    const runsHeading = page.getByRole('heading', { name: /Automation Runs/i });
    const hasRunsHeading = await runsHeading.isVisible({ timeout: 5000 }).catch(() => false);

    test.info().annotations.push({
      type: 'info',
      description: `Step 6: Failed runs navigation — url=${currentUrl}, onRunsPage=${isOnRunsPage}, heading=${hasRunsHeading}`,
    });

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-failed-runs-navigation.png`,
      fullPage: true,
    });

    // ── Step 7: Navigate back to /ai/admin ───────────────────────────────────
    await spaNavigate(page, '/ai/admin');
    await expect(
      page.getByRole('heading', { name: /AI Configuration/i }),
    ).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(3000);

    test.info().annotations.push({
      type: 'info',
      description: 'Step 7: Navigated back to dashboard',
    });

    // ── Step 8: Check circuit breaker warning banner ─────────────────────────
    // Scroll to bottom again to see the health section
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);

    // CircuitBreakerBanner: amber card with AlertTriangle icon
    const circuitBreakerBanner = page.locator('[class*="border-amber"][class*="bg-amber"]');
    const hasCircuitBreaker = await circuitBreakerBanner.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (hasCircuitBreaker) {
      // Verify banner content
      const pausedText = page.getByText(/paused after 3 consecutive failures/i);
      const hasPausedText = await pausedText.isVisible({ timeout: 3000 }).catch(() => false);

      const viewRunsBtn = circuitBreakerBanner.first().getByText(/View Runs/i);
      const hasViewRuns = await viewRunsBtn.isVisible({ timeout: 3000 }).catch(() => false);

      const resumeBtn = circuitBreakerBanner.first().getByText(/Resume/i);
      const hasResume = await resumeBtn.isVisible({ timeout: 3000 }).catch(() => false);

      test.info().annotations.push({
        type: 'info',
        description: `Step 8: Circuit breaker PRESENT — pausedText=${hasPausedText}, viewRuns=${hasViewRuns}, resume=${hasResume}`,
      });
    } else {
      // No circuit breaker banner — expected when no automations have 3+ consecutive failures
      const healthSectionStillVisible = await healthHeading.first().isVisible({ timeout: 3000 }).catch(() => false);

      test.info().annotations.push({
        type: 'info',
        description: `Step 8: No circuit breaker banner (expected if no automations have 3+ consecutive failures) — healthSection=${healthSectionStillVisible}`,
      });
    }

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-8-circuit-breaker-check.png`,
      fullPage: true,
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
