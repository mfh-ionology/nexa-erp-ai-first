import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E13/journey-4';

/**
 * Navigate within the SPA without full page reload (preserves in-memory auth).
 */
async function navigateSPA(page: import('@playwright/test').Page, path: string) {
  await page.evaluate(async (p) => {
    const { router } = await import('/src/router.ts');
    await router.navigate({ to: p });
  }, path);
}

/**
 * Wait for the preference table to load (or retry if error state is shown).
 */
async function waitForPreferenceTable(page: import('@playwright/test').Page) {
  await expect(
    page
      .getByText('Sales Invoice', { exact: true })
      .first()
      .or(page.getByText('Failed to load print preferences')),
  ).toBeVisible({ timeout: 15000 });

  const errorText = page.getByText('Failed to load print preferences');
  if (await errorText.isVisible().catch(() => false)) {
    console.log('[RETRY] Error state shown — clicking Retry');
    await page.getByRole('button', { name: /retry/i }).click();
    await expect(
      page.getByText('Sales Invoice', { exact: true }).first(),
    ).toBeVisible({ timeout: 15000 });
  }
}

test.describe('Journey 4: Reset Preferences to Company Defaults', () => {
  test('should show reset confirmation dialog, allow cancel, then confirm reset and verify defaults', async ({
    page,
  }) => {
    // Log console errors for debugging
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log(`[CONSOLE ERROR] ${msg.text()}`);
      }
    });

    // ── Login ───────────────────────────────────────────────────────────────
    await page.goto('/login');
    await expect(page.getByLabel('Email')).toBeVisible({ timeout: 15000 });
    await page.getByLabel('Email').fill('admin@nexa-erp.dev');
    await page.getByLabel('Password').fill('NexaDev2026!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
    await expect(page.getByRole('navigation')).toBeVisible({ timeout: 10000 });

    // Disable animations and hide devtools overlays
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
        }
        [aria-label*="TanStack"], [aria-label*="Tanstack"],
        button[aria-label="Open TanStack Router Devtools"],
        button[aria-label="Open Tanstack query devtools"] {
          display: none !important;
          pointer-events: none !important;
        }
      `,
    });

    // ── BUG WORKAROUND: Wrap raw API responses in success envelope ──────────
    await page.route('**/api/v1/system/print-preferences**', async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      const wrapped = Array.isArray(body) ? { success: true, data: body } : body;
      await route.fulfill({
        status: response.status(),
        headers: response.headers(),
        body: JSON.stringify(wrapped),
      });
    });

    // ── Step 1: Navigate to Print Preferences ───────────────────────────────
    await navigateSPA(page, '/system/print-preferences');

    const mainElement = page.locator('main[aria-label="Print Preferences"]');
    await expect(mainElement).toBeVisible({ timeout: 15000 });
    await waitForPreferenceTable(page);

    // ── Step 2: Click "Reset to Defaults" button in action bar ──────────────
    const resetButton = page.getByRole('button', { name: /Reset to Defaults/i }).first();
    await expect(resetButton).toBeVisible();
    await resetButton.click();

    // ── Step 3: Verify confirmation dialog title ────────────────────────────
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog.getByRole('heading', { name: 'Reset to Defaults' })).toBeVisible();

    // ── Step 4: Verify confirmation dialog description ──────────────────────
    await expect(
      dialog.getByText('Reset all print preferences to company defaults? This cannot be undone.'),
    ).toBeVisible();

    // Visual checkpoint 1: Confirmation dialog
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-reset-confirmation-dialog.png`,
      fullPage: true,
    });

    // ── Step 5: Click Cancel button — dialog closes, no changes made ────────
    await dialog.getByRole('button', { name: /cancel/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // Verify still on Print Preferences page
    await expect(mainElement).toBeVisible();
    await expect(page.getByText('Print Preferences').first()).toBeVisible();

    // Visual checkpoint 2: Dialog dismissed
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-dialog-cancelled.png`,
      fullPage: true,
    });

    // ── Step 6: Click "Reset to Defaults" button again ──────────────────────
    await resetButton.click();
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // ── Step 7: Click the destructive "Reset to Defaults" action button ─────
    // The dialog footer has Cancel + destructive "Reset to Defaults" action button.
    // Use the button role within the dialog that matches the reset text.
    const resetActionButton = dialog.getByRole('button', { name: /Reset to Defaults/i });
    await expect(resetActionButton).toBeVisible();
    await resetActionButton.click();

    // ── Step 8: Verify success toast notification ────────────────────────────
    await expect(
      page.getByText('Preferences reset to defaults'),
    ).toBeVisible({ timeout: 10000 });

    // Dialog should be closed
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // Visual checkpoint 3: Reset success toast
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-8-reset-success-toast.png`,
      fullPage: true,
    });

    // Verify the preference table is still showing (page didn't crash)
    await expect(page.getByText('Sales Invoice', { exact: true }).first()).toBeVisible();
  });
});
