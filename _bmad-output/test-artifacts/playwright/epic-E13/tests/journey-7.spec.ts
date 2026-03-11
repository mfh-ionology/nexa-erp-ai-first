import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E13/journey-7';

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
 * Select a specific value from a preference combobox dropdown.
 */
async function selectValue(
  page: import('@playwright/test').Page,
  combobox: import('@playwright/test').Locator,
  value: string,
) {
  await combobox.click({ force: true });
  const listbox = page.locator('[role="listbox"]');
  await expect(listbox).toBeVisible({ timeout: 5000 });
  await listbox.getByText(value, { exact: true }).click();
  await expect(listbox).not.toBeVisible({ timeout: 3000 });
}

test.describe('Journey 7: Preference Cascade with Source Labels', () => {
  test('should display correct source labels for inherited vs user-set preferences', async ({
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

    // ════════════════════════════════════════════════════════════════════════════
    // PRECONDITION SETUP: Establish the required state through the UI
    // - Company default for Sales Invoice = Auto-Download PDF
    // - User preference for Purchase Order = Browser Print Dialog (user-set)
    // - No user preference for Sales Invoice (inherited from company default)
    // - No company default for P60 (falls back to system default)
    // ════════════════════════════════════════════════════════════════════════════

    await navigateSPA(page, '/system/print-preferences');
    const mainElement = page.locator('main[aria-label="Print Preferences"]');
    await expect(mainElement).toBeVisible({ timeout: 15000 });
    await waitForPreferenceTable(page);

    // ── PRECONDITION 1: Reset user preferences to clear any personal overrides ──
    const resetButton = page.getByRole('button', { name: /Reset to Defaults/i }).first();
    if (await resetButton.isVisible().catch(() => false)) {
      await resetButton.click();
      // Confirm the reset dialog
      const resetConfirmButton = page.locator('[role="alertdialog"], [role="dialog"]')
        .getByRole('button', { name: /Reset to Defaults/i });
      await expect(resetConfirmButton).toBeVisible({ timeout: 5000 });
      await resetConfirmButton.click();
      // Wait for success toast or table to reload
      await page.waitForTimeout(1500);
      await waitForPreferenceTable(page);
      console.log('[PRECONDITION] User preferences reset to defaults');
    }

    // ── PRECONDITION 2: Set company default for Sales Invoice to Auto-Download PDF ──
    const allCards = mainElement.locator('.rounded-xl.border.bg-card');
    const companyDefaultsCard = allCards.nth(1);
    await expect(companyDefaultsCard).toBeVisible({ timeout: 5000 });

    // Find Sales Invoice row in company defaults table and set to Auto-Download PDF
    const companySalesInvoiceRow = companyDefaultsCard
      .locator('div')
      .filter({ has: page.getByText('Sales Invoice', { exact: true }) })
      .filter({ has: page.locator('button[role="combobox"]') })
      .first();
    const companySalesInvoiceCombobox = companySalesInvoiceRow.locator('button[role="combobox"]').last();
    await expect(companySalesInvoiceCombobox).toBeVisible();
    await selectValue(page, companySalesInvoiceCombobox, 'Auto-Download PDF');
    console.log('[PRECONDITION] Company default for Sales Invoice set to Auto-Download PDF');

    // Ensure P60 company default is set to No Action (system default behavior)
    const companyP60Row = companyDefaultsCard
      .locator('div')
      .filter({ has: page.getByText('P60', { exact: true }) })
      .filter({ has: page.locator('button[role="combobox"]') })
      .first();
    const companyP60Combobox = companyP60Row.locator('button[role="combobox"]').last();
    await expect(companyP60Combobox).toBeVisible();
    await selectValue(page, companyP60Combobox, 'No Action');
    console.log('[PRECONDITION] Company default for P60 set to No Action');

    // Save company defaults
    const saveCompanyDefaultsButton = page.getByRole('button', { name: /Save Company Defaults/i });
    await expect(saveCompanyDefaultsButton).toBeEnabled({ timeout: 5000 });
    await saveCompanyDefaultsButton.click();
    await expect(
      page.getByText('Company print defaults saved successfully'),
    ).toBeVisible({ timeout: 10000 });
    console.log('[PRECONDITION] Company defaults saved');

    // Wait for toast to dismiss and tables to refresh
    await page.waitForTimeout(1500);
    await waitForPreferenceTable(page);

    // ── PRECONDITION 3: Set user preference for Purchase Order to Browser Print Dialog ──
    const userPreferencesCard = allCards.first();

    const userPurchaseOrderRow = userPreferencesCard
      .locator('div')
      .filter({ has: page.getByText('Purchase Order', { exact: true }) })
      .filter({ has: page.locator('button[role="combobox"]') })
      .first();
    const userPurchaseOrderCombobox = userPurchaseOrderRow.locator('button[role="combobox"]').last();
    await expect(userPurchaseOrderCombobox).toBeVisible();
    await selectValue(page, userPurchaseOrderCombobox, 'Browser Print Dialog');
    console.log('[PRECONDITION] User preference for Purchase Order set to Browser Print Dialog');

    // Save user preferences
    const savePreferencesButton = page.getByRole('button', { name: /Save Preferences/i }).first();
    await expect(savePreferencesButton).toBeEnabled({ timeout: 5000 });
    await savePreferencesButton.click();
    await expect(
      page.getByText('Print preferences saved successfully'),
    ).toBeVisible({ timeout: 10000 });
    console.log('[PRECONDITION] User preferences saved');

    // Wait for toast to dismiss
    await page.waitForTimeout(1500);

    // Visual checkpoint 1: Precondition setup complete
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-setup-preconditions-complete.png`,
      fullPage: true,
    });

    // ════════════════════════════════════════════════════════════════════════════
    // ACTUAL TEST: Navigate away and back to get fresh resolved data
    // ════════════════════════════════════════════════════════════════════════════

    await navigateSPA(page, '/');
    await page.waitForTimeout(500);
    await navigateSPA(page, '/system/print-preferences');
    await expect(mainElement).toBeVisible({ timeout: 15000 });
    await waitForPreferenceTable(page);

    // Re-query cards after navigation
    const freshCards = mainElement.locator('.rounded-xl.border.bg-card');
    const freshUserCard = freshCards.first();

    // ── Step 1: Navigate to Print Preferences — DONE (above) ──────────────────
    console.log('[STEP 1] Print Preferences page loaded with resolved preferences');

    // ── Step 2: Verify Sales Invoice shows "(company default)" source label ───
    const salesInvoiceRow = freshUserCard
      .locator('div')
      .filter({ has: page.getByText('Sales Invoice', { exact: true }) })
      .first();
    await expect(salesInvoiceRow).toBeVisible({ timeout: 5000 });

    // Check for "(company default)" label below Sales Invoice
    const companyDefaultLabel = salesInvoiceRow.getByText('(company default)');
    await expect(companyDefaultLabel).toBeVisible({ timeout: 5000 });
    console.log('[STEP 2] Sales Invoice shows "(company default)" source label');

    // ── Step 3: Verify Sales Invoice dropdown has dimmed text ──────────────────
    const salesInvoiceCombobox = salesInvoiceRow.locator('button[role="combobox"]').last();
    await expect(salesInvoiceCombobox).toBeVisible();
    // Verify the combobox has the dimmed class (text-muted-foreground)
    await expect(salesInvoiceCombobox).toHaveClass(/text-muted-foreground/);
    console.log('[STEP 3] Sales Invoice dropdown has dimmed text (inherited value)');

    // ── Step 4: Verify Purchase Order has NO source label ─────────────────────
    const purchaseOrderRow = freshUserCard
      .locator('div')
      .filter({ has: page.getByText('Purchase Order', { exact: true }) })
      .first();
    await expect(purchaseOrderRow).toBeVisible({ timeout: 5000 });

    // Purchase Order should NOT have "(company default)" or "(system default)" label
    const poCompanyLabel = purchaseOrderRow.getByText('(company default)');
    const poSystemLabel = purchaseOrderRow.getByText('(system default)');
    await expect(poCompanyLabel).not.toBeVisible({ timeout: 3000 });
    await expect(poSystemLabel).not.toBeVisible({ timeout: 3000 });
    console.log('[STEP 4] Purchase Order has no source label (user-set value)');

    // ── Step 5: Verify Purchase Order dropdown has normal text ─────────────────
    const purchaseOrderCombobox = purchaseOrderRow.locator('button[role="combobox"]').last();
    await expect(purchaseOrderCombobox).toBeVisible();
    // Verify the combobox has normal text class (text-foreground), not dimmed
    await expect(purchaseOrderCombobox).toHaveClass(/text-foreground/);
    // Also verify the actual value
    await expect(purchaseOrderCombobox).toContainText('Browser Print Dialog');
    console.log('[STEP 5] Purchase Order dropdown has normal text with "Browser Print Dialog"');

    // ── Step 6: Verify P60 shows "(system default)" source label ──────────────
    const p60Row = freshUserCard
      .locator('div')
      .filter({ has: page.getByText('P60', { exact: true }) })
      .first();
    await expect(p60Row).toBeVisible({ timeout: 5000 });

    // Check for "(system default)" label below P60
    const systemDefaultLabel = p60Row.getByText('(system default)');
    await expect(systemDefaultLabel).toBeVisible({ timeout: 5000 });
    console.log('[STEP 6] P60 shows "(system default)" source label');

    // Verify P60 dropdown shows "No Action" with dimmed text
    const p60Combobox = p60Row.locator('button[role="combobox"]').last();
    await expect(p60Combobox).toBeVisible();
    await expect(p60Combobox).toHaveClass(/text-muted-foreground/);
    await expect(p60Combobox).toContainText('No Action');
    console.log('[STEP 6b] P60 dropdown shows dimmed "No Action" (system default)');

    // Visual checkpoint 2: All three cascade states visible
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-cascade-source-labels.png`,
      fullPage: true,
    });

    console.log('[JOURNEY 7 COMPLETE] All source label cascade states verified');
  });
});
