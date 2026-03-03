import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E3b/journey-3';

test.describe('Journey 3: PLATFORM_ADMIN Without MFA is Blocked', () => {
  test('j03 — PLATFORM_ADMIN without MFA enabled cannot login (BR-PLT-018)', async ({
    page,
  }) => {
    // Step 1: Navigate to /login
    await page.goto('/login');
    await expect(page).toHaveURL(/login/);

    // Visual checkpoint 1: Login page loaded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-login-page.png`,
      fullPage: true,
    });

    // Verify login page has the expected form elements
    const emailField = page.getByLabel(/email/i).or(page.getByPlaceholder(/email/i));
    const passwordField = page.getByLabel(/password/i).or(page.getByPlaceholder(/password/i));
    const signInButton = page.getByRole('button', { name: /sign in/i });

    await expect(emailField).toBeVisible();
    await expect(passwordField).toBeVisible();
    await expect(signInButton).toBeVisible();

    // Step 2: Fill login form with no-MFA admin credentials
    await emailField.fill('noomfa@nexa-platform.local');
    await passwordField.fill('NoMFA123!');

    // Step 3: Click Sign In — should be blocked with 403 error
    await signInButton.click();

    // Wait for the error response to be processed and displayed
    // The server should return a 403 and the UI should display an error message
    // about MFA being required for PLATFORM_ADMIN accounts
    const errorMessage = page
      .getByText(/mfa required/i)
      .or(page.getByText(/multi-factor authentication/i))
      .or(page.getByText(/authentication failed/i))
      .or(page.getByText(/forbidden/i))
      .or(page.getByText(/mfa.*required/i))
      .or(page.getByRole('alert'));

    await expect(errorMessage).toBeVisible({ timeout: 10000 });

    // Verify we are NOT redirected to dashboard — should still be on login
    await expect(page).toHaveURL(/login/);

    // Verify no MFA verification screen appeared (no TOTP input)
    const totpInput = page.getByLabel(/code/i).or(page.getByPlaceholder(/code|totp|otp/i));
    await expect(totpInput).not.toBeVisible();

    // Visual checkpoint 2: MFA required error displayed
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-mfa-required-error.png`,
      fullPage: true,
    });
  });
});
