import { test, expect } from '@playwright/test';

import * as path from 'path';

const SCREENSHOTS_DIR =
  process.env.SCREENSHOTS_DIR ||
  path.resolve(__dirname, '../../../screenshots/epic-E5c/journey-22');

/**
 * Helper: navigate within the SPA using TanStack Router.
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

test.describe('Journey 22: Automation Active Toggle (Inline Optimistic Mutation)', () => {
  test.setTimeout(120_000);

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

  test('Active toggle switches off and back on with optimistic mutation', async ({ page }) => {
    // ── Step 1: Navigate to automations list ───────────────────────────
    await spaNavigate(page, '/ai/admin/automations');
    await expect(
      page.getByRole('heading', { name: /Automations/i }),
    ).toBeVisible({ timeout: 15000 });

    // Wait for the automation list to load (at least one row)
    // The seeded automation is "Daily AR Aging Summary"
    await expect(page.getByText('Daily AR Aging Summary')).toBeVisible({
      timeout: 10000,
    });

    // Find the toggle switch for any visible automation
    // The aria-label pattern is: "Toggle {name} active"
    const toggleSwitch = page.getByRole('switch', {
      name: /Toggle .+ active/i,
    }).first();
    await expect(toggleSwitch).toBeVisible({ timeout: 5000 });

    // Record initial state
    const initialChecked = await toggleSwitch.isChecked();

    // Brief settle for rendering
    await page.waitForTimeout(300);

    // ── Checkpoint 1: Automation list loaded ───────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-automation-list-loaded.png`,
      fullPage: false,
    });

    // ── Step 2: Click toggle to deactivate ─────────────────────────────
    await toggleSwitch.click();
    // Small wait for optimistic update to render
    await page.waitForTimeout(500);

    // Verify toggle state flipped
    const afterFirstClick = await toggleSwitch.isChecked();
    expect(afterFirstClick).toBe(!initialChecked);

    // ── Checkpoint 2: Toggle switched off ──────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-toggle-switched-off.png`,
      fullPage: false,
    });

    // Wait for server sync (network idle)
    await page.waitForLoadState('networkidle');

    // ── Step 3: Click toggle again to re-enable ────────────────────────
    await toggleSwitch.click();
    await page.waitForTimeout(500);

    // Verify toggle state flipped back to original
    const afterSecondClick = await toggleSwitch.isChecked();
    expect(afterSecondClick).toBe(initialChecked);

    // Wait for server sync
    await page.waitForLoadState('networkidle');

    // ── Checkpoint 3: Toggle switched back on ──────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-toggle-switched-back-on.png`,
      fullPage: false,
    });
  });
});
