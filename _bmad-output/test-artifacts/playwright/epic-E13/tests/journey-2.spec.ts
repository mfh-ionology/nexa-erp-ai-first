import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E13/journey-2';

const ALL_DOCUMENT_TYPES = [
  'Sales Invoice',
  'Credit Note',
  'Cash Receipt',
  'Proforma Invoice',
  'Customer Statement',
  'Sales Order',
  'Sales Quote',
  'Delivery Note',
  'Purchase Order',
  'Goods Receipt Note',
  'Supplier Remittance',
  'Payslip',
  'P45',
  'P60',
];

/**
 * Navigate within the SPA without full page reload (preserves in-memory auth).
 * Uses Vite's dev-mode dynamic import to access the TanStack Router instance.
 */
async function navigateSPA(page: import('@playwright/test').Page, path: string) {
  await page.evaluate(async (p) => {
    const { router } = await import('/src/router.ts');
    await router.navigate({ to: p });
  }, path);
}

test.describe('Journey 2: Verify All 14 Document Types Listed', () => {
  test('should display all 14 document types with correct labels and dropdown selectors', async ({
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

    // Wait for dashboard to fully load
    await expect(page.getByRole('navigation')).toBeVisible({ timeout: 10000 });

    // ── Step 1: Navigate to Print Preferences (SPA client-side nav) ───────
    await navigateSPA(page, '/system/print-preferences');

    // Verify page loaded
    const mainElement = page.locator('main[aria-label="Print Preferences"]');
    await expect(mainElement).toBeVisible({ timeout: 15000 });

    // Wait for table to load (skeleton disappears, real rows appear)
    await expect(page.getByText('Sales Invoice')).toBeVisible({ timeout: 10000 });

    // ── Checkpoint 1: Page loaded ─────────────────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-page-loaded.png`,
      fullPage: true,
    });

    // ── Steps 2-3: Verify column headers ──────────────────────────────────
    await expect(page.getByText('Document Type', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('My Preference', { exact: false }).first()).toBeVisible();

    // ── Steps 4-17: Verify all 14 document types are listed ───────────────
    for (const docType of ALL_DOCUMENT_TYPES) {
      await expect(
        page.getByText(docType, { exact: true }).first(),
      ).toBeVisible({ timeout: 5000 });
    }

    // ── Checkpoint 2: All 14 document types visible ───────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-17-all-14-document-types.png`,
      fullPage: true,
    });

    // ── Step 18: Click the Sales Invoice dropdown ─────────────────────────
    // Find the first Select trigger (combobox) in the preference table card
    const preferenceCard = mainElement.locator('.rounded-xl.border.bg-card').first();
    const firstRowTrigger = preferenceCard.locator('button[role="combobox"]').first();
    await firstRowTrigger.click();

    // ── Steps 19-21: Verify three dropdown options ────────────────────────
    const dropdownContent = page.locator('[role="listbox"]');
    await expect(dropdownContent).toBeVisible({ timeout: 5000 });

    await expect(
      dropdownContent.getByText('Auto-Download PDF', { exact: true }),
    ).toBeVisible();
    await expect(
      dropdownContent.getByText('Browser Print Dialog', { exact: true }),
    ).toBeVisible();
    await expect(
      dropdownContent.getByText('No Action', { exact: true }),
    ).toBeVisible();

    // ── Checkpoint 3: Dropdown options open ───────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-21-dropdown-options-open.png`,
      fullPage: true,
    });

    // Close dropdown by pressing Escape
    await page.keyboard.press('Escape');
  });
});
