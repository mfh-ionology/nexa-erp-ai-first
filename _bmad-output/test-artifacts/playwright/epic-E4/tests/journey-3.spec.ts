import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E4/journey-3';

test.describe('J03 — Login Validation Errors Use Interpolated Field Names', () => {
  test('Empty-field submission shows validation errors with interpolated field names, not raw template syntax', async ({
    page,
  }) => {
    // Step 1: Navigate to /login
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);

    // Visual Checkpoint 1: Login page loaded
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-1-login-page-loaded.png`, fullPage: true });

    // Step 2: Click Sign In button with empty fields — triggers validation errors
    const signInButton = page.getByRole('button', { name: /sign in|log in|submit/i });
    await expect(signInButton).toBeVisible();
    await signInButton.click();

    // Wait for validation errors to appear
    await page.waitForTimeout(500);

    // Visual Checkpoint 2: Validation errors displayed
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-validation-errors-displayed.png`,
      fullPage: true,
    });

    // Step 3: Verify email validation error does NOT contain raw '{{field}}' template syntax
    const pageContent = await page.textContent('body');
    expect(pageContent).not.toContain('{{field}}');

    // Step 4: Verify email validation error does NOT contain raw 'validation:' namespace prefix
    expect(pageContent).not.toContain('validation:');

    // Step 5: Verify password validation error also has interpolated field name (no raw template)
    // Already covered by the full-page checks above. Add specific field-level checks:

    // Look for validation error messages near the email field
    const emailField = page.getByLabel(/email/i).or(page.getByPlaceholder(/email/i));
    if (await emailField.count() > 0) {
      // Find validation error near email - could be a sibling, parent container, or aria-describedby element
      const emailError = page
        .locator('[role="alert"], .error, .field-error, .validation-error, [class*="error"]')
        .filter({ hasText: /email/i });
      if (await emailError.count() > 0) {
        const emailErrorText = await emailError.first().textContent();
        expect(emailErrorText).not.toContain('{{field}}');
        expect(emailErrorText).not.toContain('validation:');
      }
    }

    // Look for validation error messages near the password field
    const passwordField = page.getByLabel(/password/i).or(page.getByPlaceholder(/password/i));
    if (await passwordField.count() > 0) {
      const passwordError = page
        .locator('[role="alert"], .error, .field-error, .validation-error, [class*="error"]')
        .filter({ hasText: /password/i });
      if (await passwordError.count() > 0) {
        const passwordErrorText = await passwordError.first().textContent();
        expect(passwordErrorText).not.toContain('{{field}}');
        expect(passwordErrorText).not.toContain('validation:');
      }
    }

    // Additional: verify that some form of validation message IS visible
    // (at least one error indicator should be present after submitting empty form)
    const anyErrorIndicator = page.locator(
      '[role="alert"], .error, .field-error, .validation-error, [class*="error"], [aria-invalid="true"]',
    );
    const errorCount = await anyErrorIndicator.count();
    expect(errorCount, 'Expected at least one validation error indicator after empty submit').toBeGreaterThan(0);
  });
});
