import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5c/journey-16';

test.describe('Journey 16: Sidebar Navigation — All AI Admin Pages Accessible', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    // Login as admin user
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@nexa-erp.dev');
    await page.getByLabel('Password').fill('NexaDev2026!');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for redirect away from login and full app load
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    // Extra wait to ensure auth store is fully populated
    await page.waitForTimeout(2000);
  });

  test('All AI Admin sidebar links navigate to correct pages', async ({ page }) => {
    // Scope all sidebar interactions to nav element — use href-based locators
    // to avoid ambiguity with text matching breadcrumbs/headings
    const sidebar = page.locator('nav');

    // ── Step 2: Verify AI Administration sidebar section ─────────────
    // Use href-based locators for reliable identification
    const aiAdminLink = sidebar.locator('a[href="/ai/admin"]').first();
    await aiAdminLink.scrollIntoViewIfNeeded();
    await expect(aiAdminLink).toBeVisible({ timeout: 10000 });

    const modelRegistryLink = sidebar.locator('a[href="/ai/admin/models"]').first();
    await expect(modelRegistryLink).toBeVisible();

    const promptTemplatesLink = sidebar.locator('a[href="/ai/admin/prompts"]').first();
    await expect(promptTemplatesLink).toBeVisible();

    // Check for items known to be missing per sidebar filtering bug
    const agentsLink = sidebar.locator('a[href="/ai/admin/agents"]');
    const skillsLink = sidebar.locator('a[href="/ai/admin/skills"]');
    const automationsLink = sidebar.locator('a[href="/ai/admin/automations"]');
    const automationRunsLink = sidebar.locator('a[href="/ai/admin/automations/runs"]');

    const agentsVisible = await agentsLink.count() > 0 && await agentsLink.first().isVisible().catch(() => false);
    const skillsVisible = await skillsLink.count() > 0 && await skillsLink.first().isVisible().catch(() => false);
    const automationsVisible = await automationsLink.count() > 0 && await automationsLink.first().isVisible().catch(() => false);
    const automationRunsVisible = await automationRunsLink.count() > 0 && await automationRunsLink.first().isVisible().catch(() => false);

    // Soft-assert: all 7 sub-items should be visible in sidebar
    expect.soft(agentsVisible, 'BUG: Agent Configuration sidebar link missing').toBeTruthy();
    expect.soft(skillsVisible, 'BUG: Skill Packs sidebar link missing').toBeTruthy();
    expect.soft(automationsVisible, 'BUG: Automations sidebar link missing').toBeTruthy();
    expect.soft(automationRunsVisible, 'BUG: Automation Runs sidebar link missing').toBeTruthy();

    // ── Checkpoint 1: AI Sidebar Section Visible ─────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-ai-sidebar-section.png`,
      fullPage: true,
    });

    // ── Step 3-4: Click AI Administration > Dashboard ────────────────
    await aiAdminLink.scrollIntoViewIfNeeded();
    await aiAdminLink.click();
    await page.waitForURL('**/ai/admin', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify dashboard loaded — use text locator as heading role may not exist
    await expect(
      page.getByText('AI Configuration').first(),
    ).toBeVisible({ timeout: 10000 });

    // ── Checkpoint 2: Dashboard Page Loaded ──────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-dashboard-loaded.png`,
      fullPage: true,
    });

    // ── Step 5-6: Click Model Registry ───────────────────────────────
    await modelRegistryLink.scrollIntoViewIfNeeded();
    await modelRegistryLink.click();
    await page.waitForURL('**/ai/admin/models', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Verify URL confirms correct navigation
    await expect(page).toHaveURL(/\/ai\/admin\/models/);

    // ── Checkpoint 3: Model Registry Page Loaded ─────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-model-registry-loaded.png`,
      fullPage: true,
    });

    // ── Step 7-8: Click Prompt Templates ─────────────────────────────
    await promptTemplatesLink.scrollIntoViewIfNeeded();
    await promptTemplatesLink.click();
    await page.waitForURL('**/ai/admin/prompts', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await expect(page).toHaveURL(/\/ai\/admin\/prompts/);

    // ── Checkpoint 4: Prompt Templates Page Loaded ───────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-8-prompt-templates-loaded.png`,
      fullPage: true,
    });

    // ── Step 9-10: Agents (if sidebar link exists) ───────────────────
    if (agentsVisible) {
      await agentsLink.first().scrollIntoViewIfNeeded();
      await agentsLink.first().click();
      await page.waitForURL('**/ai/admin/agents', { timeout: 10000 });
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      await expect(page).toHaveURL(/\/ai\/admin\/agents/);
    }

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-10-agents-loaded.png`,
      fullPage: true,
    });

    // ── Step 11-12: Skills (if sidebar link exists) ──────────────────
    if (skillsVisible) {
      await skillsLink.first().scrollIntoViewIfNeeded();
      await skillsLink.first().click();
      await page.waitForURL('**/ai/admin/skills', { timeout: 10000 });
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      await expect(page).toHaveURL(/\/ai\/admin\/skills/);
    }

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-12-skills-loaded.png`,
      fullPage: true,
    });

    // ── Step 13-14: Automations (if sidebar link exists) ─────────────
    if (automationsVisible) {
      await automationsLink.first().scrollIntoViewIfNeeded();
      await automationsLink.first().click();
      await page.waitForURL('**/ai/admin/automations', { timeout: 10000 });
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      await expect(page).toHaveURL(/\/ai\/admin\/automations/);
    }

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-14-automations-loaded.png`,
      fullPage: true,
    });

    // ── Step 15-16: Automation Runs (if sidebar link exists) ─────────
    if (automationRunsVisible) {
      await automationRunsLink.first().scrollIntoViewIfNeeded();
      await automationRunsLink.first().click();
      await page.waitForURL('**/ai/admin/automations/runs', { timeout: 10000 });
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      await expect(page).toHaveURL(/\/ai\/admin\/automations\/runs/);
    }

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-16-automation-runs-loaded.png`,
      fullPage: true,
    });
  });
});
