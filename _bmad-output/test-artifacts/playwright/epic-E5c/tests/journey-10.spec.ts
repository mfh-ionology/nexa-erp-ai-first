import path from 'path';
import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR = path.resolve(__dirname, '..', '..', '..', 'screenshots', 'epic-E5c', 'journey-10');

/**
 * Helper: navigate within the SPA using TanStack Router.
 * Auth tokens are in-memory only (Zustand), so page.goto() would
 * cause a full reload and lose the authenticated session.
 */
async function spaNavigate(page: import('@playwright/test').Page, path: string) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await page.waitForTimeout(500);
  await page.waitForLoadState('networkidle');
}

test.describe('Journey 10: Skill Pack Manager — View, Search, and Toggle', () => {
  test.setTimeout(90_000);

  test.beforeEach(async ({ page }) => {
    // Login as admin user
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const emailInput = page.getByLabel('Email');
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.fill('admin@nexa-erp.dev');

    const passwordInput = page.getByLabel('Password');
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

  test('View skills grouped by module, search, and toggle activation', async ({ page }) => {
    // ── Step 1: Navigate to /ai/admin/skills ────────────────────────────
    await spaNavigate(page, '/ai/admin/skills');
    await expect(page.getByText('Skill Pack Manager')).toBeVisible({ timeout: 15000 });
    // Wait for data to load (skeletons to clear)
    await page.waitForTimeout(2000);

    // Verify accordion sections exist — look for module badges (uppercase mono text in badges)
    const moduleBadges = page.locator('.font-mono.uppercase');
    const badgeCount = await moduleBadges.count();
    expect(badgeCount).toBeGreaterThan(0);

    // Verify skill cards are visible within expanded sections
    const skillCards = page.locator('[role="button"][aria-label^="View skill"]');
    await expect(skillCards.first()).toBeVisible({ timeout: 10000 });
    const cardCount = await skillCards.count();
    expect(cardCount).toBeGreaterThan(0);

    // Verify action bar elements
    await expect(page.getByLabel('Card view')).toBeVisible();
    await expect(page.getByLabel('List view')).toBeVisible();
    await expect(page.getByRole('button', { name: /test trigger/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /add skill/i })).toBeVisible();

    // Verify search input
    await expect(page.getByPlaceholder(/search skills/i)).toBeVisible();

    // ── Checkpoint 1: Skill Pack Manager Page Loaded ────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-skill-pack-manager-loaded.png`,
      fullPage: true,
    });

    // ── Step 2: Verify first module accordion section expanded by default ─
    const firstAccordionItem = page.locator('[data-state="open"]').first();
    await expect(firstAccordionItem).toBeVisible();

    // Verify skill cards are visible inside the expanded section
    const cardsInFirst = firstAccordionItem.locator('[role="button"][aria-label^="View skill"]');
    const cardsInFirstCount = await cardsInFirst.count();
    expect(cardsInFirstCount).toBeGreaterThan(0);

    test.info().annotations.push({
      type: 'info',
      description: `Step 2: First accordion expanded with ${cardsInFirstCount} skill cards, ${badgeCount} module groups total`,
    });

    // ── Step 3: Search for "overdue" ────────────────────────────────────
    const searchInput = page.getByPlaceholder(/search skills/i);
    await searchInput.fill('overdue');
    // Wait for 300ms debounce + API response
    await page.waitForTimeout(1500);
    await page.waitForLoadState('networkidle');

    // After search, either we have filtered results or "No skills found"
    const filteredCards = page.locator('[role="button"][aria-label^="View skill"]');
    const filteredCount = await filteredCards.count();
    const noResultsMsg = page.getByText('No skills found');
    const hasNoResults = await noResultsMsg.isVisible().catch(() => false);

    expect(filteredCount > 0 || hasNoResults).toBeTruthy();

    // If we have filtered results, they should be equal to or fewer than the full set
    if (filteredCount > 0) {
      expect(filteredCount).toBeLessThanOrEqual(cardCount);
    }

    test.info().annotations.push({
      type: 'info',
      description: `Step 3: Search "overdue" → ${filteredCount} results (was ${cardCount}), noResults=${hasNoResults}`,
    });

    // ── Checkpoint 2: Search Results for "overdue" ──────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-search-filtered-overdue.png`,
      fullPage: true,
    });

    // ── Step 4: Clear search ────────────────────────────────────────────
    await searchInput.clear();
    await page.waitForTimeout(1500);
    await page.waitForLoadState('networkidle');

    // All module groups should be visible again (accordion sections restored)
    const restoredBadges = page.locator('.font-mono.uppercase');
    const restoredGroupCount = await restoredBadges.count();
    // After clearing search, all module groups should reappear (>= original badge count)
    expect(restoredGroupCount).toBeGreaterThanOrEqual(badgeCount);
    // At least some cards should be visible in expanded sections
    const restoredCards = page.locator('[role="button"][aria-label^="View skill"]');
    const restoredCount = await restoredCards.count();
    expect(restoredCount).toBeGreaterThan(0);

    test.info().annotations.push({
      type: 'info',
      description: `Step 4: Search cleared → ${restoredCount} skills restored`,
    });

    // ── Step 5: Toggle an active skill's switch OFF ─────────────────────
    // Find the first active toggle switch and capture its aria-label to target it specifically
    const firstCheckedSwitch = page.locator(
      '[role="button"][aria-label^="View skill"] button[role="switch"][data-state="checked"]',
    ).first();
    await expect(firstCheckedSwitch).toBeVisible({ timeout: 5000 });

    // Get the aria-label to create a stable locator that won't re-resolve to a different switch
    const switchAriaLabel = await firstCheckedSwitch.getAttribute('aria-label');
    const targetSwitch = page.locator(`button[role="switch"][aria-label="${switchAriaLabel}"]`);

    // Get the skill display name from the card for toast verification
    const parentCard = targetSwitch.locator('xpath=ancestor::div[contains(@class, "space-y-3")]');
    const skillDisplayName = await parentCard.locator('.font-medium').first().textContent();

    // Click the switch to deactivate
    await targetSwitch.click();

    // Wait for toast notification — toast says "Skill {displayName} deactivated"
    const deactivateToast = page.getByText(/deactivated/i).first();
    await expect(deactivateToast).toBeVisible({ timeout: 10000 });

    // Verify the switch is now unchecked (using the stable aria-label locator)
    await expect(targetSwitch).toHaveAttribute('data-state', 'unchecked', { timeout: 5000 });

    test.info().annotations.push({
      type: 'info',
      description: `Step 5: Skill "${skillDisplayName}" toggled OFF, deactivation toast visible`,
    });

    // ── Checkpoint 3: Skill Deactivated with Toast ──────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-skill-deactivated-toast.png`,
      fullPage: true,
    });

    // ── Step 6: Toggle the same skill back to active ────────────────────
    await targetSwitch.click();

    // Wait for activation toast
    const activateToast = page.getByText(/activated/i).first();
    await expect(activateToast).toBeVisible({ timeout: 10000 });

    // Verify the switch is checked again
    await expect(targetSwitch).toHaveAttribute('data-state', 'checked', { timeout: 5000 });

    test.info().annotations.push({
      type: 'info',
      description: `Step 6: Skill "${skillDisplayName}" toggled back ON, activation toast visible`,
    });
  });
});
