import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E4/journey-5';

test.describe('J05 — Sidebar Navigation Shows Translated Module Names', () => {
  test('sidebar navigation renders translated English module names after login', async ({
    page,
  }) => {
    // Step 1: Navigate to /login
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);

    // Step 2: Fill login form with admin credentials
    // Use accessible locators — try label first, fall back to placeholder/role
    const emailField =
      page.getByLabel(/email/i).or(page.getByPlaceholder(/email/i));
    const passwordField =
      page.getByLabel(/password/i).or(page.getByPlaceholder(/password/i));

    await emailField.fill('admin@nexa-test.co.uk');
    await passwordField.fill('Admin123!');

    // Step 3: Click Sign In button and verify dashboard loads with sidebar
    const signInButton = page
      .getByRole('button', { name: /sign in|log in|submit/i })
      .first();
    await signInButton.click();

    // Wait for navigation away from login page (dashboard or home)
    await page.waitForURL(/^(?!.*\/login).*$/, { timeout: 15000 });

    // Visual Checkpoint 1: Dashboard with sidebar navigation
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-dashboard-sidebar-navigation.png`,
      fullPage: true,
    });

    // Step 4: Verify sidebar contains "Dashboard"
    const sidebar =
      page.getByRole('navigation').or(page.locator('[data-testid*="sidebar"], aside, nav'));
    await expect(sidebar.getByText('Dashboard', { exact: false })).toBeVisible();

    // Step 5: Verify sidebar contains "System"
    await expect(sidebar.getByText('System', { exact: false })).toBeVisible();

    // Step 6: Verify sidebar contains "Users"
    await expect(sidebar.getByText('Users', { exact: false })).toBeVisible();

    // Step 7: Verify sidebar contains "Settings"
    await expect(sidebar.getByText('Settings', { exact: false })).toBeVisible();

    // Step 8: Verify no raw i18n namespace prefix "navigation:" on the page
    const pageContent = await page.textContent('body');
    expect(pageContent).not.toContain('navigation:');
    expect(pageContent).not.toContain('navigation.dashboard');
    expect(pageContent).not.toContain('navigation.system');
    expect(pageContent).not.toContain('navigation.users');
    expect(pageContent).not.toContain('navigation.settings');

    // Visual Checkpoint 2: Final state — page free of raw keys
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-8-final-page-no-raw-keys.png`,
      fullPage: true,
    });
  });
});
