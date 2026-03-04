import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR = process.env.SCREENSHOTS_DIR || '../../screenshots/epic-E5c/journey-21';

/**
 * Helper: navigate within the SPA using TanStack Router.
 * Auth tokens are in-memory only (Zustand), so page.goto() would
 * cause a full reload and lose the authenticated session.
 */
async function spaNavigate(page: import('@playwright/test').Page, path: string) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await page.waitForTimeout(500);
  await page.waitForLoadState('networkidle');
}

test.describe('Journey 21: Sidebar Navigation for All AI Admin Pages', () => {
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

  test('All AI sidebar links navigate to correct pages', async ({ page }) => {
    // Scope locators to sidebar nav
    const sidebarNav = page.getByLabel('Navigation', { exact: true });

    // ── Step 1: Verify app loads with sidebar visible ────────────────────
    await expect(sidebarNav).toBeVisible({ timeout: 10000 });

    // ── Step 2: Verify AI sections in sidebar ────────────────────────────
    // AI Administration group items
    await expect(sidebarNav.getByText('Model Registry')).toBeVisible({ timeout: 10000 });
    await expect(sidebarNav.getByText('Prompt Templates')).toBeVisible();
    await expect(sidebarNav.getByText('Agent Configuration')).toBeVisible();
    await expect(sidebarNav.getByText('Skill Packs')).toBeVisible();
    await expect(sidebarNav.getByText('Automations')).toBeVisible();
    // AI group items
    await expect(sidebarNav.getByText('Automation Runs')).toBeVisible();
    await expect(sidebarNav.getByText('Morning Briefing')).toBeVisible();
    await expect(sidebarNav.getByText('My Memory')).toBeVisible();

    // ── Checkpoint 1: AI sidebar sections visible ────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-ai-sidebar-sections.png`,
      fullPage: false,
    });

    // ── Step 3: Navigate to AI Admin dashboard via SPA ───────────────────
    // /ai/admin dashboard exists as a route but isn't a direct sidebar item
    await spaNavigate(page, '/ai/admin');
    await expect(
      page.getByRole('heading', { name: /AI Configuration/i }),
    ).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000);

    // ── Step 4: Click Model Registry sidebar link ────────────────────────
    await sidebarNav.getByText('Model Registry').click();
    await page.waitForURL('**/ai/admin/models', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Model Registry' })).toBeVisible({ timeout: 10000 });
    // Verify active state — sidebar link should have bg-primary class
    await expect(sidebarNav.locator('a').filter({ hasText: 'Model Registry' })).toHaveClass(/bg-primary/);

    // ── Checkpoint 2: Model Registry active state ────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-ai-admin-models-active.png`,
      fullPage: false,
    });

    // ── Step 5: Click Prompt Templates sidebar link ──────────────────────
    await sidebarNav.getByText('Prompt Templates').click();
    await page.waitForURL('**/ai/admin/prompts', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Prompt Templates' })).toBeVisible({ timeout: 10000 });
    await expect(sidebarNav.locator('a').filter({ hasText: 'Prompt Templates' })).toHaveClass(/bg-primary/);

    // ── Step 6: Click Agents sidebar link ────────────────────────────────
    await sidebarNav.getByText('Agent Configuration').click();
    await page.waitForURL('**/ai/admin/agents', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Agent Configuration' })).toBeVisible({ timeout: 10000 });
    await expect(sidebarNav.locator('a').filter({ hasText: 'Agent Configuration' })).toHaveClass(/bg-primary/);

    // ── Step 7: Click Skills sidebar link ────────────────────────────────
    await sidebarNav.getByText('Skill Packs').click();
    await page.waitForURL('**/ai/admin/skills', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    // Page heading is "Skill Pack Manager" (not "Skill Packs")
    await expect(page.getByRole('heading', { name: 'Skill Pack Manager' })).toBeVisible({ timeout: 10000 });
    await expect(sidebarNav.locator('a').filter({ hasText: 'Skill Packs' })).toHaveClass(/bg-primary/);

    // ── Step 8: Click Automations sidebar link ───────────────────────────
    // Use exact match to avoid matching "Automation Runs"
    await sidebarNav.locator('a').filter({ hasText: /^Automations$/ }).click();
    await page.waitForURL('**/ai/admin/automations', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Automations' })).toBeVisible({ timeout: 10000 });
    await expect(sidebarNav.locator('a').filter({ hasText: /^Automations$/ })).toHaveClass(/bg-primary/);

    // ── Step 9: Click Automation Runs sidebar link ───────────────────────
    await sidebarNav.getByText('Automation Runs').click();
    await page.waitForURL('**/ai/admin/automations/runs', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Automation Runs' })).toBeVisible({ timeout: 10000 });
    await expect(sidebarNav.locator('a').filter({ hasText: 'Automation Runs' })).toHaveClass(/bg-primary/);

    // ── Checkpoint 3: Automation Runs page final state ───────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-9-automation-runs-page.png`,
      fullPage: false,
    });
  });
});
