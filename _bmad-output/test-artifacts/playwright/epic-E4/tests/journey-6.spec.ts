import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E4/journey-6';

test.describe('J06 — User List Page Uses Translated Headers and Action Buttons', () => {
  test('user list page renders all UI elements with translated English strings', async ({
    page,
  }) => {
    // Step 1: Navigate to /login
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);

    // Visual Checkpoint 1: Login page loaded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-login-page.png`,
      fullPage: true,
    });

    // Step 2: Fill login form with admin credentials
    const emailField =
      page.getByLabel(/email/i).or(page.getByPlaceholder(/email/i));
    const passwordField =
      page.getByLabel(/password/i).or(page.getByPlaceholder(/password/i));

    await emailField.fill('admin@nexa-test.co.uk');
    await passwordField.fill('Admin123!');

    // Step 3: Click Sign In button
    const signInButton = page
      .getByRole('button', { name: /sign in|log in|submit/i })
      .first();
    await signInButton.click();

    // Wait for navigation away from login page
    await page.waitForURL(/^(?!.*\/login).*$/, { timeout: 15000 });

    // Visual Checkpoint 2: Dashboard after login
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-post-login-dashboard.png`,
      fullPage: true,
    });

    // Step 4: Navigate to /system/users
    await page.goto('/system/users');
    await page.waitForLoadState('networkidle');

    // Visual Checkpoint 3: User list page loaded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-user-list-page.png`,
      fullPage: true,
    });

    // Step 5: Verify page title/heading shows "Users"
    const pageHeading = page
      .getByRole('heading', { name: /users/i })
      .or(page.locator('h1, h2').filter({ hasText: /users/i }));
    await expect(pageHeading.first()).toBeVisible();

    // Step 6: Verify "Create" button is visible with translated text
    const createButton = page
      .getByRole('button', { name: /create|add|new/i })
      .or(page.getByRole('link', { name: /create|add|new/i }));
    await expect(createButton.first()).toBeVisible();

    // Step 7: Verify Search input or button is visible with translated label/placeholder
    const searchElement = page
      .getByPlaceholder(/search/i)
      .or(page.getByRole('searchbox'))
      .or(page.getByRole('textbox', { name: /search/i }))
      .or(page.locator('[data-testid*="search"], input[type="search"]'));
    await expect(searchElement.first()).toBeVisible();

    // Step 8: Verify status column values show translated text (Active/Inactive), not raw booleans
    // Look for status indicators in the user list table/grid
    const pageContent = await page.textContent('body');

    // Status values should be translated words, not raw "true"/"false"
    // Check that at least one of Active/Inactive appears (users exist in seeded data)
    const hasActiveStatus = pageContent?.includes('Active');
    const hasInactiveStatus = pageContent?.includes('Inactive');
    const hasStatusLabels = hasActiveStatus || hasInactiveStatus;
    expect(hasStatusLabels).toBeTruthy();

    // Step 9: Verify no raw i18n namespace prefix "common:" on the page
    expect(pageContent).not.toContain('common:');
    expect(pageContent).not.toContain('common.create');
    expect(pageContent).not.toContain('common.search');
    expect(pageContent).not.toContain('common.filter');
    expect(pageContent).not.toContain('common.active');
    expect(pageContent).not.toContain('common.inactive');
    expect(pageContent).not.toContain('navigation:');
    expect(pageContent).not.toContain('navigation.users');

    // Visual Checkpoint 4: Final page scan for raw keys
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-9-no-raw-keys.png`,
      fullPage: true,
    });
  });
});
