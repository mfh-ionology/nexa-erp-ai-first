import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR = '../../screenshots/epic-E5d/journey-1';

test.describe('Journey 1: Knowledge Management Page Shell & Navigation', () => {
  test.setTimeout(90_000);

  test.beforeEach(async ({ page }) => {
    // Login as admin user
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Wait for React hydration to complete
    const emailInput = page.getByLabel('Email');
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(1000);

    // Click to focus, then fill
    await emailInput.click();
    await emailInput.fill('admin@nexa-erp.dev');

    const passwordInput = page.getByLabel('Password');
    await passwordInput.click();
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

  test('Page shell loads with tabs, stats panel, sidebar nav, and deep-linking', async ({
    page,
  }) => {
    // ── Step 1: Navigate to /ai/admin/knowledge via sidebar link ─────────
    // Use the sidebar navigation link to navigate (preserves TanStack Router state)
    const knowledgeLink = page.locator('a[href="/ai/admin/knowledge"]').first();
    // If the knowledge link isn't directly visible, we may need to expand the AI section first
    const aiSectionToggle = page.getByText('AI Administration', { exact: false }).first();
    if (await aiSectionToggle.isVisible().catch(() => false)) {
      await aiSectionToggle.click();
      await page.waitForTimeout(300);
    }

    // Try clicking the knowledge link; if not visible, try direct navigation
    if (await knowledgeLink.isVisible().catch(() => false)) {
      await knowledgeLink.click();
    } else {
      // Fallback: use the address bar (will work since we're authenticated)
      await page.evaluate(() => {
        // Use TanStack Router's navigate if available
        const router = (window as any).__TANSTACK_ROUTER__;
        if (router?.navigate) {
          router.navigate({ to: '/ai/admin/knowledge' });
        } else {
          window.location.href = '/ai/admin/knowledge';
        }
      });
    }

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Debug: capture what page we're on
    const currentUrl = page.url();
    console.log('Current URL after navigation:', currentUrl);
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/debug-after-nav.png`,
      fullPage: true,
    });

    // Wait for the page to fully render
    await expect(
      page.getByRole('heading', { name: 'Knowledge Management' }),
    ).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // Verify 5 tabs are present
    const tabNames = [
      'Knowledge Articles',
      'Training Examples',
      'Corrections',
      'Suggested',
      'Settings',
    ];
    for (const tabName of tabNames) {
      await expect(
        page.getByRole('tab', { name: new RegExp(tabName, 'i') }),
      ).toBeVisible({ timeout: 5000 });
    }

    // Verify Knowledge Articles tab is active by default
    const articlesTab = page.getByRole('tab', { name: /knowledge articles/i });
    await expect(articlesTab).toBeVisible();
    await expect(articlesTab).toHaveAttribute('data-state', 'active');

    // Checkpoint 1: Page Initial Load
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-knowledge-page-loaded.png`,
      fullPage: true,
    });

    // ── Step 2: Verify sidebar navigation — Knowledge item under AI Administration ──
    const knowledgeNavItem = page.locator('a[href*="/ai/admin/knowledge"]');
    await expect(knowledgeNavItem.first()).toBeVisible({ timeout: 5000 });

    // ── Step 3: Verify Stats panel KPI cards ─────────────────────────────
    await expect(page.getByText('Total Articles')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('RAG Retrieval Rate')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Correction Trend')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Pending Reviews')).toBeVisible({ timeout: 5000 });

    // Checkpoint 2: Stats Panel KPI Cards
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-stats-panel-kpi-cards.png`,
      fullPage: true,
    });

    // ── Step 4: Click Training Examples tab ───────────────────────────────
    const trainingTab = page.getByRole('tab', { name: /training examples/i });
    await trainingTab.click();
    await page.waitForTimeout(1000);

    // Verify Training Examples tab is now active and URL hash changed
    await expect(trainingTab).toHaveAttribute('data-state', 'active');
    await expect(page).toHaveURL(/#training/);

    // ── Step 5: Click Corrections tab ────────────────────────────────────
    const correctionsTab = page.getByRole('tab', { name: /corrections/i });
    await correctionsTab.click();
    await page.waitForTimeout(1000);

    // Verify Corrections tab is active and hash updated
    await expect(correctionsTab).toHaveAttribute('data-state', 'active');
    await expect(page).toHaveURL(/#corrections/);

    // Checkpoint 3: Corrections Tab Active
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-corrections-tab-active.png`,
      fullPage: true,
    });

    // ── Step 6: Click Settings tab ───────────────────────────────────────
    const settingsTab = page.getByRole('tab', { name: /settings/i });
    await settingsTab.click();
    await page.waitForTimeout(1000);

    await expect(settingsTab).toHaveAttribute('data-state', 'active');
    await expect(page).toHaveURL(/#settings/);

    // ── Step 7: Click Suggested tab ──────────────────────────────────────
    const suggestedTab = page.getByRole('tab', { name: /suggested/i });
    await suggestedTab.click();
    await page.waitForTimeout(1000);

    await expect(suggestedTab).toHaveAttribute('data-state', 'active');
    await expect(page).toHaveURL(/#suggested/);
  });
});
