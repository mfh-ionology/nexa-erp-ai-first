import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5d/journey-9';

/** Track bugs found during test execution */
const bugs: string[] = [];

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

  await spaNavigate(page, '/ai/admin/knowledge');

  await expect(
    page.getByRole('heading', { name: 'Knowledge Management' }),
  ).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1000);
}

test.describe('Journey 9: Toggle Article Active/Inactive Status', () => {
  test.setTimeout(120_000);

  test('Toggle article active/inactive via inline switch', async ({ page }) => {
    // ── Step 1: Login, navigate to Knowledge Articles tab ──────────────
    await loginAndNavigateToKnowledge(page);

    // Knowledge Articles tab should be active by default
    const articlesTab = page.getByRole('tab', { name: /knowledge articles/i });
    await expect(articlesTab).toHaveAttribute('data-state', 'active', { timeout: 5000 });

    // Wait for article cards to load
    const firstCard = page.locator('[data-slot="card"]').first();
    await expect(firstCard).toBeVisible({ timeout: 10000 });

    // Checkpoint 1: Articles Tab Loaded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-articles-tab-loaded.png`,
      fullPage: true,
    });

    // ── Step 2: Find and click the active toggle switch on first article ──
    // The switch has aria-label="Toggle active status for {title}"
    const toggleSwitch = firstCard.locator('button[role="switch"]');
    await expect(toggleSwitch).toBeVisible({ timeout: 5000 });

    // Record initial state
    const initialState = await toggleSwitch.getAttribute('data-state');
    const wasChecked = initialState === 'checked';
    console.log(`Initial toggle state: ${initialState} (wasChecked: ${wasChecked})`);

    // Click to toggle (deactivate if active, activate if inactive)
    await toggleSwitch.click();
    await page.waitForTimeout(1500);

    // Verify state flipped
    const afterFirstToggle = await toggleSwitch.getAttribute('data-state');
    const expectedAfterFirst = wasChecked ? 'unchecked' : 'checked';

    if (afterFirstToggle !== expectedAfterFirst) {
      bugs.push(
        `BUG: Toggle did not flip. Expected ${expectedAfterFirst}, got ${afterFirstToggle}`,
      );
    }

    // Check for success toast
    const deactivateToast = page.locator('[data-sonner-toast]').filter({
      hasText: wasChecked ? /deactivated/i : /activated/i,
    });
    const toastVisible = await deactivateToast.first().isVisible().catch(() => false);
    if (!toastVisible) {
      console.warn('No toast notification visible after toggle — may have dismissed quickly.');
    }

    // Checkpoint 2: Article Deactivated (or activated if it was already inactive)
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-article-deactivated.png`,
      fullPage: true,
    });

    // ── Step 3: Click toggle again to restore original state ──────────
    await toggleSwitch.click();
    await page.waitForTimeout(1500);

    // Verify state flipped back to original
    const afterSecondToggle = await toggleSwitch.getAttribute('data-state');

    if (afterSecondToggle !== initialState) {
      bugs.push(
        `BUG: Toggle did not flip back. Expected ${initialState}, got ${afterSecondToggle}`,
      );
    }

    // Check for success toast
    const reactivateToast = page.locator('[data-sonner-toast]').filter({
      hasText: wasChecked ? /activated/i : /deactivated/i,
    });
    const reactivateToastVisible = await reactivateToast
      .first()
      .isVisible()
      .catch(() => false);
    if (!reactivateToastVisible) {
      console.warn('No toast notification visible after re-toggle.');
    }

    // Checkpoint 3: Article Reactivated
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-article-reactivated.png`,
      fullPage: true,
    });

    // ── Summary ──────────────────────────────────────────────────────────
    if (bugs.length > 0) {
      console.error(
        `\nBUGS FOUND (${bugs.length}):\n` + bugs.map((b) => `  - ${b}`).join('\n'),
      );
      throw new Error(
        `${bugs.length} bug(s) found during article toggle:\n` + bugs.join('\n'),
      );
    }
  });
});
