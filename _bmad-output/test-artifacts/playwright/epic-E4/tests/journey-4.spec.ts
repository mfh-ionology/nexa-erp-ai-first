import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E4/journey-4';

test.describe('J04 — Account Locked After Repeated Failures Shows Translated Error', () => {
  test('account lockout after 6 failed attempts displays translated ACCOUNT_LOCKED error', async ({
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

    // Verify login form elements are visible
    const emailInput = page.getByRole('textbox', { name: /email/i });
    const passwordInput = page.locator('input[type="password"]');
    const signInButton = page.getByRole('button', { name: /sign in|log in|submit|login/i });

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(signInButton).toBeVisible();

    // Helper: fill and submit invalid credentials
    const attemptLogin = async (password: string) => {
      await emailInput.fill('admin@nexa-test.co.uk');
      await passwordInput.fill(password);
      await signInButton.click();

      // Wait for error message to appear after each attempt
      const errorLocator = page
        .locator('[role="alert"], .error, .alert, [class*="error"], [class*="alert"]')
        .first();
      const errorByText = page
        .getByText(/invalid|incorrect|wrong|failed|locked|too many/i)
        .first();
      await expect(errorLocator.or(errorByText)).toBeVisible({ timeout: 10000 });
    };

    // --- Steps 2-3: First failed attempt ---
    await attemptLogin('WrongPassword1!');

    // Visual Checkpoint 2: First failed attempt
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-first-failed-attempt.png`,
      fullPage: true,
    });

    // Verify first failure shows "Invalid email or password"
    let pageText = await page.textContent('body');
    expect(
      pageText?.toLowerCase().includes('invalid email or password') ||
        pageText?.toLowerCase().includes('invalid credentials'),
      `Expected "Invalid email or password" after first attempt, got: ${pageText?.substring(0, 300)}`,
    ).toBeTruthy();

    // --- Steps 4-5: Second failed attempt ---
    await attemptLogin('WrongPassword2!');

    // --- Steps 6-7: Third failed attempt ---
    await attemptLogin('WrongPassword3!');

    // --- Steps 8-9: Fourth failed attempt ---
    await attemptLogin('WrongPassword4!');

    // --- Steps 10-11: Fifth failed attempt ---
    await attemptLogin('WrongPassword5!');

    // --- Steps 12-13: Sixth failed attempt — should trigger lockout ---
    await emailInput.fill('admin@nexa-test.co.uk');
    await passwordInput.fill('WrongPassword6!');
    await signInButton.click();

    // Wait for lockout error — may take a moment for the different error to appear
    // Look specifically for the lockout message
    const lockoutError = page.getByText(/locked|too many failed attempts/i).first();
    const genericError = page
      .locator('[role="alert"], .error, .alert, [class*="error"], [class*="alert"]')
      .first();

    await expect(lockoutError.or(genericError)).toBeVisible({ timeout: 10000 });

    // Visual Checkpoint 3: Account lockout error
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-13-account-locked-error.png`,
      fullPage: true,
    });

    // --- Step 14: Verify lockout error text matches errors.json ACCOUNT_LOCKED ---
    pageText = await page.textContent('body');

    const hasLockoutError =
      pageText?.includes('Account temporarily locked due to too many failed attempts') ||
      pageText?.toLowerCase().includes('account temporarily locked') ||
      pageText?.toLowerCase().includes('too many failed attempts');

    expect(
      hasLockoutError,
      `Expected translated lockout error "Account temporarily locked due to too many failed attempts" but got: ${pageText?.substring(0, 500)}`,
    ).toBeTruthy();

    // Verify NO raw translation keys visible
    expect(pageText).not.toContain('errors:ACCOUNT_LOCKED');
    expect(pageText).not.toContain('ACCOUNT_LOCKED');
    expect(pageText).not.toContain('errors:');
    expect(pageText).not.toContain('common:');
    expect(pageText).not.toContain('auth:');
    expect(pageText).not.toContain('validation:');
    expect(pageText).not.toMatch(/\{\{/); // no raw interpolation syntax

    // Visual Checkpoint 4: Final verification
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-14-final-verification.png`,
      fullPage: true,
    });
  });
});
