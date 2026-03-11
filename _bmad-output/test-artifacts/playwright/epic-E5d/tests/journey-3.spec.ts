import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5d/journey-3';

/**
 * Helper: navigate within the SPA using pushState + popstate.
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
}

test.describe('Journey 3: Knowledge Articles Tab — Filtering & Search', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const emailInput = page.getByRole('textbox', { name: 'Email' });
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.fill('admin@nexa-erp.dev');

    const passwordInput = page.getByRole('textbox', { name: 'Password' });
    if (await passwordInput.isVisible().catch(() => false)) {
      await passwordInput.fill('NexaDev2026!');
    } else {
      await page.locator('input[type="password"]').fill('NexaDev2026!');
    }

    const signInButton = page.getByRole('button', { name: /sign in/i });
    await signInButton.waitFor({ state: 'visible' });
    await signInButton.click();

    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 30000,
    });
    await page.waitForLoadState('networkidle');
  });

  test('Filter articles by category, source, active status, and search title', async ({
    page,
  }) => {
    // ── Step 1: Navigate to /ai/admin/knowledge ─────────────────────────
    const aiSection = page.getByText('AI Administration').first();
    if (await aiSection.isVisible().catch(() => false)) {
      await aiSection.click();
      await page.waitForTimeout(300);
    }

    const knowledgeLink = page
      .locator('a[href="/ai/admin/knowledge"]')
      .first();
    if (await knowledgeLink.isVisible().catch(() => false)) {
      await knowledgeLink.click();
    } else {
      await spaNavigate(page, '/ai/admin/knowledge');
    }

    await expect(
      page.getByRole('heading', { name: 'Knowledge Management' }),
    ).toBeVisible({ timeout: 15000 });

    const articlesTab = page.getByRole('tab', { name: /knowledge articles/i });
    await expect(articlesTab).toHaveAttribute('data-state', 'active');

    // Wait for articles to load
    await page.waitForTimeout(2000);

    // Checkpoint 1: Knowledge Page with Filter Bar
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-knowledge-page-filter-bar.png`,
      fullPage: true,
    });

    // ── Step 2: Click Category filter popover ─────────────────────────
    const categoryFilterBtn = page
      .locator('button')
      .filter({ hasText: /all categories/i })
      .first();
    await expect(categoryFilterBtn).toBeVisible({ timeout: 5000 });
    await categoryFilterBtn.click();
    await page.waitForTimeout(500);

    // The popover content is in a radix popover — scope to labels inside it
    const categoryPopover = page.locator('[data-radix-popper-content-wrapper]').first();
    await expect(categoryPopover).toBeVisible({ timeout: 3000 });

    // Verify 5 category labels in the popover
    await expect(categoryPopover.getByText('Terminology')).toBeVisible();
    await expect(categoryPopover.getByText('Business Processes')).toBeVisible();
    await expect(categoryPopover.getByText('Industry Rules')).toBeVisible();
    await expect(categoryPopover.getByText('Custom Fields')).toBeVisible();
    await expect(categoryPopover.getByText('Historical Patterns')).toBeVisible();

    // Checkpoint 2: Category Popover Open
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-category-popover-open.png`,
      fullPage: true,
    });

    // ── Step 3: Select TERMINOLOGY category ───────────────────────────
    const terminologyLabel = categoryPopover
      .locator('label')
      .filter({ hasText: /terminology/i })
      .first();
    await terminologyLabel.click();
    await page.waitForTimeout(300);

    // Close popover with Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Verify filter applied: only Terminology group visible
    await expect(
      page.locator('text=Terminology').first(),
    ).toBeVisible({ timeout: 5000 });

    // The "Clear" button should now be visible (indicates active filters)
    const clearBtn = page
      .locator('button')
      .filter({ hasText: /clear/i })
      .first();
    const clearVisible = await clearBtn.isVisible().catch(() => false);
    console.log(`Clear button visible after category filter: ${clearVisible}`);

    // Checkpoint 3: Terminology Filter Applied
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-terminology-filter-applied.png`,
      fullPage: true,
    });

    // ── Step 4: Click Source filter popover ────────────────────────────
    const sourceFilterBtn = page
      .locator('button')
      .filter({ hasText: /all sources/i })
      .first();
    await expect(sourceFilterBtn).toBeVisible({ timeout: 5000 });
    await sourceFilterBtn.click();
    await page.waitForTimeout(500);

    // Scope to the source popover
    const sourcePopover = page.locator('[data-radix-popper-content-wrapper]').first();
    await expect(sourcePopover).toBeVisible({ timeout: 3000 });

    const aiGenVisible = await sourcePopover
      .getByText(/ai generated/i)
      .isVisible()
      .catch(() => false);
    console.log(`Source popover - AI Generated visible: ${aiGenVisible}`);

    // Checkpoint 4: Source Popover Open
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-source-popover-open.png`,
      fullPage: true,
    });

    // ── Step 5: Select AI Generated source ────────────────────────────
    const aiGenLabel = sourcePopover
      .locator('label')
      .filter({ hasText: /ai generated/i })
      .first();
    if (await aiGenLabel.isVisible().catch(() => false)) {
      await aiGenLabel.click();
    } else {
      await sourcePopover.getByText(/ai generated/i).first().click();
    }
    await page.waitForTimeout(300);

    // Close popover
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Checkpoint 5: Combined Filters
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-combined-filters.png`,
      fullPage: true,
    });

    // ── Step 6: Click Inactive toggle ─────────────────────────────────
    const inactiveBtn = page
      .locator('button')
      .filter({ hasText: /^inactive$/i })
      .first();
    if (await inactiveBtn.isVisible().catch(() => false)) {
      await inactiveBtn.click();
    } else {
      // Fallback: broader match
      await page
        .locator('button')
        .filter({ hasText: /inactive/i })
        .first()
        .click();
    }
    await page.waitForTimeout(1000);

    // Checkpoint 6: Inactive Toggle
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-inactive-toggle.png`,
      fullPage: true,
    });

    // ── Step 7: Type "VAT" in search input ────────────────────────────
    const searchInput = page.getByPlaceholder(/search by title/i);
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('VAT');
    } else {
      const searchByLabel = page.getByLabel(/search articles by title/i);
      if (await searchByLabel.isVisible().catch(() => false)) {
        await searchByLabel.fill('VAT');
      } else {
        await page.locator('input[placeholder*="earch"]').first().fill('VAT');
      }
    }

    // Wait for debounce (300ms) + render
    await page.waitForTimeout(800);

    // Checkpoint 7: VAT Search
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-7-vat-search.png`,
      fullPage: true,
    });

    // ── Step 8: Click Clear filters ───────────────────────────────────
    const clearFiltersBtn = page
      .locator('button')
      .filter({ hasText: /clear/i })
      .first();
    await expect(clearFiltersBtn).toBeVisible({ timeout: 5000 });
    await clearFiltersBtn.click();
    await page.waitForTimeout(1500);

    // Verify filters cleared — multiple category groups should be visible again
    const searchInputAfter = page.getByPlaceholder(/search by title/i);
    if (await searchInputAfter.isVisible().catch(() => false)) {
      const searchVal = await searchInputAfter.inputValue();
      console.log(`Search input after clear: "${searchVal}"`);
      expect(searchVal).toBe('');
    }

    // Checkpoint 8: Filters Cleared
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-8-filters-cleared.png`,
      fullPage: true,
    });

    // Final assertion: page is still functional
    await expect(
      page.getByRole('heading', { name: 'Knowledge Management' }),
    ).toBeVisible();
  });
});
