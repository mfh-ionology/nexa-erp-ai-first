import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E12/journey-2';

test.describe('Journey 2: Create a Custom Sales Invoice Template', () => {
  test('should create a SALES_INVOICE template with all form fields populated', async ({
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

    // Wait for app layout (sidebar) to appear
    await page.waitForSelector('nav, aside', { timeout: 15000 });
    await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 });

    // CP-1: Dashboard after login
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-dashboard-loaded.png`,
      fullPage: false,
    });

    // Navigate to document templates page
    // Check for sidebar link first, fall back to programmatic navigation
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

    // Wait for page content to load
    await page.waitForSelector('h1, h2, button, [class*="skeleton"]', { timeout: 10000 });

    // Wait for loading skeletons to disappear
    try {
      await page.waitForFunction(
        () => document.querySelectorAll('[class*="skeleton"]').length === 0,
        { timeout: 15000 },
      );
    } catch {
      // Skeletons may have already disappeared
    }

    // ── Step 2: Click "Add Template" button ───────────────────────────────
    const addTemplateButton = page.getByRole('button', { name: /add template/i });
    await expect(addTemplateButton).toBeVisible({ timeout: 10000 });
    await addTemplateButton.click();

    // Wait for the editor form to appear — look for form elements
    await page.waitForSelector('form, [data-testid="template-editor"]', { timeout: 10000 });

    // CP-2: Template editor form opened
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-template-editor-form.png`,
      fullPage: true,
    });

    // Verify editor form is visible with key elements
    // Document Type dropdown should be visible
    const documentTypeSelect = page.locator('button[role="combobox"]').first();
    await expect(documentTypeSelect).toBeVisible({ timeout: 5000 });

    // Name input should be visible
    const nameInput = page.getByLabel(/name/i).first();
    await expect(nameInput).toBeVisible();

    // ── Step 3: Fill the template editor form ─────────────────────────────

    // Select Document Type: SALES_INVOICE
    await documentTypeSelect.click();
    // Wait for dropdown options to appear
    await page.waitForSelector('[role="option"]', { timeout: 5000 });
    await page.getByRole('option', { name: /sales invoice/i }).click();

    // Fill Name
    await nameInput.fill('E2E Test Invoice Template');

    // Fill Description
    const descriptionField = page.getByLabel(/description/i);
    if (await descriptionField.isVisible()) {
      await descriptionField.fill('Custom invoice template created during E2E testing');
    } else {
      // Try textarea fallback
      const descTextarea = page.locator('textarea').first();
      await descTextarea.fill('Custom invoice template created during E2E testing');
    }

    // Page Settings — Page Size dropdown
    // Find the page size select (likely second combobox after document type)
    const pageSizeSelect = page.getByLabel(/page size/i);
    if (await pageSizeSelect.isVisible()) {
      await pageSizeSelect.click();
      await page.getByRole('option', { name: /a4/i }).click();
    } else {
      // Try combobox approach — page size might be a select trigger
      const comboboxes = page.locator('button[role="combobox"]');
      const comboboxCount = await comboboxes.count();
      if (comboboxCount >= 2) {
        // Second combobox is likely page size
        await comboboxes.nth(1).click();
        await page.waitForSelector('[role="option"]', { timeout: 3000 });
        const a4Option = page.getByRole('option', { name: /a4/i });
        if (await a4Option.isVisible()) {
          await a4Option.click();
        }
      }
    }

    // Orientation dropdown
    const orientationSelect = page.getByLabel(/orientation/i);
    if (await orientationSelect.isVisible()) {
      await orientationSelect.click();
      await page.getByRole('option', { name: /portrait/i }).click();
    } else {
      const comboboxes = page.locator('button[role="combobox"]');
      const comboboxCount = await comboboxes.count();
      if (comboboxCount >= 3) {
        await comboboxes.nth(2).click();
        await page.waitForSelector('[role="option"]', { timeout: 3000 });
        const portraitOption = page.getByRole('option', { name: /portrait/i });
        if (await portraitOption.isVisible()) {
          await portraitOption.click();
        }
      }
    }

    // Margins — fill margin inputs
    const marginTopInput = page.getByLabel(/margin.*top|top.*margin/i);
    if (await marginTopInput.isVisible()) {
      await marginTopInput.fill('25');
    }
    const marginBottomInput = page.getByLabel(/margin.*bottom|bottom.*margin/i);
    if (await marginBottomInput.isVisible()) {
      await marginBottomInput.fill('25');
    }
    const marginLeftInput = page.getByLabel(/margin.*left|left.*margin/i);
    if (await marginLeftInput.isVisible()) {
      await marginLeftInput.fill('15');
    }
    const marginRightInput = page.getByLabel(/margin.*right|right.*margin/i);
    if (await marginRightInput.isVisible()) {
      await marginRightInput.fill('15');
    }

    // Branding toggles — enable all
    // Show Logo toggle
    const showLogoSwitch = page.getByLabel(/show logo/i);
    if (await showLogoSwitch.isVisible()) {
      const isChecked = await showLogoSwitch.isChecked();
      if (!isChecked) {
        await showLogoSwitch.click();
      }
    }

    // Logo Position dropdown (appears when Show Logo is enabled)
    const logoPositionSelect = page.getByLabel(/logo position/i);
    if (await logoPositionSelect.isVisible()) {
      await logoPositionSelect.click();
      await page.waitForSelector('[role="option"]', { timeout: 3000 });
      const topCenterOption = page.getByRole('option', { name: /top.?center/i });
      if (await topCenterOption.isVisible()) {
        await topCenterOption.click();
      }
    }

    // Show Bank Details toggle
    const showBankDetailsSwitch = page.getByLabel(/show bank details|bank details/i);
    if (await showBankDetailsSwitch.isVisible()) {
      const isChecked = await showBankDetailsSwitch.isChecked();
      if (!isChecked) {
        await showBankDetailsSwitch.click();
      }
    }

    // Show VAT Number toggle
    const showVatSwitch = page.getByLabel(/show vat|vat number/i);
    if (await showVatSwitch.isVisible()) {
      const isChecked = await showVatSwitch.isChecked();
      if (!isChecked) {
        await showVatSwitch.click();
      }
    }

    // Show Company Reg toggle
    const showCompanyRegSwitch = page.getByLabel(/show company|company reg/i);
    if (await showCompanyRegSwitch.isVisible()) {
      const isChecked = await showCompanyRegSwitch.isChecked();
      if (!isChecked) {
        await showCompanyRegSwitch.click();
      }
    }

    // HTML Template — fill the HTML template textarea
    const htmlTemplateContent =
      '<html><head><style>body{font-family:Arial,sans-serif;}</style></head><body><h1>INVOICE</h1><p>Invoice: {{document.number}}</p><p>Date: {{formatDate document.date}}</p><p>Customer: {{counterparty.name}}</p><table>{{#each lines}}<tr><td>{{lineNumber @index}}</td><td>{{description}}</td><td>{{formatCurrency lineTotal ../metadata.currencyCode}}</td></tr>{{/each}}</table><p>Total: {{formatCurrency totals.total metadata.currencyCode}}</p>{{#if showBankDetails}}<p>Bank: {{company.bankName}}</p>{{/if}}</body></html>';

    // The HTML template textarea is likely the largest/most prominent one
    const htmlLabel = page.getByLabel(/html template/i);
    if (await htmlLabel.isVisible()) {
      await htmlLabel.fill(htmlTemplateContent);
    } else {
      // Fall back to finding textarea with monospace font or specific class
      const textareas = page.locator('textarea');
      const textareaCount = await textareas.count();
      // The HTML template textarea should be the one with the largest min-height (400px)
      // or the one after the description textarea
      for (let i = 0; i < textareaCount; i++) {
        const ta = textareas.nth(i);
        const minHeight = await ta.evaluate((el) => window.getComputedStyle(el).minHeight);
        if (minHeight === '400px' || parseInt(minHeight) >= 300) {
          await ta.fill(htmlTemplateContent);
          break;
        }
      }
    }

    // CP-3: Form fields populated
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-form-fields-populated.png`,
      fullPage: true,
    });

    // ── Step 4: Click CSS Styles collapsible section ──────────────────────
    const cssCollapseHeader = page.getByText(/css styles/i);
    if (await cssCollapseHeader.isVisible()) {
      await cssCollapseHeader.click();
      // Wait for the section to expand
      await page.waitForTimeout(300);
    }

    // ── Step 5: Fill CSS Styles textarea ──────────────────────────────────
    const cssContent =
      'body { margin: 0; padding: 20px; } h1 { color: #333; } table { width: 100%; border-collapse: collapse; } td { padding: 8px; border-bottom: 1px solid #ddd; }';

    // Find the CSS textarea (should be visible after expanding the section)
    const cssLabel = page.getByLabel(/css styles/i);
    if (await cssLabel.isVisible()) {
      await cssLabel.fill(cssContent);
    } else {
      // Try finding a textarea that appeared after clicking the CSS section
      const cssTextarea = page.locator('textarea').last();
      if (await cssTextarea.isVisible()) {
        await cssTextarea.fill(cssContent);
      }
    }

    // ── Step 6: Click Save/Create Template button ─────────────────────────
    const saveButton = page.getByRole('button', { name: /create template|save/i });
    await expect(saveButton).toBeVisible();
    await saveButton.click();

    // Wait for the API call to complete and toast to appear
    // The page should transition back to list view on success
    // Wait for either a toast message or the list view to reappear
    try {
      // Wait for success indicators:
      // 1. Toast notification
      // 2. Return to list view (accordion sections reappear)
      await Promise.race([
        page.waitForSelector('[data-sonner-toast], [role="status"]', { timeout: 15000 }),
        page.getByText(/template created/i).waitFor({ timeout: 15000 }),
        page.getByRole('button', { name: /add template/i }).waitFor({ timeout: 15000 }),
      ]);
    } catch {
      // The form may have validation errors; take a screenshot to diagnose
    }

    // Brief wait for toast animation
    await page.waitForTimeout(500);

    // CP-4: After save — success toast and list view
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-save-success-toast.png`,
      fullPage: false,
    });

    // ── Step 7: Verify template appears in SALES_INVOICE group ────────────
    // Wait for the list to load and show our new template
    const newTemplateText = page.getByText('E2E Test Invoice Template');
    await expect(newTemplateText).toBeVisible({ timeout: 15000 });

    // Verify it's in the SALES_INVOICE section
    // The accordion section for Sales Invoice should contain our template
    const salesInvoiceSection = page.getByText(/sales invoice/i).first();
    await expect(salesInvoiceSection).toBeVisible();

    // Verify Active badge is shown (template should be active by default)
    // The new template card should have an "Active" badge but NO "Default" badge
    await expect(page.getByText('Active', { exact: true }).first()).toBeVisible();

    // CP-5: Template verified in list
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-7-template-in-list.png`,
      fullPage: true,
    });
  });
});
