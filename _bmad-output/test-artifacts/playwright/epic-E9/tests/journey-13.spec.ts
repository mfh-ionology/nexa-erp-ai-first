import { test, expect } from '@playwright/test';

const SCREENSHOT_DIR =
  '_bmad-output/test-artifacts/screenshots/epic-E9/journey-13';

/**
 * Helper: login via the login form
 */
async function login(
  page: import('@playwright/test').Page,
  email: string,
  password: string
) {
  await page.goto('/login');
  await expect(
    page.getByRole('heading', { name: /welcome back/i })
  ).toBeVisible();

  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');
  await emailInput.click();
  await emailInput.fill(email);
  await passwordInput.click();
  await passwordInput.fill(password);

  const signInButton = page.getByRole('button', { name: /sign in/i });
  await signInButton.click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 15000,
  });
  await page.waitForLoadState('networkidle');
}

/**
 * Helper: navigate to notification preferences via client-side routing
 */
async function navigateToPreferences(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    window.history.pushState({}, '', '/system/notification-preferences');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await page.waitForLoadState('networkidle');

  // Wait for the page heading to confirm route rendered
  await expect(
    page.getByRole('heading', { name: /notification preferences/i })
  ).toBeVisible({ timeout: 15000 });

  // Wait for preference matrix to load (switches visible)
  const switches = page.locator('button[role="switch"]');
  await expect(switches.first()).toBeVisible({ timeout: 10000 });
  await page.waitForLoadState('networkidle');
}

test.describe('Journey 13: Admin Role Defaults Section Visibility', () => {
  test('Role Defaults section is hidden for STAFF and visible for SUPER_ADMIN', async ({
    page,
  }) => {
    // ── Steps 1-3: Login as STAFF user ────────────────────────────────
    await login(page, 'staff@nexa-erp.dev', 'NexaDev2026!');

    // ── Step 4: Navigate to preferences — verify NO Role Defaults ─────
    await navigateToPreferences(page);

    // Personal preferences section should be visible
    const personalSaveButton = page.getByRole('button', {
      name: /save preferences/i,
    });
    await expect(personalSaveButton).toBeVisible();

    const resetButton = page.getByRole('button', {
      name: /reset to defaults/i,
    });
    await expect(resetButton).toBeVisible();

    // Role Defaults heading must NOT be present
    const roleDefaultsHeading = page.locator('#role-defaults-heading');
    await expect(roleDefaultsHeading).not.toBeVisible();

    // The section wrapper must NOT be present
    const roleDefaultsSection = page.locator(
      'section[aria-labelledby="role-defaults-heading"]'
    );
    await expect(roleDefaultsSection).not.toBeVisible();

    // "Save Role Defaults" button must NOT be present
    const roleDefaultsSaveButton = page.getByRole('button', {
      name: /save role defaults/i,
    });
    await expect(roleDefaultsSaveButton).not.toBeVisible();

    // Checkpoint 1: Staff user — no Role Defaults section
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/step-4-staff-preferences-no-role-defaults.png`,
    });

    // ── Step 5: Navigate to login (logout) ────────────────────────────
    await page.goto('/login');
    await expect(
      page.getByRole('heading', { name: /welcome back/i })
    ).toBeVisible({ timeout: 15000 });

    // ── Steps 6-7: Login as SUPER_ADMIN user ──────────────────────────
    await login(page, 'admin@nexa-erp.dev', 'NexaDev2026!');

    // ── Step 8: Navigate to preferences — verify Role Defaults visible ─
    await navigateToPreferences(page);

    // Personal preferences should still be visible
    await expect(
      page.getByRole('button', { name: /reset to defaults/i })
    ).toBeVisible();

    // Role Defaults heading must be visible
    await expect(roleDefaultsHeading).toBeVisible({ timeout: 10000 });

    // The section wrapper must be present
    await expect(roleDefaultsSection).toBeVisible();

    // "Save Role Defaults" button must be visible
    await expect(roleDefaultsSaveButton).toBeVisible();

    // Role selector should be visible, defaulting to STAFF
    // Look for SelectTrigger containing "STAFF" text
    const roleSelector = page.locator(
      'section[aria-labelledby="role-defaults-heading"]'
    ).getByRole('combobox');
    await expect(roleSelector).toBeVisible();

    // Verify STAFF is the default selected role
    await expect(roleSelector).toContainText(/staff/i);

    // Checkpoint 2: Admin user — Role Defaults section visible
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/step-8-admin-preferences-with-role-defaults.png`,
    });
  });
});
