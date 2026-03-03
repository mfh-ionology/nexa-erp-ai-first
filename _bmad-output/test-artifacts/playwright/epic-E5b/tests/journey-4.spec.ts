import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5b/journey-4';

// Seed user credentials from packages/db/prisma/seed.ts
const TEST_EMAIL = 'admin@nexa-erp.dev';
const TEST_PASSWORD = 'NexaDev2026!';

test.describe('Journey 4: Search and Filter Memories', () => {
  test('Client-side search and category filtering of the memory list', async ({
    page,
  }) => {
    // ── Pre-step: Log in to the application ──
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const emailInput = page.getByRole('textbox', { name: 'Email' });
    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await emailInput.fill(TEST_EMAIL);
    await page.getByRole('textbox', { name: 'Password' }).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for the sidebar to appear after login
    const sidebar = page.locator('nav[aria-label="Navigation"]');
    await expect(sidebar).toBeVisible({ timeout: 20000 });

    // ── Step 1: Navigate to /ai/memory ──
    const myMemoryLink = sidebar.getByRole('link', { name: 'My Memory' });
    await expect(myMemoryLink).toBeVisible();
    await myMemoryLink.click();

    await page.waitForURL('**/ai/memory', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Wait for main content area
    const mainContent = page.locator('main[aria-label="Main content"]');
    await expect(mainContent).toBeVisible({ timeout: 10000 });

    // Wait for page to fully render (API calls to settle)
    await page.waitForTimeout(1000);

    // Checkpoint 1: Memory page loaded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-memory-page-loaded.png`,
      fullPage: true,
    });

    // Check if the search input is present (indicates memories exist)
    const searchInput = page.getByPlaceholder('Search memories...');
    const searchVisible = await searchInput.isVisible().catch(() => false);

    // Also check for global empty state
    const emptyStateHeading = page.getByRole('heading', {
      name: 'No memories yet',
    });
    const isEmptyState = await emptyStateHeading.isVisible().catch(() => false);

    if (isEmptyState && !searchVisible) {
      // ── EMPTY STATE PATH ──
      // No memories are seeded. The search/filter UI is not rendered.
      // The test plan prerequisite states: "AI memory seeded with 10+ memories
      // across 5 categories". This seed data is missing.

      // Verify the empty state renders correctly
      await expect(emptyStateHeading).toBeVisible();
      await expect(
        page.getByText(
          'As you interact with the AI, it will remember your preferences and decisions'
        )
      ).toBeVisible();

      // Annotate the test with the missing prerequisite
      test.info().annotations.push({
        type: 'prerequisite-missing',
        description:
          'No AI memories seeded. Journey 4 requires seeded memory data (10+ memories across 5 categories: PREFERENCE, WORKFLOW, DECISION, INSTRUCTION, ENTITY_CONTEXT). Search input, category filter pills, and memory cards are NOT rendered when memory store is empty. All 5 steps of this journey CANNOT be tested.',
      });

      // Take a screenshot documenting the empty state
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-1-empty-state-no-seed-data.png`,
        fullPage: true,
      });

      // Skip the rest — the journey cannot proceed without seed data
      // Using expect().fail() rather than test.skip() so the test reports as failed
      // (missing prerequisite is a failure condition, not a skip)
      expect(
        searchVisible,
        'Missing prerequisite: No AI memories seeded. Search/filter UI not rendered because memory store is empty. The test plan requires 10+ seeded memories across 5 categories. See missing-functionality-epic-E5b.md.'
      ).toBe(true);
      return;
    }

    // ── MEMORIES EXIST PATH ──
    // If we reach here, the search input is visible and memories are loaded
    await expect(searchInput).toBeVisible();

    // Count initial memories
    const initialCardCount = await page.locator('article').count();
    expect(initialCardCount).toBeGreaterThan(0);

    // ── Step 2: Type "invoice" in search input ──
    await searchInput.fill('invoice');

    // Wait for useDeferredValue to settle (React deferred transition)
    await page.waitForTimeout(500);

    // Checkpoint 2: Search results filtered by "invoice"
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-search-filtered-invoice.png`,
      fullPage: true,
    });

    // Any visible cards should contain "invoice" (case-insensitive)
    const filteredCardCount = await page.locator('article').count();
    if (filteredCardCount > 0) {
      const visibleCards = page.locator('article');
      for (let i = 0; i < filteredCardCount; i++) {
        const cardText = await visibleCards.nth(i).textContent();
        expect(cardText?.toLowerCase()).toContain('invoice');
      }
    }

    // ── Step 3: Click Preferences category filter pill ──
    const preferencesFilter = page.locator('button[aria-pressed]', {
      hasText: 'Preferences',
    });
    await expect(preferencesFilter).toBeVisible();
    await preferencesFilter.click();

    // Verify the pill is now active
    await expect(preferencesFilter).toHaveAttribute('aria-pressed', 'true');

    // Wait for filter to apply
    await page.waitForTimeout(300);

    // Checkpoint 3: Combined search + category filter
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-category-plus-search.png`,
      fullPage: true,
    });

    // Any remaining cards should be in "Preferences" category AND contain "invoice"
    const combinedFilterCount = await page.locator('article').count();
    if (combinedFilterCount > 0) {
      const firstCard = page.locator('article').first();
      const cardText = await firstCard.textContent();
      expect(cardText?.toLowerCase()).toContain('invoice');
      await expect(firstCard.getByText('Preferences').first()).toBeVisible();
    }

    // ── Step 4: Clear search text ──
    // The test plan says "click Clear search (X button)". The search input itself
    // doesn't have an X button; clearing is done by emptying the input.
    // The "clear" button (aria-label="clear") in the filter area only clears
    // category filters, not the search text. Clear the input directly.
    await searchInput.clear();

    // Wait for deferred transition
    await page.waitForTimeout(500);

    // Checkpoint 4: Category filter only (search cleared)
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-category-filter-only.png`,
      fullPage: true,
    });

    // Preferences filter should still be active
    await expect(preferencesFilter).toHaveAttribute('aria-pressed', 'true');

    // Should see all Preferences memories (no longer filtered by "invoice")
    const categoryOnlyCount = await page.locator('article').count();
    expect(categoryOnlyCount).toBeGreaterThanOrEqual(combinedFilterCount);

    // Reset category filter for next step
    await preferencesFilter.click();
    await expect(preferencesFilter).toHaveAttribute('aria-pressed', 'false');
    await page.waitForTimeout(300);

    // ── Step 5: Type "zzzznonexistent" in search input ──
    await searchInput.fill('zzzznonexistent');

    // Wait for deferred transition
    await page.waitForTimeout(500);

    // Verify no cards are visible
    const emptyCount = await page.locator('article').count();
    expect(emptyCount).toBe(0);

    // Verify "No memories match your search" empty state
    const noResultsMessage = page.getByText('No memories match your search');
    await expect(noResultsMessage).toBeVisible();

    // Checkpoint 5: Empty state for no-match search
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-empty-state-no-results.png`,
      fullPage: true,
    });

    // Verify search input still shows the nonsense text
    await expect(searchInput).toHaveValue('zzzznonexistent');

    // Clean up: clear search
    await searchInput.clear();
    await page.waitForTimeout(300);
  });
});
