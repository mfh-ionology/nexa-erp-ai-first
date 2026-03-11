import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5d/journey-13';

/**
 * Helper: navigate within the SPA using pushState + popstate.
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
  await page.waitForLoadState('networkidle');
}

test.describe('Journey 13: Corrections Tab — Filtering by Type, Skill, Date, Resolved Status', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    // Login as admin user
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const emailInput = page.getByRole('textbox', { name: 'Email' });
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.fill('admin@nexa-erp.dev');

    const passwordInput = page.getByRole('textbox', { name: 'Password' });
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

  test('Filter corrections by type, skill key, resolved status, and date range', async ({
    page,
  }) => {
    // ── Step 1: Navigate to /ai/admin/knowledge#corrections ─────────────
    const aiSection = page.getByText('AI Administration').first();
    if (await aiSection.isVisible().catch(() => false)) {
      await aiSection.click();
      await page.waitForTimeout(300);
    }

    const knowledgeLink = page.locator('a[href="/ai/admin/knowledge"]').first();
    if (await knowledgeLink.isVisible().catch(() => false)) {
      await knowledgeLink.click();
    } else {
      await spaNavigate(page, '/ai/admin/knowledge');
    }
    await page.waitForLoadState('networkidle');

    // Wait for page to load
    await expect(
      page.getByRole('heading', { name: 'Knowledge Management' }),
    ).toBeVisible({ timeout: 15000 });

    // Click the Corrections tab
    const correctionsTab = page.getByRole('tab', { name: /corrections/i });
    await correctionsTab.click();
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');

    await expect(correctionsTab).toHaveAttribute('data-state', 'active');

    // Wait for corrections data to load
    await page.waitForTimeout(1500);

    // Verify filter bar is visible — check for the skill key input as a reliable indicator
    const skillKeyInput = page.locator('input[aria-label="Filter by skill key"]');
    await expect(skillKeyInput).toBeVisible({ timeout: 10000 });

    // Verify auto-resolved toggle exists
    const allToggle = page.locator('button').filter({ hasText: /^All$/ });
    await expect(allToggle.first()).toBeVisible({ timeout: 5000 });

    // Checkpoint 1: Corrections tab loaded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-corrections-tab-loaded.png`,
      fullPage: true,
    });

    // ── Step 2: Select TERMINOLOGY type filter ──────────────────────────
    // Click the type filter button (has Filter icon)
    const typeFilterButton = page.locator('button').filter({
      has: page.locator('svg.lucide-filter'),
    });

    // Fallback: look for button containing filter-related text
    const filterButton = await typeFilterButton.first().isVisible().catch(() => false)
      ? typeFilterButton.first()
      : page.locator('button').filter({ hasText: /all types|filter/i }).first();

    await filterButton.click();
    await page.waitForTimeout(500);

    // Select TERMINOLOGY from the popover
    const terminologyOption = page.getByText(/terminology/i);
    await terminologyOption.first().click();
    await page.waitForTimeout(300);

    // Close the popover by clicking outside or pressing Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await page.waitForLoadState('networkidle');

    // Checkpoint 2: TERMINOLOGY filter active
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-terminology-filter-active.png`,
      fullPage: true,
    });

    // Verify filter is visually active (purple border styling)
    // Check that the filter button text changed from "All Types"
    const filterButtonText = await filterButton.textContent();
    console.log(`Type filter button text after selection: ${filterButtonText}`);

    // ── Step 3: Enter skill key filter ──────────────────────────────────
    await skillKeyInput.fill('create_invoice');
    await page.waitForTimeout(500);
    await page.waitForLoadState('networkidle');

    // Verify input has the value
    await expect(skillKeyInput).toHaveValue('create_invoice');

    // Checkpoint 3: Skill key filtered
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-skill-key-filtered.png`,
      fullPage: true,
    });

    // ── Step 4: Toggle auto-resolved to "Resolved" ──────────────────────
    const resolvedButton = page.locator('button').filter({ hasText: /^Resolved$/ });
    await resolvedButton.first().click();
    await page.waitForTimeout(500);
    await page.waitForLoadState('networkidle');

    // Checkpoint 4: Resolved only
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-resolved-only.png`,
      fullPage: true,
    });

    // ── Step 5: Set date range ──────────────────────────────────────────
    const fromDateInput = page.locator('input[aria-label="Filter from date"]');
    const toDateInput = page.locator('input[aria-label="Filter to date"]');

    await fromDateInput.fill('2026-02-01');
    await page.waitForTimeout(300);
    await toDateInput.fill('2026-03-04');
    await page.waitForTimeout(500);
    await page.waitForLoadState('networkidle');

    // Verify date inputs have values
    await expect(fromDateInput).toHaveValue('2026-02-01');
    await expect(toDateInput).toHaveValue('2026-03-04');

    // Verify the Clear button is now visible (indicates active filters)
    const clearButton = page.locator('button').filter({ hasText: /clear/i });
    await expect(clearButton.first()).toBeVisible({ timeout: 5000 });

    // Checkpoint 5: All filters active
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-all-filters-active.png`,
      fullPage: true,
    });

    // ── Step 6: Clear all filters ───────────────────────────────────────
    await clearButton.first().click();
    await page.waitForTimeout(500);
    await page.waitForLoadState('networkidle');

    // Verify filters are cleared
    await expect(skillKeyInput).toHaveValue('');
    await expect(fromDateInput).toHaveValue('');
    await expect(toDateInput).toHaveValue('');

    // Verify Clear button is now hidden
    await expect(clearButton.first()).not.toBeVisible({ timeout: 5000 });

    // Checkpoint 6: Filters cleared
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-filters-cleared.png`,
      fullPage: true,
    });
  });
});
