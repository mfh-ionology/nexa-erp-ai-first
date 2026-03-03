import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E4/journey-2';

test.describe('J02 — Invalid Login Shows Translated Error Message', () => {
  test('invalid credentials display translated error from errors.json, not raw keys', async ({
    page,
  }) => {
    // --- Step 1: Navigate to /login ---
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Visual Checkpoint 1: Login page loaded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-login-page-loaded.png`,
      fullPage: true,
    });

    // Verify login form is visible before filling
    const emailInput = page.getByRole('textbox', { name: /email/i });
    const passwordInput = page.locator('input[type="password"]');
    const signInButton = page.getByRole('button', { name: /sign in|log in|submit|login/i });

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(signInButton).toBeVisible();

    // --- Step 2: Fill form with invalid credentials ---
    await emailInput.fill('nonexistent@example.com');
    await passwordInput.fill('WrongPassword123!');

    // Verify form is populated
    await expect(emailInput).toHaveValue('nonexistent@example.com');
    await expect(passwordInput).toHaveValue('WrongPassword123!');

    // --- Step 3: Click Sign In — expect error ---
    await signInButton.click();

    // Wait for the error message to appear (API call + response)
    // Look for error message in various common patterns: alert role, error text, toast
    const errorLocator = page
      .locator('[role="alert"], .error, .alert, [class*="error"], [class*="alert"]')
      .first();

    // Also try finding error by text content directly
    const errorByText = page.getByText(/invalid|incorrect|wrong|failed/i).first();

    // Wait for either error pattern to appear
    await expect(errorLocator.or(errorByText)).toBeVisible({ timeout: 10000 });

    // Visual Checkpoint 2: Error message after invalid login
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-error-after-invalid-login.png`,
      fullPage: true,
    });

    // --- Step 4: Verify error text matches errors.json AUTH_INVALID_CREDENTIALS ---
    // The expected text is "Invalid email or password" from errors.json
    const pageText = await page.textContent('body');

    // Check that the translated error message is present
    // Allow for slight variations but the core message should be about invalid credentials
    const hasExpectedError =
      pageText?.includes('Invalid email or password') ||
      pageText?.includes('invalid email or password') ||
      pageText?.includes('Invalid credentials') ||
      pageText?.includes('invalid credentials');

    expect(
      hasExpectedError,
      `Expected translated error "Invalid email or password" on page but got: ${pageText?.substring(0, 500)}`,
    ).toBeTruthy();

    // --- Step 5: Verify NO raw translation keys visible ---
    expect(pageText).not.toContain('errors:AUTH_INVALID_CREDENTIALS');
    expect(pageText).not.toContain('AUTH_INVALID_CREDENTIALS');
    expect(pageText).not.toContain('errors:');
    expect(pageText).not.toContain('common:');
    expect(pageText).not.toContain('auth:');
    expect(pageText).not.toContain('validation:');
    expect(pageText).not.toMatch(/\{\{/); // no raw interpolation syntax

    // Visual Checkpoint 3: Final state
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-final-state-no-raw-keys.png`,
      fullPage: true,
    });
  });
});
