import { test, expect } from '@playwright/test';

const SCREENSHOT_DIR =
  '_bmad-output/test-artifacts/screenshots/epic-E9/journey-12';

// Target only collapsible category triggers, not other data-state buttons
const OPEN_TRIGGER = '[data-slot="collapsible-trigger"][data-state="open"]';
const CLOSED_TRIGGER = '[data-slot="collapsible-trigger"][data-state="closed"]';

test.describe('Journey 12: Collapse and Expand Category Sections', () => {
  test('Category sections can be collapsed and re-expanded via collapsible triggers', async ({
    page,
  }) => {
    // Login first
    await page.goto('/login');
    await expect(
      page.getByRole('heading', { name: /welcome back/i })
    ).toBeVisible();

    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    await emailInput.click();
    await emailInput.fill('staff@nexa-erp.dev');
    await passwordInput.click();
    await passwordInput.fill('NexaDev2026!');

    const signInButton = page.getByRole('button', { name: /sign in/i });
    await signInButton.click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 15000,
    });
    await page.waitForLoadState('networkidle');

    // Step 1 — Navigate to notification preferences via client-side routing
    await page.evaluate(() => {
      window.history.pushState({}, '', '/system/notification-preferences');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await page.waitForLoadState('networkidle');

    // Verify page loads with heading
    const pageTitle = page.getByRole('heading', {
      name: /notification preferences/i,
    });
    await expect(pageTitle).toBeVisible({ timeout: 15000 });

    // Wait for the preference matrix to fully load — switches must be visible
    const switches = page.locator('button[role="switch"]');
    await expect(switches.first()).toBeVisible({ timeout: 10000 });

    // Stabilise: wait for any pending API calls / re-renders
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Verify all category sections are expanded (defaultOpen)
    const openTriggers = page.locator(OPEN_TRIGGER);
    await expect(openTriggers.first()).toBeVisible({ timeout: 10000 });

    const openCategoryCount = await openTriggers.count();
    expect(openCategoryCount).toBeGreaterThanOrEqual(1);

    // Checkpoint 1: All categories expanded
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/step-1-all-categories-expanded.png`,
    });

    // Step 2 — Click first category header to collapse it
    const firstTrigger = page.locator(OPEN_TRIGGER).first();
    await firstTrigger.click({ force: true });

    // Wait for collapse animation
    await page.waitForTimeout(500);

    // Verify at least one closed trigger exists now
    const closedTriggers = page.locator(CLOSED_TRIGGER);
    await expect(closedTriggers.first()).toBeVisible({ timeout: 5000 });

    // Verify open count decreased by 1
    const afterCollapseOpenCount = await page.locator(OPEN_TRIGGER).count();
    expect(afterCollapseOpenCount).toBe(openCategoryCount - 1);

    // Checkpoint 2: First category collapsed
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/step-2-first-category-collapsed.png`,
    });

    // Step 3 — Click the closed header to re-expand it
    const closedTrigger = page.locator(CLOSED_TRIGGER).first();
    await closedTrigger.click({ force: true });

    // Wait for expand animation
    await page.waitForTimeout(500);

    // All categories should be open again
    const afterExpandOpenCount = await page.locator(OPEN_TRIGGER).count();
    expect(afterExpandOpenCount).toBe(openCategoryCount);

    // No closed triggers should remain
    const remainingClosed = await page.locator(CLOSED_TRIGGER).count();
    expect(remainingClosed).toBe(0);

    // Verify toggle switches are visible again in the re-expanded section
    await expect(switches.first()).toBeVisible();

    // Checkpoint 3: First category re-expanded
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/step-3-first-category-re-expanded.png`,
    });
  });
});
