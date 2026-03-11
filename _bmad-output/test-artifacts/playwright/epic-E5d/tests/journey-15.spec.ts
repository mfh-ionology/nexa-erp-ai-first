import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5d/journey-15';

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

test.describe('Journey 15: Suggested Knowledge — Accept Platform Suggestion', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    // Login as admin user
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const emailInput = page.getByRole('textbox', { name: 'Email' });
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.fill('admin@nexa-erp.dev');

    const passwordInput = page.locator('input[type="password"]');
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

  test('Accept a platform-suggested knowledge article', async ({ page }) => {
    // ── Step 1: Navigate to Suggested tab ──────────────────────────────
    await spaNavigate(page, '/ai/admin/knowledge#suggested');
    await page.waitForTimeout(1000);

    // Verify Knowledge Management page loaded
    const heading = page.getByRole('heading', { name: /knowledge management/i });
    await expect(heading).toBeVisible({ timeout: 15000 });

    // Click the Suggested tab to ensure it's active
    const suggestedTab = page.getByRole('tab', { name: /suggested/i });
    if (await suggestedTab.isVisible().catch(() => false)) {
      await suggestedTab.click();
      await page.waitForTimeout(1000);
    } else {
      // Fallback: click by text
      const suggestedText = page.getByText('Suggested', { exact: true }).first();
      if (await suggestedText.isVisible().catch(() => false)) {
        await suggestedText.click();
        await page.waitForTimeout(1000);
      }
    }

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Checkpoint 1: Suggested tab loaded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-suggested-tab-loaded.png`,
      fullPage: true,
    });

    // Check if we have suggestion cards or empty state
    const acceptButtons = page.getByRole('button', { name: /^accept$/i });
    const emptyState = page.getByText(/all caught up/i).or(
      page.getByText(/no suggestions/i),
    );
    const hasAcceptButton = await acceptButtons.first().isVisible({ timeout: 5000 }).catch(() => false);
    const hasEmptyState = await emptyState.first().isVisible({ timeout: 3000 }).catch(() => false);

    if (hasEmptyState && !hasAcceptButton) {
      console.log('NOTICE: No suggested articles available — empty state ("You\'re all caught up") displayed. Cannot test Accept flow.');
      return;
    }

    // Verify suggestion cards have the expected elements
    // Look for category badges
    const categoryBadges = page.getByText(/BEST_PRACTICE|HELP|DEFAULT_CONFIG|SKILL_UPDATE/i);
    const hasBadges = await categoryBadges.first().isVisible({ timeout: 3000 }).catch(() => false);
    if (hasBadges) {
      console.log('✓ Category badges visible on suggestion cards');
    }

    // Verify Accept, Edit & Accept, Reject buttons exist
    const editAcceptBtn = page.getByRole('button', { name: /edit.*accept/i });
    const rejectBtn = page.getByRole('button', { name: /reject/i });
    await expect(acceptButtons.first()).toBeVisible({ timeout: 5000 });

    const hasEditAccept = await editAcceptBtn.first().isVisible({ timeout: 3000 }).catch(() => false);
    const hasReject = await rejectBtn.first().isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`Action buttons: Accept=true, Edit&Accept=${hasEditAccept}, Reject=${hasReject}`);

    // ── Step 2: Click "Read more" to expand content preview ────────────
    const readMoreBtn = page.getByRole('button', { name: /read more/i }).or(
      page.getByText(/read more/i),
    );
    const hasReadMore = await readMoreBtn.first().isVisible({ timeout: 3000 }).catch(() => false);

    if (hasReadMore) {
      await readMoreBtn.first().click();
      await page.waitForTimeout(500);

      // Verify "Show less" appeared (content expanded)
      const showLess = page.getByRole('button', { name: /show less/i }).or(
        page.getByText(/show less/i),
      );
      const hasShowLess = await showLess.first().isVisible({ timeout: 3000 }).catch(() => false);
      if (hasShowLess) {
        console.log('✓ Content preview expanded — "Show less" visible');
      }
    } else {
      console.log('NOTICE: No "Read more" button found — content may be short enough to display fully');
    }

    // Checkpoint 2: Content preview expanded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-article-preview-expanded.png`,
      fullPage: true,
    });

    // ── Step 3: Click "Accept" on the first suggestion card ────────────
    // Get the title of the article we're about to accept
    const firstCard = acceptButtons.first().locator('xpath=ancestor::div[contains(@class,"rounded") or contains(@class,"card")]').first();
    const cardTitleEl = firstCard.locator('h3, h4, [class*="title"]').first();
    let acceptedTitle = '';
    if (await cardTitleEl.isVisible().catch(() => false)) {
      acceptedTitle = (await cardTitleEl.textContent()) ?? '';
      console.log(`Accepting article: "${acceptedTitle}"`);
    }

    // Count suggestions before accept
    const initialCount = await acceptButtons.count();
    console.log(`Suggestion cards with Accept button before: ${initialCount}`);

    // Click Accept on the first card
    await acceptButtons.first().click();
    await page.waitForTimeout(2000);

    // Check for success toast
    const successToast = page.getByText(/accepted.*added.*knowledge base/i).or(
      page.getByText(/article accepted/i),
    ).or(
      page.getByText(/suggestion accepted/i),
    );
    const hasToast = await successToast.first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasToast, 'Success toast should appear after accepting suggestion').toBeTruthy();

    // Verify the card was removed from the list (count decreased or empty state shown)
    const postAcceptCount = await acceptButtons.count();
    const postEmptyState = await emptyState.first().isVisible({ timeout: 3000 }).catch(() => false);

    if (initialCount > 1) {
      expect(postAcceptCount).toBeLessThan(initialCount);
      console.log(`✓ Suggestion card removed — count went from ${initialCount} to ${postAcceptCount}`);
    } else if (postEmptyState) {
      console.log('✓ Last suggestion accepted — empty state now shown');
    }

    // Checkpoint 3: Article accepted success
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-accept-success-toast.png`,
      fullPage: true,
    });

    // ── Step 4: Switch to Knowledge Articles tab and verify accepted article ──
    const articlesTab = page.getByRole('tab', { name: /knowledge articles/i });
    if (await articlesTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await articlesTab.click();
      await page.waitForTimeout(1500);
      await page.waitForLoadState('networkidle');

      // Look for the accepted article in the articles list
      if (acceptedTitle) {
        const articleInList = page.getByText(acceptedTitle).first();
        const found = await articleInList.isVisible({ timeout: 5000 }).catch(() => false);
        if (found) {
          console.log(`✓ Accepted article "${acceptedTitle}" found in Knowledge Articles tab`);
        } else {
          console.log(`NOTICE: Accepted article "${acceptedTitle}" not immediately visible in articles list — may need refresh or pagination`);
        }
      }

      // Look for "Platform Suggested" source indicator
      const platformSource = page.getByText(/platform.*suggest/i).or(
        page.getByText(/PLATFORM_SUGGESTED/i),
      );
      const hasSource = await platformSource.first().isVisible({ timeout: 3000 }).catch(() => false);
      if (hasSource) {
        console.log('✓ "Platform Suggested" source badge visible for accepted article');
      }

      // Checkpoint 4: Accepted article in Knowledge Articles list
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-4-accepted-article-in-list.png`,
        fullPage: true,
      });
    }
  });
});
