import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E13/journey-1';

test.describe('Journey 1: Navigate to Print Preferences Page', () => {
  test('should navigate to Print Preferences via sidebar and verify page content', async ({
    page,
  }) => {
    // ── Login ───────────────────────────────────────────────────────────────
    await page.goto('/login');
    await expect(page.getByLabel('Email')).toBeVisible({ timeout: 15000 });
    await page.getByLabel('Email').fill('admin@nexa-erp.dev');
    await page.getByLabel('Password').fill('NexaDev2026!');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for login to complete — should redirect away from /login
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });

    // ── Step 1: Verify dashboard loads with app shell ───────────────────────
    const sidebar = page.getByRole('navigation');
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // Visual checkpoint 1: Dashboard with sidebar
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-dashboard-with-sidebar.png`,
      fullPage: true,
    });

    // ── Step 2 & 3: Find and click Print Preferences in sidebar ─────────────
    // Scroll sidebar to ensure all items are visible
    const scrollArea = sidebar.locator('.overflow-auto, [data-radix-scroll-area-viewport]').first();
    if (await scrollArea.isVisible().catch(() => false)) {
      await scrollArea.evaluate((el) => (el.scrollTop = el.scrollHeight));
      await page.waitForTimeout(500);
    }

    // Take a screenshot of the full sidebar (scrolled to bottom)
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-sidebar-scrolled.png`,
      fullPage: true,
    });

    // Look for "Print Preferences" link anywhere in the sidebar
    const printPrefsLink = sidebar.getByText('Print Preferences');
    const hasPrintPrefsLink = await printPrefsLink.isVisible().catch(() => false);

    if (hasPrintPrefsLink) {
      // Happy path: sidebar link exists — click it
      await printPrefsLink.click();
      await page.waitForURL('**/system/print-preferences', { timeout: 10000 });
    } else {
      // ──────────────────────────────────────────────────────────────────────
      // MISSING FEATURE: Print Preferences link is not in the sidebar.
      // The route exists in navigation-config.ts and routeTree.gen.ts but
      // was not added to the sidebar's NAV_GROUPS in app-sidebar.tsx.
      // The page cannot be discovered or reached by users via sidebar nav.
      // ──────────────────────────────────────────────────────────────────────
      throw new Error(
        'MISSING FEATURE: Print Preferences link is not present in the sidebar navigation. ' +
          'The route exists in navigation-config.ts (key: system.printPreferences) and ' +
          'routeTree.gen.ts (path: /system/print-preferences) but is NOT rendered in ' +
          "app-sidebar.tsx's NAV_GROUPS. Users cannot discover or navigate to the " +
          'Print Preferences page through the sidebar.',
      );
    }

    // ── Steps 4-6 (only reached if sidebar link exists) ─────────────────────

    // Step 4: Verify main element with aria-label
    const mainElement = page.locator('main[aria-label="Print Preferences"]');
    await expect(mainElement).toBeVisible({ timeout: 10000 });

    // Step 5: Verify page heading
    await expect(page.getByText('Print Preferences', { exact: true }).first()).toBeVisible();

    // Step 6: Verify description text
    await expect(
      page.getByText('Configure how documents are handled after saving'),
    ).toBeVisible();

    // Visual checkpoint 2: Print Preferences page loaded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-print-preferences-page.png`,
      fullPage: true,
    });

    // Verify Save Preferences button exists and is disabled
    const saveButton = page.getByRole('button', { name: /Save Preferences/i });
    await expect(saveButton).toBeVisible();
    await expect(saveButton).toBeDisabled();

    // Verify Reset to Defaults button exists
    const resetButton = page.getByRole('button', { name: /Reset to Defaults/i });
    await expect(resetButton).toBeVisible();
  });
});
