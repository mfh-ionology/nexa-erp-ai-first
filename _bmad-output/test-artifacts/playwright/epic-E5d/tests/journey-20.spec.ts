import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5d/journey-20';

/**
 * Helper: SPA navigate without losing auth tokens (Zustand in-memory).
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
 * Helper: login and navigate to Knowledge Management page.
 */
async function loginAndNavigateToKnowledge(page: import('@playwright/test').Page) {
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

  // SPA-navigate to Knowledge Management (preserves auth tokens)
  await spaNavigate(page, '/ai/admin/knowledge');

  await expect(
    page.getByRole('heading', { name: 'Knowledge Management' }),
  ).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1000);
}

test.describe('Journey 20: Stats Panel — Pending Reviews Clickable Card', () => {
  test.setTimeout(120_000);

  test('Clicking Pending Reviews KPI card filters articles to unconfirmed items', async ({
    page,
  }) => {
    // ── Step 1: Login and navigate to /ai/admin/knowledge ─────────────
    await loginAndNavigateToKnowledge(page);

    // Verify stats panel is visible with Pending Reviews card
    const pendingReviewsCard = page.getByText('Pending Reviews').first();
    await expect(pendingReviewsCard).toBeVisible({ timeout: 5000 });

    // Verify Knowledge Articles tab is active by default
    const articlesTab = page.getByRole('tab', { name: /knowledge articles/i });
    await expect(articlesTab).toHaveAttribute('data-state', 'active');

    // Checkpoint 1: Page loaded with stats panel
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-page-loaded.png`,
      fullPage: true,
    });

    // ── Step 2: Click Pending Reviews KPI card ────────────────────────
    // The Pending Reviews card should be clickable — find the clickable container
    const pendingReviewsClickable = page
      .locator('[class*="card"], [role="button"], button, a')
      .filter({ hasText: 'Pending Reviews' })
      .first();

    const isClickable = await pendingReviewsClickable
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (!isClickable) {
      // Fallback: try clicking the text itself
      await pendingReviewsCard.click();
    } else {
      await pendingReviewsClickable.click();
    }

    await page.waitForTimeout(1500);
    await page.waitForLoadState('networkidle');

    // Verify Knowledge Articles tab is still/now active
    await expect(articlesTab).toHaveAttribute('data-state', 'active', {
      timeout: 5000,
    });

    // Verify the "Showing only articles pending review" filter banner appears
    const filterBanner = page.getByText(/showing only articles pending review/i);
    await expect(filterBanner).toBeVisible({ timeout: 5000 });

    // Verify "Clear filter" button is visible
    const clearFilterButton = page.getByText(/clear filter/i);
    await expect(clearFilterButton).toBeVisible({ timeout: 3000 });

    // Verify filtered articles show "Needs Review" badges
    const needsReviewBadges = page.getByText('Needs Review');
    const badgeCount = await needsReviewBadges.count();
    expect(badgeCount).toBeGreaterThan(0);

    console.log(`Filter banner visible: true`);
    console.log(`Clear filter button visible: true`);
    console.log(`Needs Review badges count: ${badgeCount}`);

    // Checkpoint 2: After clicking Pending Reviews — filter applied
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-pending-reviews-filtered.png`,
      fullPage: true,
    });

    console.log('\n--- Journey 20 Summary ---');
    console.log(`Page loaded: true`);
    console.log(`Pending Reviews card visible: true`);
    console.log(`Filter applied after click: true`);
  });
});
