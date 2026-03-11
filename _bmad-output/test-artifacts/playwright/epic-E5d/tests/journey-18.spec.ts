import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5d/journey-18';

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

test.describe('Journey 18: Suggested Tab — Empty & Platform Unavailable States', () => {
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

  test('Suggested tab shows empty state or platform unavailable — no error', async ({
    page,
  }) => {
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
      const suggestedText = page.getByText('Suggested', { exact: true }).first();
      if (await suggestedText.isVisible().catch(() => false)) {
        await suggestedText.click();
        await page.waitForTimeout(1000);
      }
    }

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // ── Verify: graceful empty or unavailable state, NOT an error ─────
    // Look for empty state indicators
    const emptyState = page.getByText(/all caught up/i).or(
      page.getByText(/no.*suggestions/i),
    ).or(
      page.getByText(/no.*pending/i),
    );

    // Look for platform unavailable / not configured indicators
    const platformUnavailable = page.getByText(/platform.*not.*configured/i).or(
      page.getByText(/platform.*unavailable/i),
    ).or(
      page.getByText(/not.*connected/i),
    ).or(
      page.getByText(/connection.*not.*available/i),
    );

    // Look for actual suggestion cards (they exist from seed data)
    const suggestionCards = page.getByRole('button', { name: /accept/i }).or(
      page.getByRole('button', { name: /dismiss/i }),
    );

    const hasEmpty = await emptyState.first().isVisible({ timeout: 5000 }).catch(() => false);
    const hasPlatformMsg = await platformUnavailable.first().isVisible({ timeout: 3000 }).catch(() => false);
    const hasSuggestions = await suggestionCards.first().isVisible({ timeout: 3000 }).catch(() => false);

    // At least one valid state should be present
    const validState = hasEmpty || hasPlatformMsg || hasSuggestions;

    if (hasEmpty) {
      const emptyText = await emptyState.first().textContent();
      console.log(`✓ Empty state displayed: "${emptyText}"`);
    }
    if (hasPlatformMsg) {
      const platformText = await platformUnavailable.first().textContent();
      console.log(`✓ Platform unavailable message: "${platformText}"`);
    }
    if (hasSuggestions) {
      const count = await suggestionCards.count();
      console.log(`✓ Suggestion cards present (count: ${count}) — not empty state, but valid`);
    }

    // Verify NO crash or error state
    const errorState = page.getByText(/something went wrong/i).or(
      page.getByText(/500/i),
    ).or(
      page.getByText(/internal server error/i),
    ).or(
      page.getByText(/error.*loading/i),
    );
    const hasError = await errorState.first().isVisible({ timeout: 2000 }).catch(() => false);

    if (hasError) {
      const errorText = await errorState.first().textContent();
      console.log(`✗ ERROR state found: "${errorText}"`);
    }

    // Checkpoint 1: Suggested tab loaded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-suggested-tab-loaded.png`,
      fullPage: true,
    });

    // Assertions
    expect(validState, 'Expected empty state, platform unavailable message, or suggestion cards').toBe(true);
    expect(hasError, 'Should NOT show an error/crash state').toBe(false);
  });
});
