import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E4/journey-11';

test.describe('Journey 11: Dates Display in DD/MM/YYYY Format for en-GB', () => {
  test('j11 — Date columns on user list use DD/MM/YYYY format, not US or ISO 8601', async ({
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

    // ── Step 4: Navigate to /system/users — screenshot checkpoint 1 ─────
    await page.goto('/system/users');
    await page.waitForLoadState('networkidle');

    // Visual Checkpoint 1: User list with date columns
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-4-user-list-date-columns.png` });

    // Verify the user list page loaded with a table or list
    const table = page.locator('table').or(page.getByRole('table'));
    const userListContainer = table.or(page.locator('[data-testid*="user"], [class*="user-list"], [class*="userList"]'));
    await expect(userListContainer.first()).toBeVisible({ timeout: 10000 });

    // ── Step 5: Verify date values match DD/MM/YYYY pattern ─────────────
    // Get all text content from the page
    const pageContent = await page.textContent('body');

    // DD/MM/YYYY pattern: two-digit day / two-digit month / four-digit year
    const ddMmYyyyPattern = /\b\d{2}\/\d{2}\/\d{4}\b/;
    const dateMatches = pageContent?.match(new RegExp(ddMmYyyyPattern.source, 'g')) || [];

    // There should be at least one date in DD/MM/YYYY format on the page
    expect(
      dateMatches.length,
      `Expected at least one date in DD/MM/YYYY format on the user list page. Page content snippet: "${pageContent?.substring(0, 500)}"`
    ).toBeGreaterThan(0);

    // Verify the matched dates have valid day/month values (not MM/DD swapped)
    for (const dateStr of dateMatches) {
      const [day, month] = dateStr.split('/').map(Number);
      // Day should be 1-31, month should be 1-12
      expect(day).toBeGreaterThanOrEqual(1);
      expect(day).toBeLessThanOrEqual(31);
      expect(month).toBeGreaterThanOrEqual(1);
      expect(month).toBeLessThanOrEqual(12);
    }

    // Visual Checkpoint 2: Date format verified
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-5-date-format-verified.png` });

    // ── Step 6: Verify no raw ISO 8601 timestamp fragments ──────────────
    // No 'T00:00:00' or similar ISO fragments should be visible
    expect(pageContent).not.toContain('T00:00:00');

    // No full ISO 8601 date strings like '2026-02-22T' should be visible in the UI
    expect(pageContent).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);

    // No raw YYYY-MM-DD format (ISO date without time) should be the display format
    // Note: YYYY-MM-DD could appear in data attributes, so check visible text specifically
    const visibleDates = await page.locator('td, [class*="date"], [data-testid*="date"], time').allTextContents();
    for (const text of visibleDates) {
      if (text.trim()) {
        // If the cell contains a date-like string, it should NOT be in YYYY-MM-DD format
        const isoDateOnly = /^\d{4}-\d{2}-\d{2}$/;
        expect(
          text.trim(),
          `Date display "${text.trim()}" appears to use ISO 8601 format instead of DD/MM/YYYY`
        ).not.toMatch(isoDateOnly);
      }
    }
  });
});
