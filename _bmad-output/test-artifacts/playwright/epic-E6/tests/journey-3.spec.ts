import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E6/journey-3';

test.describe('Journey 3: Unauthenticated Access Redirects to Login', () => {
  test('Step 1: /finance/journals redirects unauthenticated user to /login', async ({
    page,
  }) => {
    // Navigate to /finance/journals without any auth state
    await page.goto('/finance/journals');

    // The NotFound component should detect unauthenticated state and redirect to /login
    await page.waitForURL('**/login', { timeout: 10000 });

    // Take screenshot
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-redirect-finance-journals-to-login.png`,
      fullPage: true,
    });

    // Assert redirect to login
    expect(page.url()).toContain('/login');

    // Verify login page elements
    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(
      page.getByText('Sign in to your Nexa ERP account'),
    ).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Sign In' }),
    ).toBeVisible();
  });

  test('Step 2: /system/resources redirects unauthenticated user to /login', async ({
    page,
  }) => {
    // Navigate to /system/resources (admin-guarded route) without auth
    await page.goto('/system/resources');

    // The auth guard should redirect to /login
    await page.waitForURL('**/login', { timeout: 10000 });

    expect(page.url()).toContain('/login');

    // Verify login page is displayed
    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Sign In' }),
    ).toBeVisible();

    // Visual checkpoint 2
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-redirect-system-resources-to-login.png`,
      fullPage: true,
    });
  });

  test('Step 3: /system/access-groups redirects unauthenticated user to /login', async ({
    page,
  }) => {
    // Navigate to /system/access-groups (admin-guarded route) without auth
    await page.goto('/system/access-groups');

    // The auth guard should redirect to /login
    await page.waitForURL('**/login', { timeout: 10000 });

    expect(page.url()).toContain('/login');

    // Verify login page is displayed
    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Sign In' }),
    ).toBeVisible();

    // Visual checkpoint 3
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-redirect-system-access-groups-to-login.png`,
      fullPage: true,
    });
  });
});
