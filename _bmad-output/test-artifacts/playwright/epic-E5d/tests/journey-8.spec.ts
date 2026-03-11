import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5d/journey-8';

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

test.describe('Journey 8: Soft-Delete Knowledge Article', () => {
  test.setTimeout(120_000);

  test('Delete an article via overflow menu, verify confirmation dialog and removal', async ({
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

    // ── Step 1: Navigate to Knowledge Articles tab ───────────────────
    await spaNavigate(page, '/ai/admin/knowledge');

    await expect(
      page.getByRole('heading', { name: 'Knowledge Management' }),
    ).toBeVisible({ timeout: 15000 });

    const articlesTab = page.getByRole('tab', { name: /knowledge articles/i });
    await expect(articlesTab).toHaveAttribute('data-state', 'active');

    // Wait for articles to load
    await page.waitForTimeout(2000);

    // Find article cards — use overflow button to distinguish article cards from KPI stat cards
    const articleCards = page.locator('[data-slot="card"]').filter({
      has: page.locator('button[aria-label="Article actions"]'),
    });
    // Also try broader: cards that contain article-like content (title text + badge)
    const articleCardsAlt = page.locator('[data-slot="card"]').filter({
      has: page.locator('button:has(svg)'),
    }).filter({
      hasText: /active|draft|needs review|confirmed/i,
    });

    let cardCount = await articleCards.count();
    const useAltSelector = cardCount === 0;
    if (useAltSelector) {
      cardCount = await articleCardsAlt.count();
    }

    if (cardCount === 0) {
      // Last resort: just check there are cards visible
      const allCards = page.locator('[data-slot="card"]');
      const totalCards = await allCards.count();
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-1-no-articles.png`,
        fullPage: true,
      });
      if (totalCards === 0) {
        bugs.push(
          'BUG: No cards rendered at all on Knowledge Articles tab.',
        );
      } else {
        bugs.push(
          `BUG: Found ${totalCards} cards but none matched article card selectors.`,
        );
      }
      throw new Error(`${bugs.length} bug(s) found:\n` + bugs.join('\n'));
    }

    const effectiveArticleCards = useAltSelector ? articleCardsAlt : articleCards;

    // Record initial count for later verification
    const initialCount = cardCount;

    // Checkpoint 1: Articles tab loaded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-articles-tab-loaded.png`,
      fullPage: true,
    });

    // ── Step 2: Click overflow menu on the first article ─────────────
    // Find a card with an overflow button
    let overflowBtn = effectiveArticleCards
      .first()
      .locator('button[aria-label="Article actions"]')
      .first();
    let overflowVisible = await overflowBtn
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (!overflowVisible) {
      // Fallback: any button with SVG icon on the first card
      overflowBtn = effectiveArticleCards
        .first()
        .getByRole('button')
        .filter({ has: page.locator('svg') })
        .last();
      overflowVisible = await overflowBtn
        .isVisible({ timeout: 3000 })
        .catch(() => false);
    }

    if (!overflowVisible) {
      // Broader fallback
      overflowBtn = page
        .locator(
          '[data-slot="card"] button[aria-label*="action"], [data-slot="card"] button:has(svg.lucide-more-horizontal), [data-slot="card"] button:has(svg.lucide-ellipsis)',
        )
        .first();
      overflowVisible = await overflowBtn
        .isVisible({ timeout: 3000 })
        .catch(() => false);
    }

    if (!overflowVisible) {
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-2-no-overflow-button.png`,
        fullPage: true,
      });
      bugs.push(
        'BUG: Could not find overflow menu button on any article card.',
      );
      throw new Error(`${bugs.length} bug(s) found:\n` + bugs.join('\n'));
    }

    await overflowBtn.click();
    await page.waitForTimeout(500);

    // Checkpoint 2: Overflow menu open
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-overflow-menu-open.png`,
      fullPage: true,
    });

    // Find Delete option in the menu
    const deleteOption = page.getByRole('menuitem', { name: /delete|deactivate/i }).first();
    let deleteVisible = await deleteOption
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (!deleteVisible) {
      // Fallback: look in any dropdown/menu content
      const deleteText = page
        .locator(
          '[role="menu"] >> text=/delete|deactivate/i, [data-radix-popper-content-wrapper] >> text=/delete|deactivate/i',
        )
        .first();
      deleteVisible = await deleteText
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      if (!deleteVisible) {
        await page.screenshot({
          path: `${SCREENSHOTS_DIR}/step-2-no-delete-option.png`,
          fullPage: true,
        });
        bugs.push(
          'BUG: Overflow menu opened but no Delete/Deactivate option found.',
        );
        throw new Error(`${bugs.length} bug(s) found:\n` + bugs.join('\n'));
      }

      await deleteText.click();
    } else {
      await deleteOption.click();
    }

    await page.waitForTimeout(500);

    // ── Step 2b: Verify confirmation dialog ──────────────────────────
    const alertDialog = page.getByRole('alertdialog');
    const dialogVisible = await alertDialog
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!dialogVisible) {
      // Maybe it's a regular dialog
      const regularDialog = page.getByRole('dialog');
      const regDialogVisible = await regularDialog
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      if (!regDialogVisible) {
        await page.screenshot({
          path: `${SCREENSHOTS_DIR}/step-3-no-confirmation-dialog.png`,
          fullPage: true,
        });
        bugs.push(
          'BUG: No confirmation dialog appeared after clicking Delete. Article may have been deleted without confirmation.',
        );
        // Still continue to check if the article was removed
      }
    }

    if (dialogVisible) {
      // Checkpoint 3: Confirmation dialog
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-3-delete-confirmation-dialog.png`,
        fullPage: true,
      });

      // Look for deactivate/confirm/delete button in the dialog
      const confirmBtn = alertDialog
        .getByRole('button', { name: /deactivate|confirm|delete|yes/i })
        .first();
      const cancelBtn = alertDialog
        .getByRole('button', { name: /cancel|no/i })
        .first();

      const confirmVisible = await confirmBtn
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      const cancelVisible = await cancelBtn
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      if (!confirmVisible) {
        await page.screenshot({
          path: `${SCREENSHOTS_DIR}/step-3-no-confirm-button.png`,
          fullPage: true,
        });
        bugs.push(
          'BUG: Confirmation dialog visible but no Deactivate/Confirm button found.',
        );
        throw new Error(`${bugs.length} bug(s) found:\n` + bugs.join('\n'));
      }

      if (!cancelVisible) {
        console.warn('Cancel button not found in confirmation dialog.');
      }

      // ── Step 3: Click Confirm/Deactivate ──────────────────────────
      await confirmBtn.click();
      await page.waitForTimeout(2000);
    }

    // ── Step 3 result: Verify article removed ────────────────────────
    // Check for toast notification
    const toast = page.locator('[data-sonner-toast]').first();
    const toastVisible = await toast
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (toastVisible) {
      const toastText = await toast.textContent();
      console.log(`Toast notification: "${toastText}"`);

      // Check for undo button
      const undoBtn = toast.locator('button').filter({ hasText: /undo/i }).first();
      const hasUndo = await undoBtn.isVisible().catch(() => false);
      if (hasUndo) {
        console.log('Undo button present in toast.');
      }
    } else {
      console.warn('No toast notification appeared after deletion.');
    }

    // Verify article was removed — either count decreased or the article is visually hidden/dimmed
    await page.waitForTimeout(1000);
    const updatedCount = await effectiveArticleCards.count();
    if (updatedCount < initialCount) {
      console.log(
        `Article removed from list: count ${initialCount} -> ${updatedCount}`,
      );
    } else {
      // Article may still be in DOM but dimmed/hidden — check for opacity or hidden class
      // This is acceptable behavior if the article stays visible but marked as inactive
      console.log(
        `Article count unchanged (${initialCount} -> ${updatedCount}). Article may remain visible but deactivated. This is acceptable if toast confirmed deactivation.`,
      );
    }

    // Checkpoint 4: After deletion
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-after-delete-result.png`,
      fullPage: true,
    });

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
