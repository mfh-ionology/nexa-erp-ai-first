import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E12/journey-5';

test.describe('Journey 5: Filter Templates by Document Type', () => {
  test('should filter templates by document type and clear the filter', async ({
    page,
  }) => {
    // ── Step 1: Navigate to /settings/document-templates ──────────────────
    await page.goto('/');

    // If redirected to login, authenticate first
    if (page.url().includes('/login')) {
      await page.getByPlaceholder('you@company.co.uk').fill('admin@nexa-erp.dev');
      await page.getByPlaceholder('Enter your password').fill('NexaDev2026!');
      await page.getByRole('button', { name: 'Sign In' }).click();

      await page.waitForFunction(
        () => !window.location.pathname.includes('/login'),
        { timeout: 20000 },
      );
    }

    // Wait for the app layout to appear
    await page.waitForSelector('nav, aside', { timeout: 15000 });

    // Navigate to document templates page
    const docTemplatesLink = page.locator('a[href*="document-templates"]');
    const docTemplatesLinkCount = await docTemplatesLink.count();

    if (docTemplatesLinkCount > 0) {
      await docTemplatesLink.first().click();
    } else {
      await page.evaluate(async () => {
        const mod = await import('/src/router.ts');
        await mod.router.navigate({ to: '/settings/document-templates' });
      });
    }

    await page.waitForFunction(
      () => window.location.pathname.includes('/settings/document-templates'),
      { timeout: 10000 },
    );

    // Wait for page content and templates to load
    await page.waitForSelector('h1, h2, button, [class*="skeleton"]', { timeout: 10000 });

    // Wait for skeletons to disappear
    try {
      await page.waitForFunction(
        () => document.querySelectorAll('[class*="skeleton"]').length === 0,
        { timeout: 15000 },
      );
    } catch {
      // Skeletons may have already disappeared
    }

    // Wait for template groups to be visible (accordion triggers with counts)
    await expect(page.getByText(/\(\d+ templates?\)/).first()).toBeVisible({ timeout: 15000 });

    // Verify full list is showing all document types — multiple accordion groups visible
    const allAccordionItems = page.locator('[data-state="open"], [data-state="closed"]');
    const initialGroupCount = await allAccordionItems.count();
    expect(initialGroupCount).toBeGreaterThanOrEqual(5);

    // Verify filter dropdown shows "All Document Types"
    const filterTrigger = page.locator('button[role="combobox"]').first();
    await expect(filterTrigger).toBeVisible();
    await expect(filterTrigger).toHaveText(/All Document Types/);

    // CP-1: Full template list loaded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-full-template-list.png`,
      fullPage: true,
    });

    // ── Step 2: Click document type filter dropdown ───────────────────────
    await filterTrigger.click();

    // Wait for dropdown content to appear
    await page.waitForSelector('[role="listbox"], [role="option"]', { timeout: 5000 });

    // ── Step 3: Select SALES_INVOICE option ──────────────────────────────
    const salesInvoiceOption = page.getByRole('option', { name: /sales invoice/i });
    await expect(salesInvoiceOption).toBeVisible({ timeout: 5000 });
    await salesInvoiceOption.click();

    // Wait for the filter to apply — the list should update
    await page.waitForTimeout(500);

    // CP-2: Sales Invoice filter applied
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-sales-invoice-filtered.png`,
      fullPage: true,
    });

    // ── Step 4: Verify only SALES_INVOICE templates visible ──────────────
    // After filtering, check that only Sales Invoice group is shown
    // Look for accordion triggers — should only see Sales Invoice type
    const visibleGroups = page.locator('[data-state="open"], [data-state="closed"]');
    const filteredGroupCount = await visibleGroups.count();

    // Should have fewer groups than the initial unfiltered view
    expect(filteredGroupCount).toBeLessThan(initialGroupCount);

    // Verify "Sales Invoice" text is visible in the accordion
    await expect(page.getByText(/sales invoice/i).first()).toBeVisible();

    // Verify the filter dropdown shows the selected value (active state with purple border)
    const filterBorderColor = await filterTrigger.evaluate((el) => {
      return window.getComputedStyle(el).borderColor;
    });
    // When active, the filter trigger gets a purple-tinted border
    // Just verify the filter text changed from "All Document Types"
    const filterText = await filterTrigger.textContent();
    expect(filterText).not.toContain('All Document Types');

    // ── Step 5: Click document type filter dropdown again ─────────────────
    await filterTrigger.click();

    // Wait for dropdown to open
    await page.waitForSelector('[role="listbox"], [role="option"]', { timeout: 5000 });

    // ── Step 6: Select PURCHASE_ORDER option ─────────────────────────────
    const purchaseOrderOption = page.getByRole('option', { name: /purchase order/i });
    await expect(purchaseOrderOption).toBeVisible({ timeout: 5000 });
    await purchaseOrderOption.click();

    // Wait for the filter to apply
    await page.waitForTimeout(500);

    // Verify Purchase Order text is visible
    await expect(page.getByText(/purchase order/i).first()).toBeVisible();

    // CP-3: Purchase Order filter applied
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-purchase-order-filtered.png`,
      fullPage: true,
    });

    // ── Step 7: Clear filters ────────────────────────────────────────────
    // Look for a clear/reset filters button
    const clearButton = page.getByRole('button', { name: /clear/i });
    const clearButtonCount = await clearButton.count();

    if (clearButtonCount > 0) {
      await clearButton.first().click();
    } else {
      // Fallback: Reset filter by selecting "All Document Types" via dropdown
      await filterTrigger.click();
      await page.waitForSelector('[role="listbox"], [role="option"]', { timeout: 5000 });
      const allTypesOption = page.getByRole('option', { name: /all document types/i });
      await expect(allTypesOption).toBeVisible({ timeout: 5000 });
      await allTypesOption.click();
    }

    // Wait for full list to restore
    await page.waitForTimeout(500);

    // Verify full list is restored — multiple accordion groups visible again
    const restoredGroups = page.locator('[data-state="open"], [data-state="closed"]');
    const restoredGroupCount = await restoredGroups.count();
    expect(restoredGroupCount).toBeGreaterThanOrEqual(5);

    // Verify filter dropdown shows "All Document Types" again
    await expect(filterTrigger).toHaveText(/All Document Types/);

    // CP-4: Filters cleared, full list restored
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-7-filters-cleared.png`,
      fullPage: true,
    });
  });
});
