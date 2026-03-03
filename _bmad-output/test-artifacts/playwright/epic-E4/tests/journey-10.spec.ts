import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E4/journey-10';

test.describe('Journey 10: Company Profile Default Language for Fallback Chain', () => {
  test('j10 — Company profile shows defaultLanguage field with translated labels', async ({
    page,
  }) => {
    // ── Step 1: Navigate to login page ──────────────────────────────────
    const response = await page.goto('/login');

    // If the frontend is not running, fail with a clear message
    if (!response || !response.ok()) {
      // Take a screenshot of whatever we see (likely an error page)
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-1-login-page.png` }).catch(() => {});
      throw new Error(
        `Frontend not available at ${page.url()}. ` +
        `The web app (apps/web) is a stub — no React runtime exists until E6 (Web Frontend Shell). ` +
        `Status: ${response?.status() ?? 'no response'}`
      );
    }

    await expect(page).toHaveURL(/\/login/);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-1-login-page.png` });

    // ── Step 2: Fill login form with admin credentials ──────────────────
    const emailField = page.getByRole('textbox', { name: /email/i });
    const passwordInput = page.locator('input[type="password"]');
    await emailField.fill('admin@nexa-test.co.uk');
    await passwordInput.fill('Admin123!');

    // ── Step 3: Click Sign In button ────────────────────────────────────
    const signInButton = page.getByRole('button', { name: /sign in|log in|submit|login/i });
    await signInButton.click();

    // Wait for navigation away from login
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-3-dashboard-after-login.png` });

    // ── Step 4: Navigate to company profile page ────────────────────────
    await page.goto('/system/company-profile');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-4-company-profile-page.png` });

    // ── Step 5: Verify Default Language field exists ─────────────────────
    // Look for the field by various possible labels
    const languageField = page
      .getByLabel(/default language|language|locale/i)
      .or(page.getByText(/default language/i))
      .or(page.locator('[name*="language"], [name*="locale"], [data-testid*="language"]'));

    // At least one language-related element should be visible
    await expect(languageField.first()).toBeVisible({ timeout: 10000 });

    // ── Step 6: Verify no raw i18n namespace prefixes on the page ────────
    const pageContent = await page.textContent('body');

    // No raw 'common:' namespace prefix
    expect(pageContent).not.toContain('common:');

    // No raw 'navigation:' namespace prefix
    expect(pageContent).not.toContain('navigation:');

    // No raw 'validation:' namespace prefix
    expect(pageContent).not.toContain('validation:');

    // No raw 'errors:' namespace prefix (specific i18n key pattern)
    expect(pageContent).not.toMatch(/errors:[A-Z_]+/);

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-6-no-raw-keys.png` });
  });
});
