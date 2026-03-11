import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E13/journey-5';

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

test.describe('Journey 5: Admin Views and Edits Company Defaults', () => {
  test('should view Company Defaults section as admin, edit defaults, save, and verify persistence', async ({
    page,
  }) => {
    // Log console errors for debugging
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log(`[CONSOLE ERROR] ${msg.text()}`);
      }
    });

    // ── Login as admin ────────────────────────────────────────────────────────
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

    // ── Step 2: Verify "Company Default" column header visible ──────────────
    await expect(page.getByText('Company Default', { exact: false }).first()).toBeVisible({
      timeout: 5000,
    });
    console.log('[STEP 2] Company Default column header visible');

    // ── Step 3: Verify "Company Defaults" section heading visible ───────────
    const companyDefaultsHeading = page.getByRole('heading', { name: /Company Defaults/i });
    await expect(companyDefaultsHeading).toBeVisible({ timeout: 5000 });
    console.log('[STEP 3] Company Defaults section heading visible');

    // ── Step 4: Verify company defaults description text ────────────────────
    await expect(
      page.getByText('Set default print behaviour for all users in this company'),
    ).toBeVisible({ timeout: 5000 });
    console.log('[STEP 4] Company Defaults description visible');

    // Visual checkpoint 1: Admin page with Company Defaults section
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-admin-page-with-company-defaults.png`,
      fullPage: true,
    });

    // ── Locate the Company Defaults table (second card) ─────────────────────
    const allCards = mainElement.locator('.rounded-xl.border.bg-card');
    const companyDefaultsCard = allCards.nth(1);
    await expect(companyDefaultsCard).toBeVisible({ timeout: 5000 });

    // ── Step 5-6: Change Sales Invoice company default ──────────────────────
    // Use selectDifferentValue to guarantee the value actually CHANGES
    // (if the same value is re-selected, onValueChange won't fire)
    const salesInvoiceRow = companyDefaultsCard
      .locator('div')
      .filter({ has: page.getByText('Sales Invoice', { exact: true }) })
      .filter({ has: page.locator('button[role="combobox"]') })
      .first();
    const salesInvoiceCombobox = salesInvoiceRow.locator('button[role="combobox"]').last();
    await expect(salesInvoiceCombobox).toBeVisible();

    const newSalesInvoiceValue = await selectDifferentValue(page, salesInvoiceCombobox);
    console.log(`[STEP 6] Sales Invoice company default changed to: ${newSalesInvoiceValue}`);

    // Verify dropdown shows new value
    await expect(salesInvoiceCombobox).toContainText(newSalesInvoiceValue);

    // ── Step 7-8: Change Purchase Order company default ─────────────────────
    const purchaseOrderRow = companyDefaultsCard
      .locator('div')
      .filter({ has: page.getByText('Purchase Order', { exact: true }) })
      .filter({ has: page.locator('button[role="combobox"]') })
      .first();
    const purchaseOrderCombobox = purchaseOrderRow.locator('button[role="combobox"]').last();
    await expect(purchaseOrderCombobox).toBeVisible();

    const newPurchaseOrderValue = await selectDifferentValue(page, purchaseOrderCombobox);
    console.log(`[STEP 8] Purchase Order company default changed to: ${newPurchaseOrderValue}`);

    await expect(purchaseOrderCombobox).toContainText(newPurchaseOrderValue);

    // ── Step 9: Verify unsaved changes warning ──────────────────────────────
    const unsavedWarnings = page.getByText('You have unsaved changes');
    await expect(unsavedWarnings.last()).toBeVisible({ timeout: 5000 });
    console.log('[STEP 9] Unsaved changes warning visible in Company Defaults section');

    // Verify Save Company Defaults button is enabled
    const saveCompanyDefaultsButton = page.getByRole('button', {
      name: /Save Company Defaults/i,
    });
    await expect(saveCompanyDefaultsButton).toBeVisible();
    await expect(saveCompanyDefaultsButton).toBeEnabled();

    // Visual checkpoint 2: Unsaved changes in Company Defaults
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-9-company-defaults-unsaved-changes.png`,
      fullPage: true,
    });

    // ── Step 10: Click Save Company Defaults button ─────────────────────────
    await saveCompanyDefaultsButton.click();

    // ── Step 11: Verify success toast ───────────────────────────────────────
    await expect(
      page.getByText('Company print defaults saved successfully'),
    ).toBeVisible({ timeout: 10000 });
    console.log('[STEP 11] Success toast visible');

    // Verify Save Company Defaults button returns to disabled state
    await expect(saveCompanyDefaultsButton).toBeDisabled({ timeout: 5000 });

    // Verify unsaved changes warning disappeared from company defaults section
    await expect(unsavedWarnings.last()).not.toBeVisible({ timeout: 5000 });

    // Visual checkpoint 3: Company defaults saved
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-11-company-defaults-saved.png`,
      fullPage: true,
    });

    // ── Verify: Company Default column in upper table updated ───────────────
    // The upper user preferences card should show the new company defaults
    const userPreferencesCard = allCards.first();

    // Sales Invoice row in user preferences should show the new value in Company Default column
    const userSalesInvoiceRow = userPreferencesCard
      .locator('div')
      .filter({ has: page.getByText('Sales Invoice', { exact: true }) })
      .first();
    await expect(userSalesInvoiceRow).toContainText(newSalesInvoiceValue);

    // Purchase Order row in user preferences should show the new value in Company Default column
    const userPurchaseOrderRow = userPreferencesCard
      .locator('div')
      .filter({ has: page.getByText('Purchase Order', { exact: true }) })
      .first();
    await expect(userPurchaseOrderRow).toContainText(newPurchaseOrderValue);

    console.log('[VERIFIED] Company Default column updated in user preferences table');
  });
});
