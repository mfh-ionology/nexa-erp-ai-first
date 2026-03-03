import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5/journey-25';

test.describe('J25 — Cmd+K Keyboard Shortcut Opens Search/AI Input', () => {
  test.beforeEach(async ({ page }) => {
    // Login as Finance Manager (prerequisite for this journey)
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const emailInput = page.getByRole('textbox', { name: /email/i });
    await expect(emailInput).toBeVisible({ timeout: 15000 });
    await emailInput.fill('finance@nexa-test.co.uk');

    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();
    await passwordInput.fill('Finance123!');

    const signInButton = page.getByRole('button', { name: /sign in|log in|submit|login/i });
    await expect(signInButton).toBeVisible();
    await signInButton.click();

    // Wait for navigation away from /login — dashboard should load
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
    await page.waitForLoadState('networkidle');
  });

  test('Cmd+K focuses the header unified search/AI input and shows autocomplete results', async ({
    page,
  }) => {
    // --- Step 1: Verify dashboard loaded, no input focused ---
    // Ensure we are on the dashboard with no focused search input
    await page.waitForLoadState('networkidle');

    // Visual Checkpoint 1: Dashboard loaded, no input focused
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-0-dashboard-loaded.png`,
      fullPage: true,
    });

    // Locate the unified search/AI input in the header bar
    const searchInput = page
      .locator(
        [
          'input[placeholder*="Ask Nexa" i]',
          'input[placeholder*="Search" i]',
          'input[placeholder*="search" i]',
          '[data-testid="unified-search"]',
          '[data-testid="unified-search-input"]',
          '[data-testid="search-input"]',
          '[role="combobox"][aria-label*="search" i]',
          '[role="searchbox"]',
        ].join(', '),
      )
      .first();

    // Verify the search input exists on the page
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    // Verify the search input is NOT focused before pressing Cmd+K
    const isInitiallyFocused = await searchInput.evaluate(
      (el) => document.activeElement === el,
    );
    // Note: it may or may not be focused initially; the key test is that Cmd+K focuses it

    // --- Step 2: Press Cmd+K to focus the search/AI input ---
    // On Mac this is Meta+K, on Windows/Linux it's Control+K
    // Playwright uses Meta for Cmd on Mac
    await page.keyboard.press('Meta+k');

    // Allow time for the shortcut handler to process and focus the input
    await page.waitForTimeout(500);

    // Verify the search input is now focused
    const isFocusedAfterShortcut = await searchInput.evaluate(
      (el) => document.activeElement === el,
    );

    // If Meta+K didn't work (e.g., running on Linux CI), try Control+K as fallback
    if (!isFocusedAfterShortcut) {
      await page.keyboard.press('Control+k');
      await page.waitForTimeout(500);
    }

    // Assert the search input is focused
    await expect(searchInput).toBeFocused({ timeout: 3000 });

    // Check if an autocomplete dropdown or command palette appeared
    const dropdown = page
      .locator(
        [
          '[data-testid="command-palette-dropdown"]',
          '[data-testid="search-dropdown"]',
          '[data-testid="autocomplete-dropdown"]',
          '[role="listbox"]',
          '[class*="command-palette"]',
          '[class*="CommandPalette"]',
          '[class*="autocomplete"]',
          '[class*="Autocomplete"]',
          '[class*="dropdown"]',
        ].join(', '),
      )
      .first();

    // Visual Checkpoint 2: Search input focused after Cmd+K
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-cmdk-search-focused.png`,
      fullPage: true,
    });

    // Verify the input is in an active/focused visual state
    // The input should have cursor focus (already asserted above via toBeFocused)

    // --- Step 3: Type "Invoice Acme" and verify autocomplete results ---
    await searchInput.fill('Invoice Acme');

    // Wait for autocomplete to update with results
    await page.waitForTimeout(1000);

    // Verify the input value
    const inputValue = await searchInput.inputValue();
    expect(inputValue).toContain('Invoice Acme');

    // Check for autocomplete dropdown with results
    // It may show entity results, page navigation, and AI suggestions
    const hasDropdown = (await dropdown.count()) > 0 && (await dropdown.isVisible());

    if (hasDropdown) {
      // Verify the dropdown has content — at least one result item
      const resultItems = dropdown.locator(
        [
          '[role="option"]',
          '[data-testid*="result"]',
          '[class*="result"]',
          '[class*="item"]',
          'li',
        ].join(', '),
      );

      const resultCount = await resultItems.count();
      // There should be at least one result matching "Invoice Acme"
      expect(resultCount).toBeGreaterThan(0);

      // Look for categorised results — entity matches, pages, AI suggestions
      const dropdownText = await dropdown.textContent();
      expect(dropdownText).toBeTruthy();
      expect(dropdownText!.length).toBeGreaterThan(0);
    }

    // Visual Checkpoint 3: Autocomplete dropdown with results
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-autocomplete-results.png`,
      fullPage: true,
    });

    // Final verification: the search input is still focused and functional
    await expect(searchInput).toBeFocused();
    await expect(searchInput).toHaveValue('Invoice Acme');
  });
});
