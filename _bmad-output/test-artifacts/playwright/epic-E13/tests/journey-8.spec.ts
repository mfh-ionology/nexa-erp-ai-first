import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E13/journey-8';

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

test.describe('Journey 8: Navigation Blocker for Unsaved Changes', () => {
  test('should block navigation when unsaved changes exist, allow cancel, and allow discard', async ({
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

    // ── BUG WORKAROUND: Wrap raw API responses in success envelope ──────
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

    // ── Step 1: Navigate to Print Preferences ───────────────────────────
    await navigateSPA(page, '/system/print-preferences');

    const mainElement = page.locator('main[aria-label="Print Preferences"]');
    await expect(mainElement).toBeVisible({ timeout: 15000 });
    await waitForPreferenceTable(page);

    // Visual checkpoint 1: Page loaded with preference table
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-print-preferences-loaded.png`,
      fullPage: true,
    });

    // ── Step 2-3: Change Credit Note preference to Browser Print Dialog ─
    const preferenceCard = mainElement.locator('.rounded-xl.border.bg-card').first();

    const creditNoteRow = preferenceCard
      .locator('div')
      .filter({ has: page.getByText('Credit Note', { exact: true }) })
      .filter({ has: page.locator('button[role="combobox"]') })
      .first();
    const creditNoteCombobox = creditNoteRow.locator('button[role="combobox"]').last();
    await expect(creditNoteCombobox).toBeVisible();

    // Open the dropdown and select "Browser Print Dialog"
    await creditNoteCombobox.click({ force: true });
    const listbox = page.locator('[role="listbox"]');
    await expect(listbox).toBeVisible({ timeout: 5000 });
    await listbox.getByText('Browser Print Dialog', { exact: true }).click();

    // Verify change applied
    await expect(creditNoteCombobox).toContainText('Browser Print Dialog');

    // Verify unsaved changes warning appears
    await expect(page.getByText('You have unsaved changes').first()).toBeVisible({ timeout: 5000 });

    // Visual checkpoint 2: Unsaved change made
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-unsaved-change-made.png`,
      fullPage: true,
    });

    // ── Step 4: Click Dashboard link in sidebar to trigger navigation blocker ─
    const sidebar = page.locator('nav[role="navigation"]');
    const dashboardLink = sidebar.getByRole('link', { name: /Dashboard/i }).first();
    await expect(dashboardLink).toBeVisible();
    await dashboardLink.click();

    // ── Step 5-6: Verify navigation blocker dialog appears ──────────────
    const blockerDialog = page.getByRole('alertdialog');
    await expect(blockerDialog).toBeVisible({ timeout: 5000 });

    // Verify dialog title
    await expect(blockerDialog.getByText('You have unsaved changes')).toBeVisible();

    // Verify dialog description
    await expect(
      blockerDialog.getByText('Your changes will be lost if you leave this page without saving.'),
    ).toBeVisible();

    // Visual checkpoint 3: Navigation blocker dialog visible
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-navigation-blocker-dialog.png`,
      fullPage: true,
    });

    // ── Step 7: Click Cancel to stay on page ────────────────────────────
    await blockerDialog.getByRole('button', { name: /Cancel/i }).click();

    // ── Step 8: Verify still on Print Preferences page ──────────────────
    await expect(blockerDialog).not.toBeVisible({ timeout: 3000 });
    await expect(mainElement).toBeVisible();
    await expect(page.getByText('Print Preferences').first()).toBeVisible();

    // Verify unsaved changes are still present
    await expect(creditNoteCombobox).toContainText('Browser Print Dialog');
    await expect(page.getByText('You have unsaved changes').first()).toBeVisible();

    // Visual checkpoint 4: Still on Print Preferences after cancelling
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-7-still-on-print-preferences.png`,
      fullPage: true,
    });

    // ── Step 9: Click Dashboard link again ───────────────────────────────
    await dashboardLink.click();

    // Verify blocker dialog appears again
    const blockerDialog2 = page.getByRole('alertdialog');
    await expect(blockerDialog2).toBeVisible({ timeout: 5000 });

    // ── Step 10: Click "Discard & Leave" to navigate away ────────────────
    await blockerDialog2.getByRole('button', { name: /Discard/i }).click();

    // Verify navigated away from Print Preferences to Dashboard
    await expect(mainElement).not.toBeVisible({ timeout: 5000 });

    // Verify we're no longer on print preferences (navigated to Dashboard / root)
    await expect(page).not.toHaveURL(/print-preferences/, { timeout: 5000 });

    // Visual checkpoint 5: Navigated to Dashboard after discarding changes
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-10-dashboard-after-discard.png`,
      fullPage: true,
    });
  });
});
