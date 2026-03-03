import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E4/journey-1';

test.describe('J01 — Login Page Shows Translated English Text', () => {
  test('all login page labels come from i18n, not hardcoded keys', async ({ page }) => {
    // --- Step 1: Navigate to /login ---
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Visual Checkpoint 1: Login page initial load
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-login-page-loaded.png`,
      fullPage: true,
    });

    // Verify login form is visible
    const emailInput = page.getByRole('textbox', { name: /email/i });
    const passwordInput = page.locator('input[type="password"]');
    const signInButton = page.getByRole('button', { name: /sign in|log in|submit|login/i });

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(signInButton).toBeVisible();

    // --- Step 2: Verify email input has translated label ---
    // Check that the email field has a proper English label, not a raw i18n key
    const emailLabel =
      (await emailInput.getAttribute('placeholder')) ||
      (await page.getByText(/email/i).first().textContent());
    expect(emailLabel).toBeTruthy();
    expect(emailLabel).not.toMatch(/field\.email/);
    expect(emailLabel).not.toMatch(/^common:/);
    expect(emailLabel).not.toMatch(/^auth:/);
    expect(emailLabel).toMatch(/email/i);

    // --- Step 3: Verify password input has translated label ---
    const passwordLabel =
      (await passwordInput.getAttribute('placeholder')) ||
      (await page.getByText(/password/i).first().textContent());
    expect(passwordLabel).toBeTruthy();
    expect(passwordLabel).not.toMatch(/field\.password/);
    expect(passwordLabel).not.toMatch(/^common:/);
    expect(passwordLabel).not.toMatch(/^auth:/);
    expect(passwordLabel).toMatch(/password/i);

    // --- Step 4: Verify submit button has translated text ---
    const buttonText = await signInButton.textContent();
    expect(buttonText).toBeTruthy();
    expect(buttonText).not.toMatch(/common\.submit/);
    expect(buttonText).not.toMatch(/auth\.login/);
    expect(buttonText).not.toMatch(/common:submit/);
    // Should be a real English word like "Sign In", "Log In", or "Submit"
    expect(buttonText).toMatch(/sign\s*in|log\s*in|submit|login/i);

    // --- Step 5: Verify page heading is translated ---
    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible();
    const headingText = await heading.textContent();
    expect(headingText).toBeTruthy();
    // Must not contain raw i18n key fragments
    expect(headingText).not.toMatch(/auth\./);
    expect(headingText).not.toMatch(/common\./);
    expect(headingText).not.toMatch(/auth:/);
    expect(headingText).not.toMatch(/common:/);
    expect(headingText).not.toMatch(/\{\{/); // no interpolation template syntax

    // Final sweep: no raw translation keys anywhere on the page
    const pageText = await page.textContent('body');
    expect(pageText).not.toContain('common:');
    expect(pageText).not.toContain('auth:');
    expect(pageText).not.toContain('navigation:');
    expect(pageText).not.toContain('field.email');
    expect(pageText).not.toContain('field.password');
    expect(pageText).not.toMatch(/\{\{field\}\}/);
  });
});
