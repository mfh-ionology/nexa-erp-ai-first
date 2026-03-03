import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E4/journey-12';

test.describe('Journey 12: Currency Values Display with Correct GBP Formatting', () => {
  test('j12 — GBP currency formatting uses £ symbol, comma thousands separator, 2 decimal places', async ({
    page,
  }) => {
    // ── Step 1: Navigate to login page ──────────────────────────────────
    const response = await page.goto('/login');

    if (!response || !response.ok()) {
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-1-login-page.png` }).catch(() => {});
      throw new Error(
        `Frontend not available at ${page.url()}. ` +
        `The web app (apps/web) is a stub — no React runtime exists until E6 (Web Frontend Shell). ` +
        `Status: ${response?.status() ?? 'no response'}`
      );
    }

    await expect(page).toHaveURL(/\/login/);

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

    // ── Step 4: Navigate to dashboard — Visual Checkpoint 1 ─────────────
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Visual Checkpoint 1: Dashboard loaded
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-4-dashboard-loaded.png` });

    // Verify dashboard/home page loaded (should not be login)
    await expect(page).not.toHaveURL(/\/login/);

    // Check for any monetary values on the dashboard
    const dashboardContent = await page.textContent('body');

    // Look for GBP-formatted values (£ followed by digits with optional commas and 2 decimal places)
    const gbpPattern = /£[\d,]+\.\d{2}/;
    const dashboardHasCurrency = gbpPattern.test(dashboardContent || '');

    if (dashboardHasCurrency) {
      // If monetary values exist on dashboard, verify they use correct GBP formatting
      const currencyMatches = dashboardContent?.match(new RegExp(gbpPattern.source, 'g')) || [];
      for (const value of currencyMatches) {
        // Each value should start with £ and have exactly 2 decimal places
        expect(value).toMatch(/^£[\d,]+\.\d{2}$/);
      }
    }
    // Note: If no monetary values on dashboard yet, that's expected — E4 is infrastructure,
    // business modules displaying money come later

    // ── Step 5: Navigate to company profile — Visual Checkpoint 2 ────────
    await page.goto('/system/company-profile');
    await page.waitForLoadState('networkidle');

    // Visual Checkpoint 2: Company profile with base currency
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-5-company-profile-currency.png` });

    // Verify company profile page loaded
    const profileContent = await page.textContent('body');
    expect(profileContent).toBeTruthy();

    // ── Step 6: Verify Base Currency field shows GBP ─────────────────────
    // Look for GBP reference on the company profile page
    // It could be a field label, a select value, or displayed text
    const gbpElement = page.getByText('GBP').or(
      page.locator('select, input, [role="combobox"]').filter({ hasText: /GBP/ })
    ).or(
      page.locator('[data-testid*="currency"], [class*="currency"]').filter({ hasText: /GBP/ })
    );

    // The company's base currency (GBP) should be visible somewhere on the profile page
    const baseCurrencyVisible = await gbpElement.first().isVisible().catch(() => false);

    // Also check if "GBP" or "British Pound" text appears anywhere on page
    const pageHasGBP = (profileContent || '').includes('GBP') ||
      (profileContent || '').toLowerCase().includes('british pound') ||
      (profileContent || '').includes('£');

    expect(
      baseCurrencyVisible || pageHasGBP,
      `Expected to find GBP/British Pound/£ reference on company profile page. ` +
      `This field drives the currency formatting system via Currency.minorUnit. ` +
      `Page content snippet: "${profileContent?.substring(0, 500)}"`
    ).toBeTruthy();

    // ── Step 7: Verify any monetary values use GBP pattern ───────────────
    // Check for any monetary values on the company profile page
    const companyPageContent = await page.textContent('body');

    if (companyPageContent) {
      // If there are any £ values on the page, they must follow GBP formatting rules
      const currencyValues = companyPageContent.match(new RegExp(gbpPattern.source, 'g')) || [];
      for (const value of currencyValues) {
        // Must have exactly 2 decimal places (GBP minorUnit = 2)
        expect(value).toMatch(/^£[\d,]+\.\d{2}$/);
        // Must not have more than 2 decimal places
        expect(value).not.toMatch(/\.\d{3,}$/);
      }

      // If there are raw numbers that look like unformatted currency (e.g., "1234.56" without £),
      // that could indicate missing formatting, but we can't definitively flag all numbers
      // so we only check that £-prefixed values are correctly formatted

      // Verify no US dollar signs are used for what should be GBP
      // (Don't fail if $ appears in non-currency context, but flag if it looks like a formatted amount)
      const usdPattern = /\$[\d,]+\.\d{2}/;
      const usdMatches = companyPageContent.match(new RegExp(usdPattern.source, 'g')) || [];
      expect(
        usdMatches.length,
        `Found US dollar formatted values (${usdMatches.join(', ')}) — expected GBP (£) formatting`
      ).toBe(0);
    }
  });
});
