import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5d/journey-11';

const bugs: string[] = [];

/**
 * SPA navigate without losing auth tokens (Zustand in-memory).
 */
async function spaNavigate(page: import('@playwright/test').Page, path: string) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await page.waitForTimeout(500);
  await page.waitForLoadState('networkidle');
}

/**
 * Login and navigate to Knowledge Management page, Training Examples tab.
 */
async function loginAndNavigateToTraining(page: import('@playwright/test').Page) {
  await page.goto('/login', { waitUntil: 'networkidle', timeout: 30000 });

  const emailInput = page.getByRole('textbox', { name: 'Email' });
  await emailInput.waitFor({ state: 'visible', timeout: 10000 });
  await emailInput.fill('admin@nexa-erp.dev');

  const passwordInput = page.locator('input[type="password"]');
  await passwordInput.fill('NexaDev2026!');

  const signInButton = page.getByRole('button', { name: /sign in/i });
  await signInButton.waitFor({ state: 'visible' });
  await signInButton.click();

  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 45000,
  });
  await page.waitForLoadState('networkidle');

  // Navigate to knowledge page with training hash
  await spaNavigate(page, '/ai/admin/knowledge#training');

  await expect(
    page.getByRole('heading', { name: 'Knowledge Management' }),
  ).toBeVisible({ timeout: 15000 });

  // Click Training Examples tab to ensure it's active
  const trainingTab = page.getByRole('tab', { name: /training examples/i });
  await trainingTab.click();
  await page.waitForTimeout(1000);
  await page.waitForLoadState('networkidle');
}

test.describe('Journey 11: Training Examples — Filtering', () => {
  test.setTimeout(120_000);

  test('Filter training examples by category, skill key, search, then clear', async ({ page }) => {
    // ── Step 1: Navigate to Training Examples tab ──────────────────────
    await loginAndNavigateToTraining(page);

    // Check for crash
    const hasCrashed = await page
      .locator('text=Something went wrong')
      .isVisible()
      .catch(() => false);

    if (hasCrashed) {
      bugs.push('BUG: Training Examples tab crashes on load.');
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-1-training-tab-crash.png`,
        fullPage: true,
      });
      throw new Error('Training Examples tab crashed on load. Cannot proceed.');
    }

    const trainingTab = page.getByRole('tab', { name: /training examples/i });
    await expect(trainingTab).toHaveAttribute('data-state', 'active');

    // Locate filter controls using aria-labels from the actual component code
    const categoryFilterBtn = page.getByRole('button', { name: /all categories/i })
      .or(page.getByRole('button', { name: /categories/i }));
    const skillKeyInput = page.locator('input[aria-label="Filter by skill key"]');
    const searchInput = page.locator('input[aria-label="Search training examples"]');

    await expect(categoryFilterBtn.first()).toBeVisible({ timeout: 5000 });
    await expect(skillKeyInput).toBeVisible({ timeout: 5000 });
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    // Count total cards before filtering
    await page.waitForTimeout(500);
    const allCards = page.locator('[data-slot="card"]');
    const totalCardCount = await allCards.count();
    console.log(`Total training example cards before filtering: ${totalCardCount}`);

    // Checkpoint 1: Training Tab with Filter Bar
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-training-tab-with-filters.png`,
      fullPage: true,
    });

    // ── Step 2: Filter by Category — TERMINOLOGY ───────────────────────
    await categoryFilterBtn.first().click();
    await page.waitForTimeout(500);

    // The popover uses Radix Popover with Checkbox + label elements
    const popover = page.locator('[data-radix-popper-content-wrapper]');
    await expect(popover).toBeVisible({ timeout: 3000 });

    // Find and click the Terminology checkbox label
    const terminologyLabel = popover.locator('label').filter({ hasText: /Terminology/i });
    const terminologyVisible = await terminologyLabel.isVisible().catch(() => false);

    if (terminologyVisible) {
      await terminologyLabel.click();
      await page.waitForTimeout(300);
    } else {
      // Fallback: try clicking text directly
      const terminologyText = popover.getByText('Terminology');
      const textVisible = await terminologyText.isVisible().catch(() => false);
      if (textVisible) {
        await terminologyText.click();
        await page.waitForTimeout(300);
      } else {
        bugs.push('BUG: Terminology option not found in category filter popover.');
      }
    }

    // Close the popover by pressing Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await page.waitForLoadState('networkidle');

    // After selecting Terminology, button text changes from "All Categories" to "Terminology"
    const terminologyBtn = page.getByRole('button', { name: /terminology/i });
    const btnChanged = await terminologyBtn.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`Category button changed to Terminology: ${btnChanged}`);

    const filteredCards = page.locator('[data-slot="card"]');
    const filteredCount = await filteredCards.count();
    console.log(`Cards after TERMINOLOGY filter: ${filteredCount}`);

    // Checkpoint 2: Category Filter Applied
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-category-terminology-filtered.png`,
      fullPage: true,
    });

    if (filteredCount >= totalCardCount && totalCardCount > 1) {
      bugs.push('BUG: Category filter TERMINOLOGY did not reduce the card count.');
    }

    // ── Step 3: Filter by Skill Key — vat_lookup ───────────────────────
    await skillKeyInput.fill('vat_lookup');
    await page.waitForTimeout(500);
    await page.waitForLoadState('networkidle');

    const skillFilteredCount = await page.locator('[data-slot="card"]').count();
    console.log(`Cards after skill key filter (vat_lookup): ${skillFilteredCount}`);

    // Checkpoint 3: Skill Key Filter Applied
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-skill-key-filtered.png`,
      fullPage: true,
    });

    // ── Step 4: Filter by Search — "reverse charge" ────────────────────
    await searchInput.fill('reverse charge');
    await page.waitForTimeout(500);
    await page.waitForLoadState('networkidle');

    const searchFilteredCount = await page.locator('[data-slot="card"]').count();
    console.log(`Cards after search filter (reverse charge): ${searchFilteredCount}`);

    // Checkpoint 4: Search Filter Applied
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-search-filtered.png`,
      fullPage: true,
    });

    // ── Step 5: Clear all filters ──────────────────────────────────────
    // Clear button only appears when hasActiveFilters is true
    const clearButton = page.getByRole('button', { name: /clear/i });
    const clearVisible = await clearButton.isVisible().catch(() => false);

    if (clearVisible) {
      await clearButton.click();
      await page.waitForTimeout(500);
      await page.waitForLoadState('networkidle');
    } else {
      bugs.push('BUG: Clear filters button not visible when filters are active.');
      // Manually clear filters as fallback
      await skillKeyInput.clear();
      await searchInput.clear();
      await page.waitForTimeout(500);
    }

    const restoredCount = await page.locator('[data-slot="card"]').count();
    console.log(`Cards after clearing filters: ${restoredCount}`);

    // Checkpoint 5: Filters Cleared
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-filters-cleared.png`,
      fullPage: true,
    });

    // Verify list is restored
    if (totalCardCount > 0 && restoredCount === 0) {
      bugs.push('BUG: Clearing filters did not restore the training examples list.');
    }

    // ── Summary ────────────────────────────────────────────────────────
    if (bugs.length > 0) {
      console.error(
        `\nBUGS FOUND (${bugs.length}):\n` + bugs.map((b) => `  - ${b}`).join('\n'),
      );
      throw new Error(
        `${bugs.length} bug(s) found during filtering test:\n` + bugs.join('\n'),
      );
    }
  });
});
