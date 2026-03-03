import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '../../screenshots/epic-E5c/journey-1';

test.describe('Journey 1: AI Configuration Dashboard', () => {
  test.setTimeout(90_000);

  test.beforeEach(async ({ page }) => {
    // Login as admin user
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@nexa-erp.dev');
    await page.getByLabel('Password').fill('NexaDev2026!');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for redirect away from login page
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
    await page.waitForLoadState('networkidle');
  });

  test('Dashboard loads with summary cards, charts, quick-nav, and automation health', async ({
    page,
  }) => {
    // ── Step 1: Navigate to AI Admin Dashboard via sidebar ─────────────
    // The sidebar has collapsible module groups. Find and expand the AI group,
    // then click "AI Administration".
    // First try clicking the AI sidebar group label to expand it
    const sidebarAiGroup = page.locator('nav').getByText('AI', { exact: true }).first();
    if (await sidebarAiGroup.isVisible().catch(() => false)) {
      await sidebarAiGroup.click();
      await page.waitForTimeout(300);
    }

    // Now click the AI Administration sidebar item
    const aiAdminSidebarLink = page.locator('nav').getByText('AI Administration').first();
    if (await aiAdminSidebarLink.isVisible().catch(() => false)) {
      await aiAdminSidebarLink.click();
    } else {
      // Fallback: try link by href
      const aiAdminHref = page.locator('a[href*="/ai/admin"]').first();
      if (await aiAdminHref.isVisible().catch(() => false)) {
        await aiAdminHref.click();
      }
    }

    await page.waitForLoadState('networkidle');

    // Wait for dashboard heading
    await expect(
      page.getByText('AI Configuration', { exact: false }),
    ).toBeVisible({ timeout: 15000 });

    // Wait for loading skeletons to disappear
    await page.waitForTimeout(2000);

    // ── Checkpoint 1: Dashboard Initial Load ──────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-dashboard-loaded.png`,
      fullPage: true,
    });

    // ── Step 2: Verify Active Models card ─────────────────────────────
    const modelsCard = page.locator('text=Active Models').first();
    await expect(modelsCard).toBeVisible();

    // ── Step 3: Verify Active Agents card ─────────────────────────────
    const agentsCard = page.locator('text=Active Agents').first();
    await expect(agentsCard).toBeVisible();

    // ── Step 4: Verify Active Skills card ─────────────────────────────
    const skillsCard = page.locator('text=Active Skills').first();
    await expect(skillsCard).toBeVisible();
    // Should have "across N modules" subtitle
    await expect(page.getByText(/across \d+ modules?/)).toBeVisible();

    // ── Step 5: Verify Automations card ───────────────────────────────
    const automationsCardTitle = page.locator('text=Automations').first();
    await expect(automationsCardTitle).toBeVisible();

    // Check for active badge (green) and paused badge (amber)
    const activeBadge = page.locator('text=/\\d+ active/').first();
    await expect(activeBadge).toBeVisible();
    const pausedBadge = page.locator('text=/\\d+ paused/').first();
    await expect(pausedBadge).toBeVisible();

    // ── Checkpoint 2: Summary Cards Detail ────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-summary-cards-detail.png`,
      fullPage: false,
    });

    // ── Step 6: Verify Token Usage chart section ──────────────────────
    const tokenChartHeading = page.getByText('Token Usage (Last 30 Days)');
    await expect(tokenChartHeading).toBeVisible();
    // Chart area or fallback message should be visible
    const chartOrMessage = page
      .locator('.recharts-wrapper, :text("No token usage data available yet")')
      .first();
    await expect(chartOrMessage).toBeVisible();

    // ── Step 7: Verify Quick navigation cards ─────────────────────────
    await expect(
      page.locator('button').filter({ hasText: 'Model Registry' }).filter({ hasText: 'View and manage' }),
    ).toBeVisible();

    await expect(
      page.locator('button').filter({ hasText: 'Prompt Templates' }).filter({ hasText: 'Edit prompt' }),
    ).toBeVisible();

    await expect(
      page.locator('button').filter({ hasText: /^Automations/ }).filter({ hasText: 'Build and manage' }),
    ).toBeVisible();

    // ── Checkpoint 3: Token Usage Chart & Quick Nav ────────────────────
    await tokenChartHeading.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-7-chart-and-quicknav.png`,
      fullPage: true,
    });

    // ── Step 8: Verify Automation Health section ──────────────────────
    const healthHeading = page.getByText('Automation Health');
    await expect(healthHeading).toBeVisible();
    await healthHeading.scrollIntoViewIfNeeded();

    // Automations by Status section
    const statusSection = page
      .locator(':text("Automations by Status"), :text("No automations yet")')
      .first();
    await expect(statusSection).toBeVisible();

    // Failed Runs (24h) card
    await expect(page.getByText('Failed Runs (24h)')).toBeVisible();

    // Upcoming Scheduled Runs
    await expect(page.getByText('Upcoming Scheduled Runs')).toBeVisible();

    // Token Spend (7d)
    await expect(page.getByText('Token Spend (7d)')).toBeVisible();

    // ── Checkpoint 4: Automation Health Section ───────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-8-automation-health.png`,
      fullPage: true,
    });

    // ── Step 9: Click Model Registry quick-nav card ──────────────────
    const modelRegistryButton = page
      .locator('button')
      .filter({ hasText: 'Model Registry' })
      .filter({ hasText: 'View and manage AI models' });
    await modelRegistryButton.scrollIntoViewIfNeeded();
    await modelRegistryButton.click();

    // Verify navigation to /ai/admin/models
    await page.waitForURL('**/ai/admin/models', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // ── Checkpoint 5: Model Registry Navigation ──────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-9-model-registry-nav.png`,
      fullPage: true,
    });

    // ── Step 10: Navigate back to dashboard via sidebar ──────────────
    // Click the AI Administration sidebar link to return
    const aiAdminBackLink = page.locator('nav').getByText('AI Administration').first();
    if (await aiAdminBackLink.isVisible().catch(() => false)) {
      await aiAdminBackLink.click();
    } else {
      // Fallback: use browser back button (SPA handles it)
      await page.goBack();
    }
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByText('AI Configuration', { exact: false }),
    ).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000);

    // ── Step 11: Click Prompt Templates quick-nav card ───────────────
    const promptTemplatesButton = page
      .locator('button')
      .filter({ hasText: 'Prompt Templates' })
      .filter({ hasText: 'Edit prompt templates' });
    await promptTemplatesButton.scrollIntoViewIfNeeded();
    await promptTemplatesButton.click();

    // Verify navigation to /ai/admin/prompts
    await page.waitForURL('**/ai/admin/prompts', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // ── Checkpoint 6: Prompt Templates Navigation ────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-11-prompt-templates-nav.png`,
      fullPage: true,
    });
  });
});
