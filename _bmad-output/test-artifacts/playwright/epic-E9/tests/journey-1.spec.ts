import { test, expect } from '@playwright/test';

const SCREENSHOT_DIR =
  '_bmad-output/test-artifacts/screenshots/epic-E9/journey-1';

test.describe('Journey 1: Notification Bell Badge Display', () => {
  test('Bell icon appears in header with unread badge count', async ({
    page,
  }) => {
    // Step 1 — Navigate to login page
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();

    // Step 2 — Fill login form using direct input selectors
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');

    await emailInput.click();
    await emailInput.fill('staff@nexa-erp.dev');
    await passwordInput.click();
    await passwordInput.fill('NexaDev2026!');

    // Step 3 — Click Sign In and wait for navigation
    const signInButton = page.getByRole('button', { name: /sign in/i });
    await signInButton.click();

    // Wait for the URL to change away from /login (TanStack Router does client-side nav)
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 15000,
    });
    await page.waitForLoadState('networkidle');

    // Step 4 — Verify notification bell icon is visible in header
    const bell = page.locator('button:has(svg.lucide-bell)').first();
    await expect(bell).toBeVisible({ timeout: 10000 });

    // Screenshot: header with bell icon and badge
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/step-4-header-bell-with-badge.png`,
    });

    // Step 5 — Verify unread badge shows count > 0
    const badge = page.locator('.bg-destructive').first();
    await expect(badge).toBeVisible();

    const badgeText = await badge.textContent();
    expect(badgeText).toBeTruthy();
    const badgeNumber = parseInt(badgeText!.replace('+', ''), 10);
    expect(badgeNumber).toBeGreaterThan(0);

    // Step 6 — Verify aria-label contains notification count
    const ariaLabel = await bell.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
    expect(ariaLabel).toMatch(/notification/i);
    expect(ariaLabel).toMatch(/\d/);
  });
});
