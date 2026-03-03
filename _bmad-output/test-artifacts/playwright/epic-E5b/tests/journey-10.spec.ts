import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5b/journey-10';

// Seed user credentials from packages/db/prisma/seed.ts
const TEST_EMAIL = 'admin@nexa-erp.dev';
const TEST_PASSWORD = 'NexaDev2026!';

test.describe('Journey 10: Search and Filter Skills', () => {
  test('Skills page search and module filtering work correctly', async ({ page }) => {
    // ── Pre-step: Log in to the application ──
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const emailInput = page.getByRole('textbox', { name: 'Email' });
    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await emailInput.fill(TEST_EMAIL);
    await page.getByRole('textbox', { name: 'Password' }).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for sidebar to confirm login succeeded
    const sidebar = page.locator('nav[aria-label="Navigation"]');
    await expect(sidebar).toBeVisible({ timeout: 20000 });

    // ── Step 1: Navigate to /ai/skills via sidebar link ──
    const skillsLink = sidebar.getByRole('link', { name: 'Skills' });
    await expect(skillsLink).toBeVisible();
    await skillsLink.click();

    await page.waitForURL('**/ai/skills', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Wait for either skill cards or empty state
    const skillCardLocator = page.locator('article[role="button"]').first();
    const emptyStateHeading = page.getByRole('heading', { name: 'No skills available' });
    await expect(skillCardLocator.or(emptyStateHeading)).toBeVisible({ timeout: 15000 });

    const hasSkills = await skillCardLocator.isVisible();

    if (!hasSkills) {
      // No skills seeded — cannot test search/filter
      test.info().annotations.push({
        type: 'prerequisite_not_met',
        description:
          'No skills data seeded. Search and filter cannot be tested without skill data.',
      });

      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-1-skills-page-loaded.png`,
        fullPage: true,
      });

      test.skip(true, 'No skills data seeded — search/filter tests require seed data');
      return;
    }

    // Verify search input and module filter are visible
    const searchInput = page.locator('input[aria-label="Search skills..."]');
    await expect(searchInput).toBeVisible();

    const moduleFilterTrigger = page.locator('[aria-label="Filter by module"]');
    await expect(moduleFilterTrigger).toBeVisible();

    // Count total skill cards before filtering
    const allSkillCards = page.locator('article[role="button"]');

    // Expand all module sections so we can count all skill cards
    const collapsedSections = page.locator('button[aria-expanded="false"]');
    const collapsedCount = await collapsedSections.count();
    for (let i = 0; i < collapsedCount; i++) {
      await collapsedSections.nth(0).click();
      await page.waitForTimeout(200);
    }

    const totalSkillCount = await allSkillCards.count();
    expect(totalSkillCount).toBeGreaterThan(0);

    // Checkpoint 1: Skills page loaded with all skills
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-skills-page-loaded.png`,
      fullPage: true,
    });

    // ── Step 2: Search for "invoice" ──
    await searchInput.fill('invoice');

    // Wait for useDeferredValue debounce to propagate
    await page.waitForTimeout(500);

    // Count filtered skill cards
    const filteredCardCount = await allSkillCards.count();

    if (filteredCardCount > 0) {
      // Verify all visible skill cards match the search term in some way
      // (name, description, or trigger phrases)
      const visibleCards = page.locator('article[role="button"]');
      const visibleCount = await visibleCards.count();

      for (let i = 0; i < visibleCount; i++) {
        const cardText = await visibleCards.nth(i).textContent();
        expect(cardText?.toLowerCase()).toContain('invoice');
      }
    } else {
      // "invoice" search returned no results — verify empty search state instead
      const noResultsInvoice = page.getByText('No skills match your search');
      await expect(noResultsInvoice).toBeVisible({ timeout: 5000 });
    }

    // Checkpoint 2: Search results for "invoice"
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-search-results-invoice.png`,
      fullPage: true,
    });

    // ── Step 3: Apply module filter to "Views & Navigation" ──
    // First clear the search so we can test module filter independently
    await searchInput.clear();
    await page.waitForTimeout(500);

    // Click the module filter dropdown trigger
    await moduleFilterTrigger.click();

    // Wait for the Select dropdown to appear (Radix UI portal)
    const viewsOption = page.getByRole('option', { name: 'Views & Navigation' });
    await expect(viewsOption).toBeVisible({ timeout: 5000 });
    await viewsOption.click();

    // Wait for filtering to apply
    await page.waitForTimeout(500);

    // Verify only "Views & Navigation" module section is visible
    const viewsSection = page.locator('section[aria-label="Views & Navigation"]');
    await expect(viewsSection).toBeVisible({ timeout: 5000 });

    // Verify other module sections are hidden
    const allSections = page.locator('section[aria-label]');
    const sectionCount = await allSections.count();
    for (let i = 0; i < sectionCount; i++) {
      const label = await allSections.nth(i).getAttribute('aria-label');
      expect(label).toBe('Views & Navigation');
    }

    // Checkpoint 3: Module filter applied
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-module-filter-views.png`,
      fullPage: true,
    });

    // ── Step 4: Search for nonexistent term to trigger empty state ──
    await searchInput.fill('zzzznonexistent');

    // Wait for debounce
    await page.waitForTimeout(500);

    // Verify empty search state is shown
    const noResultsText = page.getByText('No skills match your search');
    await expect(noResultsText).toBeVisible({ timeout: 5000 });

    // Verify no skill cards are visible
    const visibleCards = await allSkillCards.count();
    expect(visibleCards).toBe(0);

    // Checkpoint 4: Empty state — no search results
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-empty-state-no-results.png`,
      fullPage: true,
    });

    // Verify the "Clear" button/link is present to reset filters
    const clearLink = page.getByText('Clear');
    await expect(clearLink).toBeVisible();
  });
});
