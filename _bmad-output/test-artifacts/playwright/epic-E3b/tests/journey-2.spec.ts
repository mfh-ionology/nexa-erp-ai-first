import { test, expect } from '@playwright/test';
import * as path from 'path';

// ── Screenshot directory ─────────────────────────────────────────────────
const SCREENSHOTS_DIR = path.resolve(
  __dirname,
  '../../../screenshots/epic-E3b/journey-2',
);

// ── Journey #2: Platform Admin Login with Wrong MFA Code ─────────────────
test.describe('j02 — Platform Admin Login with Wrong MFA Code', () => {
  test('Incorrect TOTP code is rejected with error and user cannot proceed', async ({
    page,
  }) => {
    // ── Step 1: Navigate to /login ─────────────────────────────────────
    await page.goto('/login');

    // Verify login page loaded
    await expect(
      page.getByRole('heading', { name: /login|sign in|platform/i }),
    ).toBeVisible();

    // Visual Checkpoint 1: Login page
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'step-1-login-page.png'),
      fullPage: true,
    });

    // Locate login form elements
    const emailField = page
      .getByLabel(/email/i)
      .or(page.getByPlaceholder(/email/i));
    const passwordField = page
      .getByLabel(/password/i)
      .or(page.getByPlaceholder(/password/i));
    const signInButton = page.getByRole('button', {
      name: /sign in|log in|login/i,
    });

    await expect(emailField.first()).toBeVisible();
    await expect(passwordField.first()).toBeVisible();
    await expect(signInButton).toBeVisible();

    // ── Step 2: Fill login form with valid credentials ───────────────
    await emailField.first().fill('admin@nexa-platform.local');
    await passwordField.first().fill('PlatformAdmin123!');

    // ── Step 3: Click Sign In — expect MFA verification step ─────────
    await signInButton.click();

    // Wait for MFA verification screen to appear
    const mfaCodeInput = page
      .getByLabel(/code|totp|mfa|verification/i)
      .or(page.getByPlaceholder(/code|totp|6.digit/i))
      .or(page.locator('input[name="mfaCode"]'))
      .or(page.locator('input[name="totp"]'))
      .or(page.locator('input[maxlength="6"]'));

    await expect(mfaCodeInput.first()).toBeVisible({ timeout: 10000 });

    // Visual Checkpoint 2: MFA verification screen
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'step-3-mfa-verification-screen.png'),
      fullPage: true,
    });

    // Verify MFA screen elements
    const verifyButton = page.getByRole('button', {
      name: /verify|confirm|submit/i,
    });
    await expect(verifyButton).toBeVisible();

    // ── Step 4: Enter INVALID TOTP code ──────────────────────────────
    await mfaCodeInput.first().fill('000000');

    // ── Step 5: Click Verify — expect MFA failure ────────────────────
    await verifyButton.click();

    // Wait for error to appear
    const errorMessage = page
      .getByText(/invalid.*mfa|invalid.*code|authentication failed|incorrect.*code|verification failed/i)
      .first();

    await expect(errorMessage).toBeVisible({ timeout: 10000 });

    // Visual Checkpoint 3: MFA error displayed
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'step-5-mfa-error-invalid-code.png'),
      fullPage: true,
    });

    // Verify the user is NOT redirected to the dashboard
    // URL should still be on login or MFA verification page
    expect(page.url()).toMatch(/login|mfa|verify/i);

    // Verify dashboard content is NOT visible
    const tenantsLink = page.getByRole('link', { name: /tenants/i });
    await expect(tenantsLink).not.toBeVisible();

    // Verify the MFA input or login form is still accessible
    // (user can try again or go back)
    const mfaInputStillVisible = mfaCodeInput.first();
    const loginStillAccessible = emailField.first();
    const eitherVisible =
      (await mfaInputStillVisible.isVisible().catch(() => false)) ||
      (await loginStillAccessible.isVisible().catch(() => false));
    expect(eitherVisible).toBe(true);
  });
});
