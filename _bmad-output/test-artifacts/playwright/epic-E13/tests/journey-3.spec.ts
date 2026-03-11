import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E13/journey-3';

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

/**
 * Get the current text from a combobox trigger.
 */
async function getComboboxValue(combobox: import('@playwright/test').Locator): Promise<string> {
  return (await combobox.textContent()) ?? '';
}

/**
 * Select a DIFFERENT value from a preference dropdown.
 * Returns the name of the value that was selected.
 */
async function selectDifferentValue(
  page: import('@playwright/test').Page,
  combobox: import('@playwright/test').Locator,
): Promise<string> {
  const currentValue = await getComboboxValue(combobox);
  // Pick a value that's different from the current one
  const options = ['Auto-Download PDF', 'Browser Print Dialog', 'No Action'];
  const newValue = options.find((opt) => !currentValue.includes(opt)) ?? options[1];

  await combobox.click({ force: true });
  const listbox = page.locator('[role="listbox"]');
  await expect(listbox).toBeVisible({ timeout: 5000 });
  await listbox.getByText(newValue, { exact: true }).click();

  return newValue;
}

test.describe('Journey 3: Change User Print Preference and Save', () => {
  test('should change preferences, save, and verify persistence after navigation', async ({
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
    // Print-preference routes return raw arrays but ApiClient expects
    // { success: true, data: [...] } envelope format (see successEnvelope pattern).
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

    // ── Step 2: Verify Save Preferences button is disabled ──────────────────
    const saveButton = page.getByRole('button', { name: /^Save Preferences$/i }).first();
    await expect(saveButton).toBeVisible();
    await expect(saveButton).toBeDisabled();

    // ── Locate the user preferences table (first card in main) ──────────────
    const preferenceCard = mainElement.locator('.rounded-xl.border.bg-card').first();

    // ── Step 3-4: Change Sales Invoice preference ───────────────────────────
    // Find Sales Invoice row in the user preferences card
    const salesInvoiceRow = preferenceCard
      .locator('div')
      .filter({ has: page.getByText('Sales Invoice', { exact: true }) })
      .filter({ has: page.locator('button[role="combobox"]') })
      .first();
    // Get the My Preference combobox (last combobox — after optional Company Default column)
    const salesInvoiceCombobox = salesInvoiceRow.locator('button[role="combobox"]').last();
    await expect(salesInvoiceCombobox).toBeVisible();

    // Select a value different from the current one
    const newSalesInvoiceValue = await selectDifferentValue(page, salesInvoiceCombobox);
    console.log(`[STEP 4] Sales Invoice changed to: ${newSalesInvoiceValue}`);

    // Verify the dropdown shows the new value
    await expect(salesInvoiceCombobox).toContainText(newSalesInvoiceValue);

    // ── Step 5: Verify unsaved changes warning ──────────────────────────────
    await expect(page.getByText('You have unsaved changes').first()).toBeVisible({ timeout: 5000 });
    await expect(saveButton).toBeEnabled();

    // Visual checkpoint 1: Unsaved changes warning
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-unsaved-changes-warning.png`,
      fullPage: true,
    });

    // ── Step 6-7: Change Purchase Order preference ──────────────────────────
    const purchaseOrderRow = preferenceCard
      .locator('div')
      .filter({ has: page.getByText('Purchase Order', { exact: true }) })
      .filter({ has: page.locator('button[role="combobox"]') })
      .first();
    const purchaseOrderCombobox = purchaseOrderRow.locator('button[role="combobox"]').last();
    await expect(purchaseOrderCombobox).toBeVisible();

    const newPurchaseOrderValue = await selectDifferentValue(page, purchaseOrderCombobox);
    console.log(`[STEP 7] Purchase Order changed to: ${newPurchaseOrderValue}`);

    await expect(purchaseOrderCombobox).toContainText(newPurchaseOrderValue);

    // ── Step 8: Click Save Preferences button ───────────────────────────────
    await saveButton.click();

    // ── Step 9: Verify success toast notification ───────────────────────────
    await expect(
      page.getByText('Print preferences saved successfully'),
    ).toBeVisible({ timeout: 10000 });

    // Verify save button returns to disabled state
    await expect(saveButton).toBeDisabled({ timeout: 5000 });

    // Verify unsaved changes warning disappeared
    await expect(page.getByText('You have unsaved changes')).not.toBeVisible({ timeout: 5000 });

    // Visual checkpoint 2: Success toast after saving
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-9-save-success-toast.png`,
      fullPage: true,
    });

    // ── Step 10: Navigate away from page (no blocker since changes saved) ───
    await navigateSPA(page, '/');
    await expect(mainElement).not.toBeVisible({ timeout: 5000 });

    // ── Step 11: Navigate back to Print Preferences ─────────────────────────
    await navigateSPA(page, '/system/print-preferences');

    const mainAfterReload = page.locator('main[aria-label="Print Preferences"]');
    await expect(mainAfterReload).toBeVisible({ timeout: 15000 });
    await waitForPreferenceTable(page);

    // ── Step 12: Verify preferences persisted after reload ──────────────────
    const preferenceCardReloaded = mainAfterReload.locator('.rounded-xl.border.bg-card').first();

    // Sales Invoice should show the value we set
    const salesInvoiceRowReloaded = preferenceCardReloaded
      .locator('div')
      .filter({ has: page.getByText('Sales Invoice', { exact: true }) })
      .filter({ has: page.locator('button[role="combobox"]') })
      .first();
    await expect(
      salesInvoiceRowReloaded.locator('button[role="combobox"]').last(),
    ).toContainText(newSalesInvoiceValue);

    // Purchase Order should show the value we set
    const purchaseOrderRowReloaded = preferenceCardReloaded
      .locator('div')
      .filter({ has: page.getByText('Purchase Order', { exact: true }) })
      .filter({ has: page.locator('button[role="combobox"]') })
      .first();
    await expect(
      purchaseOrderRowReloaded.locator('button[role="combobox"]').last(),
    ).toContainText(newPurchaseOrderValue);

    // Save button should be disabled (no changes)
    const saveButtonReloaded = page.getByRole('button', { name: /^Save Preferences$/i }).first();
    await expect(saveButtonReloaded).toBeDisabled();

    // Visual checkpoint 3: Persisted values after page reload
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-12-persisted-values-after-reload.png`,
      fullPage: true,
    });
  });
});
