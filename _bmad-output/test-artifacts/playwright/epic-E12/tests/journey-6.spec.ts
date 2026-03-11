import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E12/journey-6';

test.describe('Journey 6: Search Templates by Name', () => {
  test('should filter templates by search term and support case-insensitive matching', async ({
    page,
  }) => {
    // ── Step 1: Navigate to /settings/document-templates ────────────────────
    await page.goto('/');

    // If redirected to login, authenticate first
    if (page.url().includes('/login')) {
      await page.getByPlaceholder('you@company.co.uk').fill('admin@nexa-erp.dev');
      await page.getByPlaceholder('Enter your password').fill('NexaDev2026!');
      await page.getByRole('button', { name: 'Sign In' }).click();

      await page.waitForFunction(
        () => !window.location.pathname.includes('/login'),
        { timeout: 20000 },
      );
    }

    // Wait for the app layout (sidebar) to appear
    await page.waitForSelector('nav, aside', { timeout: 15000 });

    // Navigate to document templates page
    const docTemplatesLink = page.locator('a[href*="document-templates"]');
    const linkCount = await docTemplatesLink.count();

    if (linkCount > 0) {
      await docTemplatesLink.first().click();
    } else {
      await page.evaluate(async () => {
        const mod = await import('/src/router.ts');
        await mod.router.navigate({ to: '/settings/document-templates' });
      });
    }

    await page.waitForFunction(
      () => window.location.pathname.includes('/settings/document-templates'),
      { timeout: 10000 },
    );

    // Wait for template list to load — accordion groups with template counts
    await expect(page.getByText(/\(\d+ templates?\)/).first()).toBeVisible({ timeout: 15000 });

    // Wait for skeletons to disappear
    try {
      await page.waitForFunction(
        () => document.querySelectorAll('[class*="skeleton"]').length === 0,
        { timeout: 10000 },
      );
    } catch {
      // Already gone
    }

    // Count initial accordion groups for later comparison
    const initialGroupCount = await page.locator('[data-state="open"], [data-state="closed"]').count();
    expect(initialGroupCount).toBeGreaterThanOrEqual(1);

    // CP-1: Full template list loaded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-full-template-list.png`,
      fullPage: true,
    });

    // ── Step 2: Search for "E2E" ────────────────────────────────────────────
    const searchInput = page.getByLabel('Search templates by name');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('E2E');

    // Wait for debounce (300ms) + API response + re-render
    // Wait for the list to update — we expect only E2E templates
    await page.waitForTimeout(500);

    // Wait for any loading to settle
    try {
      await page.waitForFunction(
        () => document.querySelectorAll('[class*="skeleton"]').length === 0,
        { timeout: 10000 },
      );
    } catch {
      // Already gone
    }

    // Verify search input shows "E2E"
    await expect(searchInput).toHaveValue('E2E');

    // Verify matching templates are visible
    // The test plan expects: 'E2E Test Invoice Template' and 'E2E Credit Note Compact'
    const e2eCards = page.locator('.cursor-pointer.rounded-xl');
    const e2eCardCount = await e2eCards.count();

    // Should show only E2E-matching templates (expect 2 from seeded data)
    expect(e2eCardCount).toBeGreaterThanOrEqual(1);
    expect(e2eCardCount).toBeLessThanOrEqual(5); // sanity — shouldn't be the full list

    // Verify at least one E2E-named template is visible
    await expect(page.getByText(/E2E/i).first()).toBeVisible();

    // Verify "Standard" templates are NOT showing
    const standardTemplateVisible = await page.getByText('Standard Invoice').isVisible().catch(() => false);
    // With only E2E search, Standard templates should be hidden
    // (only check if there were standard templates initially)
    if (initialGroupCount > 2) {
      expect(standardTemplateVisible).toBe(false);
    }

    // CP-2: Search results for "E2E"
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-search-e2e-results.png`,
      fullPage: true,
    });

    // ── Step 3: Search for "standard" (case-insensitive) ────────────────────
    await searchInput.clear();
    await searchInput.fill('standard');

    // Wait for debounce + API response
    await page.waitForTimeout(500);

    try {
      await page.waitForFunction(
        () => document.querySelectorAll('[class*="skeleton"]').length === 0,
        { timeout: 10000 },
      );
    } catch {
      // Already gone
    }

    // Verify search input shows "standard"
    await expect(searchInput).toHaveValue('standard');

    // Verify Standard-named templates are visible
    const standardCards = page.locator('.cursor-pointer.rounded-xl');
    const standardCardCount = await standardCards.count();
    expect(standardCardCount).toBeGreaterThanOrEqual(1);

    // Check that we see at least one "Standard" template name
    await expect(page.getByText(/Standard/i).first()).toBeVisible();

    // E2E templates should be hidden now
    const e2eTemplateVisible = await page.getByText('E2E Test Invoice Template').isVisible().catch(() => false);
    expect(e2eTemplateVisible).toBe(false);

    // CP-3: Search results for "standard"
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-search-standard-results.png`,
      fullPage: true,
    });

    // ── Step 4: Clear search — full list restored ───────────────────────────
    await searchInput.clear();

    // Wait for debounce + API response
    await page.waitForTimeout(500);

    try {
      await page.waitForFunction(
        () => document.querySelectorAll('[class*="skeleton"]').length === 0,
        { timeout: 10000 },
      );
    } catch {
      // Already gone
    }

    // Verify search is cleared
    await expect(searchInput).toHaveValue('');

    // Verify full list is restored — accordion group count should match initial
    const restoredGroupCount = await page.locator('[data-state="open"], [data-state="closed"]').count();
    expect(restoredGroupCount).toBeGreaterThanOrEqual(initialGroupCount);

    // Both E2E and Standard templates should be visible again
    const allCards = page.locator('.cursor-pointer.rounded-xl');
    const allCardCount = await allCards.count();
    expect(allCardCount).toBeGreaterThanOrEqual(e2eCardCount);
    expect(allCardCount).toBeGreaterThanOrEqual(standardCardCount);

    // CP-4: Search cleared — full list restored
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-search-cleared-full-list.png`,
      fullPage: true,
    });
  });
});
