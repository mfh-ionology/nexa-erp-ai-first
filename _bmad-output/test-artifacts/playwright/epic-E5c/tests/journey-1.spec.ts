import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR = '../../screenshots/epic-E5c/journey-1';

/**
 * Helper: navigate within the SPA using TanStack Router.
 * Auth tokens are in-memory only (Zustand), so page.goto() would
 * cause a full reload and lose the authenticated session.
 */
async function spaNavigate(page: import('@playwright/test').Page, path: string) {
  await page.evaluate((p) => {
    // TanStack Router exposes __TSR_DEHYDRATED__ but the router instance
    // is accessible via the manifest. Use history.pushState + popstate
    // as a cross-framework SPA navigation trigger.
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  // Give the SPA router time to process the navigation
  await page.waitForTimeout(500);
  await page.waitForLoadState('networkidle');
}

test.describe('Journey 1: AI Configuration Dashboard Overview', () => {
  test.setTimeout(90_000);

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

  test('Dashboard loads with summary cards, charts, quick-nav, and sub-page navigation', async ({
    page,
  }) => {
    // ── Step 1: Navigate to /ai/admin via SPA ────────────────────────────
    await spaNavigate(page, '/ai/admin');
    await expect(
      page.getByText('AI Configuration', { exact: false }),
    ).toBeVisible({ timeout: 15000 });
    // Wait for data to load (skeletons to clear)
    await page.waitForTimeout(2000);

    // ── Checkpoint 1: Dashboard Initial Load ───────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-dashboard-loaded.png`,
      fullPage: true,
    });

    // ── Step 2: Verify Active Models card ──────────────────────────────
    const modelsCard = page.getByText('Active Models').first();
    await expect(modelsCard).toBeVisible();

    // ── Step 3: Verify Active Agents card ──────────────────────────────
    const agentsCard = page.getByText('Active Agents').first();
    await expect(agentsCard).toBeVisible();

    // ── Step 4: Verify Active Skills card ──────────────────────────────
    const skillsCard = page.getByText('Active Skills').first();
    await expect(skillsCard).toBeVisible();
    await expect(page.getByText(/across \d+ modules?/)).toBeVisible();

    // ── Step 5: Verify Automations card ────────────────────────────────
    const automationsCardTitle = page.getByText('Automations').first();
    await expect(automationsCardTitle).toBeVisible();
    // Active (green) and paused (amber) badges
    const activeBadge = page.locator('text=/\\d+ active/').first();
    await expect(activeBadge).toBeVisible();
    const pausedBadge = page.locator('text=/\\d+ paused/').first();
    await expect(pausedBadge).toBeVisible();

    // ── Checkpoint 2: Summary Cards Detail ─────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-summary-cards-detail.png`,
      fullPage: false,
    });

    // ── Step 6: Verify Token Usage chart section ───────────────────────
    const tokenChartHeading = page.getByText('Token Usage (Last 30 Days)');
    await expect(tokenChartHeading).toBeVisible();
    const chartOrMessage = page
      .locator('.recharts-wrapper, :text("No token usage data available yet")')
      .first();
    await expect(chartOrMessage).toBeVisible();

    // ── Checkpoint 3: Token Usage Chart ────────────────────────────────
    await tokenChartHeading.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-token-usage-chart.png`,
      fullPage: true,
    });

    // ── Step 7: Verify Automation Health section ───────────────────────
    const healthHeading = page.getByText('Automation Health');
    await expect(healthHeading).toBeVisible();
    await healthHeading.scrollIntoViewIfNeeded();

    // Automations by Status section
    const statusSection = page
      .locator(':text("Automations by Status"), :text("No automations yet")')
      .first();
    await expect(statusSection).toBeVisible();

    // Failed Runs (24h)
    await expect(page.getByText('Failed Runs (24h)')).toBeVisible();

    // Upcoming Scheduled Runs
    await expect(page.getByText('Upcoming Scheduled Runs')).toBeVisible();

    // Token Spend (7d)
    await expect(page.getByText('Token Spend (7d)')).toBeVisible();

    // ── Checkpoint 4: Automation Health Section ────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-7-automation-health.png`,
      fullPage: true,
    });

    // ── Step 8: Verify Quick-nav cards ─────────────────────────────────
    await expect(
      page
        .locator('button')
        .filter({ hasText: 'Model Registry' })
        .filter({ hasText: /View and manage/i }),
    ).toBeVisible();
    await expect(
      page
        .locator('button')
        .filter({ hasText: 'Prompt Templates' })
        .filter({ hasText: /Edit prompt/i }),
    ).toBeVisible();
    await expect(
      page
        .locator('button')
        .filter({ hasText: /^Automations/ })
        .filter({ hasText: /Build and manage/i }),
    ).toBeVisible();

    // ── Step 9: Click Model Registry quick-nav card ────────────────────
    const modelRegistryButton = page
      .locator('button')
      .filter({ hasText: 'Model Registry' })
      .filter({ hasText: /View and manage/i });
    await modelRegistryButton.scrollIntoViewIfNeeded();
    await modelRegistryButton.click();

    // ── Step 10: Verify Model Registry page loaded ─────────────────────
    await page.waitForURL('**/ai/admin/models', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Model Registry')).toBeVisible({
      timeout: 10000,
    });

    // ── Checkpoint 5: Model Registry Navigation ────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-10-model-registry-page.png`,
      fullPage: true,
    });

    // ── Step 11: Navigate back to dashboard via SPA ────────────────────
    await spaNavigate(page, '/ai/admin');
    await expect(
      page.getByText('AI Configuration', { exact: false }),
    ).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // ── Step 12: Click Automations quick-nav card ──────────────────────
    const automationsButton = page
      .locator('button')
      .filter({ hasText: /^Automations/ })
      .filter({ hasText: /Build and manage/i });
    await automationsButton.scrollIntoViewIfNeeded();
    await automationsButton.click();

    // ── Step 13: Verify Automations page loaded ────────────────────────
    await page.waitForURL('**/ai/admin/automations', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Automations')).toBeVisible({
      timeout: 10000,
    });

    // ── Checkpoint 6: Automations Navigation ───────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-13-automations-page.png`,
      fullPage: true,
    });
  });
});
