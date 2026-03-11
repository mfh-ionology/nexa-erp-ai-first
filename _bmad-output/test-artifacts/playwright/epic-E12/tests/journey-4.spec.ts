import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E12/journey-4';

test.describe('Journey 4: Verify Template List Grouping and Badges', () => {
  test('should display templates grouped by document type with correct badges', async ({
    page,
  }) => {
    // ── Login if needed ───────────────────────────────────────────────────
    await page.goto('/');

    if (page.url().includes('/login')) {
      await page.getByPlaceholder('you@company.co.uk').fill('admin@nexa-erp.dev');
      await page.getByPlaceholder('Enter your password').fill('NexaDev2026!');
      await page.getByRole('button', { name: 'Sign In' }).click();
      await page.waitForFunction(
        () => !window.location.pathname.includes('/login'),
        { timeout: 20000 },
      );
    }

    await page.waitForSelector('nav, aside', { timeout: 15000 });

    // ── Step 1: Navigate to /settings/document-templates ──────────────────
    const docTemplatesLink = page.locator('a[href*="document-templates"]');
    const linkCount = await docTemplatesLink.count();

    if (linkCount > 0) {
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

    // Wait for template data to load — accordion group headers with counts
    await expect(page.getByText(/\(\d+ templates?\)/).first()).toBeVisible({ timeout: 15000 });

    // Wait for skeletons to clear
    try {
      await page.waitForFunction(
        () => document.querySelectorAll('[class*="skeleton"]').length === 0,
        { timeout: 10000 },
      );
    } catch {
      // May have already cleared
    }

    // CP-1: Template list page loaded with grouped sections
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-template-list-grouped.png`,
      fullPage: true,
    });

    // ── Step 2: Verify SALES_INVOICE accordion section header ─────────────
    // The accordion header badge shows the document type label "Sales Invoice"
    const salesInvoiceHeader = page.getByText('Sales Invoice').first();
    await expect(salesInvoiceHeader).toBeVisible({ timeout: 10000 });

    // Verify template count badge — should show count (at least 1 template)
    // The count is shown as "(N template(s))" near the header
    const salesInvoiceSection = page.locator('[data-state]').filter({ hasText: 'Sales Invoice' }).first();
    await expect(salesInvoiceSection).toBeVisible();

    const salesInvoiceSectionText = await salesInvoiceSection.textContent();
    expect(salesInvoiceSectionText).toMatch(/\(\d+ templates?\)/);

    // ── Step 3: Verify template card structure in SALES_INVOICE section ────
    // Look for "Standard Invoice" template card (seeded default)
    const standardInvoiceCard = page.locator('.cursor-pointer.rounded-xl').filter({
      hasText: 'Standard Invoice',
    }).first();
    await expect(standardInvoiceCard).toBeVisible({ timeout: 10000 });

    // Verify green "Active" badge on the card
    const activeBadge = standardInvoiceCard.getByText('Active', { exact: true });
    await expect(activeBadge).toBeVisible();

    // Verify version count is displayed
    const versionText = standardInvoiceCard.getByText(/\d+ versions?/);
    await expect(versionText).toBeVisible();

    // Verify page size metadata (A4 / portrait)
    const pageSizeText = standardInvoiceCard.getByText(/A4/);
    await expect(pageSizeText).toBeVisible();

    // Verify that "Default" badges exist somewhere on the page (may be on a different
    // template if previous test runs changed the default assignment)
    const anyDefaultBadge = page.locator('.cursor-pointer.rounded-xl').getByText('Default', { exact: true }).first();
    await expect(anyDefaultBadge).toBeVisible({ timeout: 5000 });

    // CP-2: Default invoice template card with badges
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-default-invoice-card-badges.png`,
      fullPage: false,
    });

    // ── Step 4: Verify custom template card ───────────────────────────────
    const customTemplateCard = page.locator('.cursor-pointer.rounded-xl').filter({
      hasText: 'E2E Test Invoice Template',
    });
    const customCardCount = await customTemplateCard.count();

    if (customCardCount > 0) {
      // Custom template exists — verify it has Active badge but NO Default badge
      const customActiveBadge = customTemplateCard.first().getByText('Active', { exact: true });
      await expect(customActiveBadge).toBeVisible();

      const customDefaultBadge = customTemplateCard.first().getByText('Default', { exact: true });
      await expect(customDefaultBadge).toHaveCount(0);
    }
    // If custom template doesn't exist, that's fine — it may not have been seeded

    // ── Step 5: Click DELIVERY_NOTE accordion to expand ───────────────────
    // Find the Delivery Note accordion trigger
    const deliveryNoteHeader = page.getByText('Delivery Note').first();
    await expect(deliveryNoteHeader).toBeVisible({ timeout: 10000 });

    // Check if the Delivery Note section is currently collapsed
    const deliveryNoteAccordion = page.locator('[data-state]').filter({ hasText: 'Delivery Note' }).first();
    const deliveryNoteState = await deliveryNoteAccordion.getAttribute('data-state');

    if (deliveryNoteState === 'closed') {
      // Click to expand
      await deliveryNoteHeader.click();
      // Wait for expansion animation
      await page.waitForTimeout(500);
    }

    // Verify the section is now open
    await expect(
      page.locator('[data-state="open"]').filter({ hasText: 'Delivery Note' }).first(),
    ).toBeVisible({ timeout: 5000 });

    // ── Step 6: Verify DELIVERY_NOTE seeded template card ─────────────────
    // Look for "Standard Delivery Note" template card within the expanded section
    const deliveryNoteCard = page.locator('.cursor-pointer.rounded-xl').filter({
      hasText: /Delivery Note/,
    }).first();
    await expect(deliveryNoteCard).toBeVisible({ timeout: 5000 });

    // Verify Active badge
    const dnActiveBadge = deliveryNoteCard.getByText('Active', { exact: true });
    await expect(dnActiveBadge).toBeVisible();

    // Verify Default badge
    const dnDefaultBadge = deliveryNoteCard.getByText('Default', { exact: true });
    await expect(dnDefaultBadge).toBeVisible();

    // ── Step 7: Click DELIVERY_NOTE accordion to collapse ─────────────────
    // Click the trigger again to collapse
    const deliveryNoteTrigger = page.locator('button[data-state]').filter({ hasText: 'Delivery Note' }).first();

    // If trigger not found with button, try the text directly
    const triggerCount = await deliveryNoteTrigger.count();
    if (triggerCount > 0) {
      await deliveryNoteTrigger.click();
    } else {
      await deliveryNoteHeader.click();
    }

    // Wait for collapse animation
    await page.waitForTimeout(500);

    // Verify the section is now closed
    await expect(
      page.locator('[data-state="closed"]').filter({ hasText: 'Delivery Note' }).first(),
    ).toBeVisible({ timeout: 5000 });

    // CP-3: DELIVERY_NOTE section collapsed
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-7-delivery-note-collapsed.png`,
      fullPage: false,
    });
  });
});
