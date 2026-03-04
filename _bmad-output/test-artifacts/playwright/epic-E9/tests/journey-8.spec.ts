import { test, expect } from '@playwright/test';

const SCREENSHOT_DIR =
  '_bmad-output/test-artifacts/screenshots/epic-E9/journey-8';

test.describe('Journey 8: Notification Preferences Page Load', () => {
  test('Preferences page loads with preference matrix, toggles, and disabled Save', async ({
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
    // Using pushState + popstate to trigger TanStack Router without losing auth state
    await page.evaluate(() => {
      window.history.pushState({}, '', '/system/notification-preferences');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    // Wait for the route to render
    await page.waitForLoadState('networkidle');

    // Verify page header / title is visible
    const pageTitle = page.getByRole('heading', {
      name: /notification preferences/i,
    });
    await expect(pageTitle).toBeVisible({ timeout: 15000 });

    // Verify action bar buttons — Reset to Defaults and Save
    const resetButton = page.getByRole('button', {
      name: /reset to defaults/i,
    });
    await expect(resetButton).toBeVisible();

    const saveButton = page.getByRole('button', { name: /save/i }).first();
    await expect(saveButton).toBeVisible();

    // Checkpoint 1: Full page after load
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/step-1-preferences-page-loaded.png`,
    });

    // Step 2 — Verify preference matrix category sections exist
    // Categories are collapsible sections — look for collapsible trigger buttons
    const categoryHeaders = page.locator(
      'button[data-state="open"], button[data-state="closed"]'
    );
    await expect(categoryHeaders.first()).toBeVisible({ timeout: 10000 });

    const categoryCount = await categoryHeaders.count();
    expect(categoryCount).toBeGreaterThanOrEqual(1);

    // Step 3 — Verify column headers: In-App, Email, Push
    await expect(page.getByText('In-App').first()).toBeVisible();
    await expect(page.getByText('Email').first()).toBeVisible();
    await expect(page.getByText('Push').first()).toBeVisible();

    // Step 4 — Verify Switch toggles exist for notification templates
    const switches = page.locator('button[role="switch"]');
    await expect(switches.first()).toBeVisible({ timeout: 10000 });

    const switchCount = await switches.count();
    // Each template row has 3 switches (In-App, Email, Push) — expect at least 3
    expect(switchCount).toBeGreaterThanOrEqual(3);

    // Checkpoint 2: Toggle grid visible
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/step-4-toggle-switches-visible.png`,
    });

    // Step 5 — Verify "(default)" or "(using default)" labels indicating template defaults
    const defaultLabels = page.getByText(/\((?:using )?default\)/i);
    const defaultCount = await defaultLabels.count();
    // If labels exist (no user overrides), verify at least one is visible
    if (defaultCount > 0) {
      await expect(defaultLabels.first()).toBeVisible();
    }

    // Step 6 — Verify Save button is disabled (no changes made)
    await expect(saveButton).toBeDisabled();

    // Verify no unsaved changes warning is showing
    const unsavedWarning = page.getByText(/unsaved changes/i);
    await expect(unsavedWarning).not.toBeVisible();

    // Checkpoint 3: Save button disabled state
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/step-6-save-button-disabled.png`,
    });
  });
});
