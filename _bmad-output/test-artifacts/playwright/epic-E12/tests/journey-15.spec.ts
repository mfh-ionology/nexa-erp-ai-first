import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E12/journey-15';

test.describe('Journey 15: Verify Duplicate Name Constraint (409 Conflict)', () => {
  test('should show 409 conflict error when creating a template with a duplicate name and document type', async ({ page }) => {
    // ── Setup: Navigate and authenticate ──────────────────────────────
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

    // ── Navigate to document templates page ───────────────────────────
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

    // Wait for template list to load
    await expect(page.getByText(/\(\d+ templates?\)/).first()).toBeVisible({ timeout: 15000 });

    // Wait for skeletons to clear
    try {
      await page.waitForFunction(
        () => document.querySelectorAll('[class*="skeleton"]').length === 0,
        { timeout: 10000 },
      );
    } catch {
      // Already gone
    }

    // ── Setup: Create the initial template so we have something to duplicate ──
    // First check if "E2E Test Invoice Template" already exists (from prior journey run)
    const existingTemplate = page.getByText('E2E Test Invoice Template');
    const alreadyExists = await existingTemplate.isVisible().catch(() => false);

    if (!alreadyExists) {
      // Create the first template so we have a name to conflict against
      const addBtn = page.getByRole('button', { name: /Add Template/i });
      await expect(addBtn).toBeVisible({ timeout: 5000 });
      await addBtn.click();

      await expect(
        page.locator('h2', { hasText: 'New Template' }),
      ).toBeVisible({ timeout: 10000 });

      // Select SALES_INVOICE
      const docTypeSelect = page.locator('button[role="combobox"]').first();
      await docTypeSelect.click();
      await page.waitForTimeout(300);
      const salesInvoiceOption = page.getByRole('option', { name: /Sales Invoice/i });
      await expect(salesInvoiceOption).toBeVisible({ timeout: 5000 });
      await salesInvoiceOption.click();

      // Fill name
      const nameInput = page.locator('input[name="name"]').or(
        page.getByPlaceholder('e.g. Standard Invoice'),
      );
      await nameInput.first().fill('E2E Test Invoice Template');

      // Fill HTML template
      const htmlTextarea = page.getByPlaceholder('Enter Handlebars HTML template...');
      await htmlTextarea.fill('<html><body><h1>Test Invoice</h1></body></html>');

      // Click Create Template
      const createBtn = page.getByRole('button', { name: /Create Template/i });
      await createBtn.click();

      // Wait for success toast and return to list
      await expect(page.getByText(/\(\d+ templates?\)/).first()).toBeVisible({ timeout: 15000 });

      // Wait for list to settle
      await page.waitForTimeout(1000);
    }

    // ── Step 1: Verify template list loaded ───────────────────────────
    // CP-1: Template list loaded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-template-list-loaded.png`,
      fullPage: true,
    });

    // ── Step 2: Click "Add Template" button ───────────────────────────
    const addTemplateBtn = page.getByRole('button', { name: /Add Template/i });
    await expect(addTemplateBtn).toBeVisible({ timeout: 5000 });
    await addTemplateBtn.click();

    // Wait for editor form to render
    await expect(
      page.locator('h2', { hasText: 'New Template' }),
    ).toBeVisible({ timeout: 10000 });

    // ── Step 3: Fill form with duplicate name+type ────────────────────
    // Select SALES_INVOICE document type
    const docTypeSelect = page.locator('button[role="combobox"]').first();
    await docTypeSelect.click();
    await page.waitForTimeout(300);
    const salesInvoiceOption = page.getByRole('option', { name: /Sales Invoice/i });
    await expect(salesInvoiceOption).toBeVisible({ timeout: 5000 });
    await salesInvoiceOption.click();

    // Fill template name with the duplicate name
    const nameInput = page.locator('input[name="name"]').or(
      page.getByPlaceholder('e.g. Standard Invoice'),
    );
    await nameInput.first().fill('E2E Test Invoice Template');

    // Fill HTML template content
    const htmlTextarea = page.getByPlaceholder('Enter Handlebars HTML template...');
    await htmlTextarea.fill('<html><body>Duplicate test</body></html>');

    // CP-2: Form filled with duplicate data
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-form-filled-duplicate-data.png`,
      fullPage: true,
    });

    // ── Step 4: Click Save (Create Template) — expect 409 conflict ───
    const saveBtn = page.getByRole('button', { name: /Create Template/i });
    await expect(saveBtn).toBeVisible({ timeout: 5000 });
    await saveBtn.click();

    // Wait for the API call to complete and error toast to appear
    // The onError handler calls toast.error() for 409 conflicts
    await page.waitForTimeout(2000);

    // Check for error toast (sonner toasts appear in [data-sonner-toaster] or similar)
    const errorToast = page.locator('[data-sonner-toast][data-type="error"]').or(
      page.locator('[role="status"]').filter({ hasText: /duplicate|already exists|conflict/i }),
    ).or(
      page.locator('li[data-sonner-toast]').filter({ hasText: /duplicate|already exists/i }),
    );

    // Also check for any toast with relevant text (the i18n key is documentTemplates.error.duplicateName)
    const anyToastWithDuplicateText = page.getByText(/duplicate|already exists/i);

    const toastVisible = await errorToast.first().isVisible().catch(() => false);
    const duplicateTextVisible = await anyToastWithDuplicateText.first().isVisible().catch(() => false);

    // CP-3: 409 conflict error toast displayed
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-conflict-error-toast.png`,
      fullPage: true,
    });

    // Verify that some error feedback was shown
    expect(
      toastVisible || duplicateTextVisible,
      'Expected an error toast or duplicate name message to be visible after attempting to create a template with a duplicate name',
    ).toBeTruthy();

    // Verify form remains open (not dismissed) — the "New Template" heading should still be visible
    await expect(
      page.locator('h2', { hasText: 'New Template' }),
    ).toBeVisible({ timeout: 3000 });

    // ── Step 5: Click Cancel — return to list view ────────────────────
    const cancelBtn = page.getByRole('button', { name: /^Cancel$/i });
    await expect(cancelBtn.first()).toBeVisible({ timeout: 5000 });
    await cancelBtn.first().click();

    // Wait for list view to re-appear
    await expect(page.getByText(/\(\d+ templates?\)/).first()).toBeVisible({ timeout: 15000 });

    // CP-4: Back to list, no duplicate created
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-back-to-list-no-duplicate.png`,
      fullPage: true,
    });

    // Verify the editor is gone
    await expect(
      page.locator('h2', { hasText: 'New Template' }),
    ).not.toBeVisible({ timeout: 3000 });

    // Verify there is NOT a second "E2E Test Invoice Template" — count occurrences
    const templateNameOccurrences = page.getByText('E2E Test Invoice Template');
    const count = await templateNameOccurrences.count();
    expect(count).toBeLessThanOrEqual(1);
  });
});
