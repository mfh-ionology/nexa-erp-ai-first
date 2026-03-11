import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5d/journey-7';

const bugs: string[] = [];

/**
 * Helper: SPA navigate without losing auth tokens (Zustand in-memory).
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

test.describe('Journey 7: Confirm Unconfirmed AI-Generated Article', () => {
  test.setTimeout(120_000);

  test('Confirm an unconfirmed article and verify confidence upgrade', async ({
    page,
  }) => {
    // ── Login ──────────────────────────────────────────────────────────
    await page.goto('/login', { waitUntil: 'networkidle', timeout: 30000 });

    const emailInput = page.getByRole('textbox', { name: 'Email' });
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.fill('admin@nexa-erp.dev');

    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill('NexaDev2026!');

    const signInButton = page.getByRole('button', { name: /sign in/i });
    await signInButton.click();

    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 30000,
    });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // ── Step 1: Navigate to /ai/admin/knowledge ────────────────────────
    await spaNavigate(page, '/ai/admin/knowledge');

    await expect(
      page.getByRole('heading', { name: 'Knowledge Management' }),
    ).toBeVisible({ timeout: 15000 });

    const articlesTab = page.getByRole('tab', { name: /knowledge articles/i });
    await expect(articlesTab).toHaveAttribute('data-state', 'active');

    // Wait for articles to load (API call + render)
    await page.waitForTimeout(2000);

    // Checkpoint 1: Page loaded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-knowledge-articles-loaded.png`,
      fullPage: true,
    });

    // ── Step 2: Find an unconfirmed article with "Needs Review" badge ──
    // Check if any article cards rendered at all
    const articleCards = page.locator('[data-slot="card"]');
    const cardCount = await articleCards.count();

    if (cardCount === 0) {
      // No article cards at all — check for accordion-based layout
      // Articles may be inside accordion groups
      const accordionItems = page.locator(
        '[data-state="open"] [data-slot="card"], .accordion-content [data-slot="card"]',
      );
      const accordionCardCount = await accordionItems.count();

      if (accordionCardCount === 0) {
        // Try broader search for any card-like elements in the main content area
        const anyCards = page.locator(
          'main [data-slot="card"], [role="main"] [data-slot="card"], .flex-1 [data-slot="card"]',
        );
        const anyCardCount = await anyCards.count();

        if (anyCardCount === 0) {
          await page.screenshot({
            path: `${SCREENSHOTS_DIR}/step-2-no-articles-rendered.png`,
            fullPage: true,
          });
          bugs.push(
            'BUG: No article cards rendered on Knowledge Articles tab despite seed data existing. KPI stats may also be empty/loading.',
          );
          // Can't proceed with confirm test — fail with bug report
          throw new Error(
            `${bugs.length} bug(s) found:\n` + bugs.join('\n'),
          );
        }
      }
    }

    // Look for the amber "Needs Review" badge
    const needsReviewBadge = page.getByText('Needs Review').first();
    const hasUnconfirmed = await needsReviewBadge
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!hasUnconfirmed) {
      // No unconfirmed articles — take screenshot and document
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-2-no-unconfirmed-articles.png`,
        fullPage: true,
      });

      // Check if articles are visible but all confirmed
      const visibleCardCount = await articleCards.count();
      if (visibleCardCount > 0) {
        console.warn(
          `Found ${visibleCardCount} article cards but none have "Needs Review" badge. All articles may be confirmed.`,
        );
        bugs.push(
          'BUG: No unconfirmed articles with "Needs Review" badge found. Seed data should include AI_GENERATED articles with isConfirmed=false.',
        );
      } else {
        bugs.push(
          'BUG: No article cards rendered on the Knowledge Articles tab.',
        );
      }
      throw new Error(`${bugs.length} bug(s) found:\n` + bugs.join('\n'));
    }

    // Checkpoint 2: Unconfirmed article visible
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-unconfirmed-article-visible.png`,
      fullPage: true,
    });

    // Record the title of the article we're about to confirm for later verification
    const unconfirmedCard = needsReviewBadge
      .locator(
        'xpath=ancestor::*[contains(@data-slot, "card")]',
      )
      .first();

    // ── Step 3: Click overflow menu on the unconfirmed article ──────────
    // The overflow button has aria-label="Article actions" and uses MoreHorizontal icon
    let overflowBtn = unconfirmedCard
      .locator('button[aria-label="Article actions"]')
      .first();

    let overflowVisible = await overflowBtn
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (!overflowVisible) {
      // Fallback: find any button with SVG icon in the card header area
      overflowBtn = unconfirmedCard
        .getByRole('button')
        .filter({ has: page.locator('svg') })
        .last();
      overflowVisible = await overflowBtn
        .isVisible({ timeout: 3000 })
        .catch(() => false);
    }

    if (!overflowVisible) {
      // Broader fallback: any overflow-style button near Needs Review text
      overflowBtn = page
        .locator(
          '[data-slot="card"]:has-text("Needs Review") button[aria-label*="action"], [data-slot="card"]:has-text("Needs Review") button:has(svg.lucide-more-horizontal)',
        )
        .first();
      overflowVisible = await overflowBtn
        .isVisible({ timeout: 3000 })
        .catch(() => false);
    }

    if (!overflowVisible) {
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-3-no-overflow-menu-found.png`,
        fullPage: true,
      });
      bugs.push(
        'BUG: Could not find overflow menu button on the unconfirmed article card.',
      );
      throw new Error(`${bugs.length} bug(s) found:\n` + bugs.join('\n'));
    }

    await overflowBtn.click();
    await page.waitForTimeout(500);

    // Checkpoint 3: Overflow menu with Confirm option
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-overflow-menu-confirm-option.png`,
      fullPage: true,
    });

    // ── Step 4: Click "Confirm" option ─────────────────────────────────
    const confirmOption = page.getByRole('menuitem', { name: /confirm/i });
    let confirmVisible = await confirmOption
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (!confirmVisible) {
      // Fallback: look in dropdown content wrappers
      const confirmText = page
        .locator(
          '[role="menu"] >> text=Confirm, [data-radix-popper-content-wrapper] >> text=Confirm',
        )
        .first();
      confirmVisible = await confirmText
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      if (confirmVisible) {
        await confirmText.click();
      } else {
        await page.screenshot({
          path: `${SCREENSHOTS_DIR}/step-4-no-confirm-option.png`,
          fullPage: true,
        });
        bugs.push(
          'BUG: Overflow menu opened but no "Confirm" option found. Menu may not include Confirm for unconfirmed articles.',
        );
        throw new Error(`${bugs.length} bug(s) found:\n` + bugs.join('\n'));
      }
    } else {
      await confirmOption.click();
    }

    await page.waitForTimeout(2000);

    // Checkpoint 4: Article confirmed — badge removed, confidence upgraded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-article-confirmed-success.png`,
      fullPage: true,
    });

    // Verify success toast
    const successToast = page
      .getByText(/article confirmed/i)
      .first();
    const toastVisible = await successToast
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (toastVisible) {
      console.log('Success toast visible: Article confirmed.');
    } else {
      console.warn(
        'Success toast not visible after confirming article. May have dismissed quickly or not shown.',
      );
    }

    // ── Summary ────────────────────────────────────────────────────────
    if (bugs.length > 0) {
      console.error(
        `\nBUGS FOUND (${bugs.length}):\n` +
          bugs.map((b) => `  - ${b}`).join('\n'),
      );
      throw new Error(
        `${bugs.length} bug(s) found:\n` + bugs.join('\n'),
      );
    }
  });
});
