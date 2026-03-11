import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E12/journey-3';

test.describe('Journey 3: Create a Credit Note Template for Filter Testing', () => {
  test('should create a CREDIT_NOTE template with A5 landscape settings', async ({
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

    // Navigate to document templates page
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

    // Wait for page content and skeletons to clear
    await page.waitForSelector('h1, h2, button, [class*="skeleton"]', { timeout: 10000 });
    try {
      await page.waitForFunction(
        () => document.querySelectorAll('[class*="skeleton"]').length === 0,
        { timeout: 15000 },
      );
    } catch {
      // Skeletons may have already disappeared
    }

    // Verify Add Template button is present (confirms page loaded)
    const addTemplateButton = page.getByRole('button', { name: /add template/i });
    await expect(addTemplateButton).toBeVisible({ timeout: 10000 });

    // CP-1: Document Templates page loaded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-document-templates-loaded.png`,
      fullPage: false,
    });

    // ── Step 2: Click "Add Template" button ─────────────────────────────
    await addTemplateButton.click();

    // Wait for the editor form to appear
    await page.waitForSelector('form, [data-testid="template-editor"]', { timeout: 10000 });

    // CP-2: Template editor form opened
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-template-editor-form.png`,
      fullPage: true,
    });

    // ── Step 3: Fill the template editor form with CREDIT_NOTE data ─────

    // Select Document Type: CREDIT_NOTE
    const documentTypeSelect = page.locator('button[role="combobox"]').first();
    await expect(documentTypeSelect).toBeVisible({ timeout: 5000 });
    await documentTypeSelect.click();
    await page.waitForSelector('[role="option"]', { timeout: 5000 });
    await page.getByRole('option', { name: /credit note/i }).click();

    // Fill Name
    const nameInput = page.getByLabel(/name/i).first();
    await expect(nameInput).toBeVisible();
    await nameInput.fill('E2E Credit Note Compact');

    // Fill Description
    const descriptionField = page.getByLabel(/description/i);
    if (await descriptionField.isVisible()) {
      await descriptionField.fill('Compact credit note layout for E2E testing');
    } else {
      const descTextarea = page.locator('textarea').first();
      await descTextarea.fill('Compact credit note layout for E2E testing');
    }

    // Page Size: A5
    const pageSizeSelect = page.getByLabel(/page size/i);
    if (await pageSizeSelect.isVisible()) {
      await pageSizeSelect.click();
      await page.waitForSelector('[role="option"]', { timeout: 3000 });
      await page.getByRole('option', { name: /a5/i }).click();
    } else {
      const comboboxes = page.locator('button[role="combobox"]');
      const comboboxCount = await comboboxes.count();
      if (comboboxCount >= 2) {
        await comboboxes.nth(1).click();
        await page.waitForSelector('[role="option"]', { timeout: 3000 });
        const a5Option = page.getByRole('option', { name: /a5/i });
        if (await a5Option.isVisible()) {
          await a5Option.click();
        }
      }
    }

    // Orientation: Landscape
    const orientationSelect = page.getByLabel(/orientation/i);
    if (await orientationSelect.isVisible()) {
      await orientationSelect.click();
      await page.waitForSelector('[role="option"]', { timeout: 3000 });
      await page.getByRole('option', { name: /landscape/i }).click();
    } else {
      const comboboxes = page.locator('button[role="combobox"]');
      const comboboxCount = await comboboxes.count();
      if (comboboxCount >= 3) {
        await comboboxes.nth(2).click();
        await page.waitForSelector('[role="option"]', { timeout: 3000 });
        const landscapeOption = page.getByRole('option', { name: /landscape/i });
        if (await landscapeOption.isVisible()) {
          await landscapeOption.click();
        }
      }
    }

    // Branding toggles — set specific states per test plan
    // Show Logo: OFF (should be default off, but ensure)
    const showLogoSwitch = page.getByLabel(/show logo/i);
    if (await showLogoSwitch.isVisible()) {
      const isChecked = await showLogoSwitch.isChecked();
      if (isChecked) {
        await showLogoSwitch.click(); // Turn off
      }
    }

    // Show Bank Details: OFF (should be default off, but ensure)
    const showBankDetailsSwitch = page.getByLabel(/show bank details|bank details/i);
    if (await showBankDetailsSwitch.isVisible()) {
      const isChecked = await showBankDetailsSwitch.isChecked();
      if (isChecked) {
        await showBankDetailsSwitch.click(); // Turn off
      }
    }

    // Show VAT Number: ON
    const showVatSwitch = page.getByLabel(/show vat|vat number/i);
    if (await showVatSwitch.isVisible()) {
      const isChecked = await showVatSwitch.isChecked();
      if (!isChecked) {
        await showVatSwitch.click(); // Turn on
      }
    }

    // Show Company Reg: OFF (should be default off, but ensure)
    const showCompanyRegSwitch = page.getByLabel(/show company|company reg/i);
    if (await showCompanyRegSwitch.isVisible()) {
      const isChecked = await showCompanyRegSwitch.isChecked();
      if (isChecked) {
        await showCompanyRegSwitch.click(); // Turn off
      }
    }

    // HTML Template
    const htmlTemplateContent =
      '<html><body><h1>CREDIT NOTE</h1><p>{{document.number}}</p><p>{{counterparty.name}}</p>{{#each lines}}<p>{{description}}: {{formatCurrency lineTotal ../metadata.currencyCode}}</p>{{/each}}<p>Total Credit: {{formatCurrency totals.total metadata.currencyCode}}</p></body></html>';

    const htmlLabel = page.getByLabel(/html template/i);
    if (await htmlLabel.isVisible()) {
      await htmlLabel.fill(htmlTemplateContent);
    } else {
      // Fallback: find the large textarea (min-height >= 300px)
      const textareas = page.locator('textarea');
      const textareaCount = await textareas.count();
      for (let i = 0; i < textareaCount; i++) {
        const ta = textareas.nth(i);
        const minHeight = await ta.evaluate((el) => window.getComputedStyle(el).minHeight);
        if (minHeight === '400px' || parseInt(minHeight) >= 300) {
          await ta.fill(htmlTemplateContent);
          break;
        }
      }
    }

    // isDefault: false — no action needed, checkbox should be unchecked by default
    // If there's a "Set as Default" checkbox, ensure it's unchecked
    const defaultCheckbox = page.getByLabel(/default|set as default/i);
    if (await defaultCheckbox.isVisible()) {
      const isChecked = await defaultCheckbox.isChecked();
      if (isChecked) {
        await defaultCheckbox.click(); // Uncheck
      }
    }

    // CP-3: Form populated with Credit Note data
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-form-populated.png`,
      fullPage: true,
    });

    // ── Step 4: Click Save/Create Template button ───────────────────────
    const saveButton = page.getByRole('button', { name: /create template|save/i });
    await expect(saveButton).toBeVisible();
    await saveButton.click();

    // Wait for success indicators
    try {
      await Promise.race([
        page.waitForSelector('[data-sonner-toast], [role="status"]', { timeout: 15000 }),
        page.getByText(/template created/i).waitFor({ timeout: 15000 }),
        page.getByRole('button', { name: /add template/i }).waitFor({ timeout: 15000 }),
      ]);
    } catch {
      // May have validation errors — screenshot will capture state
    }

    // Brief wait for toast animation
    await page.waitForTimeout(500);

    // CP-4: Save success — toast and list refresh
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-save-success.png`,
      fullPage: false,
    });

    // Verify the template was created and appears in the list
    // The new template should be visible in the CREDIT_NOTE section
    const newTemplateText = page.getByText('E2E Credit Note Compact');
    await expect(newTemplateText).toBeVisible({ timeout: 15000 });

    // Verify Credit Note section exists with the template
    const creditNoteSection = page.getByText(/credit note/i).first();
    await expect(creditNoteSection).toBeVisible();

    // Verify Active badge is shown on the new template
    await expect(page.getByText('Active', { exact: true }).first()).toBeVisible();
  });
});
