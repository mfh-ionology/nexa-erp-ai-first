import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '_bmad-output/test-artifacts/screenshots/epic-E10/journey-6';

/**
 * Helper: navigate within the SPA using TanStack Router.
 * Auth tokens are in-memory only (Zustand), so page.goto() would
 * cause a full reload and lose the authenticated session.
 */
async function spaNavigate(
  page: import('@playwright/test').Page,
  path: string,
) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await page.waitForTimeout(500);
  await page.waitForLoadState('networkidle');
}

test.describe('Journey 6: Switch Email Template via Template Selector', () => {
  test.setTimeout(90_000);

  test.beforeEach(async ({ page }) => {
    // Login as admin user
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const emailInput = page.getByLabel('Email');
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.fill('admin@nexa-erp.dev');

    const passwordInput = page.getByLabel('Password');
    await passwordInput.fill('NexaDev2026!');

    const signInButton = page.getByRole('button', { name: /sign in/i });
    await signInButton.waitFor({ state: 'visible' });
    await signInButton.click();

    // Wait for navigation away from /login
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 30000,
    });
    await page.waitForLoadState('networkidle');
  });

  test('should switch email template and reset fields to template values', async ({
    page,
  }) => {
    // Step 1: Navigate to AR Invoices list page
    await spaNavigate(page, '/ar/invoices');

    const pageHeading = page
      .getByRole('heading', { name: /invoices/i })
      .or(page.getByText('Invoices', { exact: true }));
    await expect(pageHeading.first()).toBeVisible({ timeout: 15000 });

    // Step 2: Click on a POSTED invoice and open email dialog
    const firstInvoiceLink = page.getByText('INV-2026-0042');
    await expect(firstInvoiceLink).toBeVisible({ timeout: 10000 });
    await firstInvoiceLink.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify invoice detail page loaded
    const detailHeading = page.locator('h1').filter({ hasText: /INV-2026-0042/ });
    await expect(detailHeading).toBeVisible({ timeout: 10000 });

    // Open overflow menu and click Email to Customer
    const overflowButton = page
      .locator('svg.lucide-more-horizontal, svg.lucide-ellipsis')
      .first()
      .locator('..');
    await expect(overflowButton).toBeVisible({ timeout: 10000 });
    await overflowButton.click();
    await page.waitForTimeout(500);

    const emailMenuItem = page.getByText('Email to Customer');
    await expect(emailMenuItem).toBeVisible({ timeout: 5000 });
    await emailMenuItem.click();
    await page.waitForTimeout(2000);

    // Verify email composition dialog is open
    const emailDialog = page.getByRole('dialog');
    await expect(emailDialog.first()).toBeVisible({ timeout: 10000 });

    // Wait for preview data to load
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle');

    // Visual checkpoint 1: Dialog opened
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-email-dialog-opened.png`,
      fullPage: false,
    });

    // Step 3: Verify template selector dropdown is visible
    // The TemplateSelector uses a Radix Select with role="combobox"
    // It returns null if templates.length === 0, so check for its presence
    const templateSelector = emailDialog.first().locator('[role="combobox"]').first();
    const templateSelectorVisible = await templateSelector.isVisible().catch(() => false);

    // Also check for "Reset to Template" button which only renders when templates exist
    const resetButton = emailDialog.first().getByText('Reset to Template');
    const resetButtonVisible = await resetButton.isVisible().catch(() => false);

    if (!templateSelectorVisible) {
      // MISSING FUNCTIONALITY: Template selector not rendered — no templates loaded
      // Take screenshot documenting the missing template selector
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-3-template-selector-MISSING.png`,
        fullPage: false,
      });

      // Verify the subject field is present (even if empty)
      const subjectInput = emailDialog.first().getByPlaceholder('Email subject');
      await expect(subjectInput).toBeVisible({ timeout: 5000 });

      // Document as test failure — template selector is required for this journey
      expect(
        templateSelectorVisible,
        'Template selector dropdown should be visible in the email dialog. ' +
          'The TemplateSelector component returns null when templates array is empty, ' +
          'indicating the API is not returning email templates for this document type. ' +
          'This is likely because email templates are not seeded or the template fetch API is not working.',
      ).toBe(true);
    }

    // --- Steps 4-7 would continue here if template selector was present ---

    // Step 4: Modify subject manually
    const subjectInput = emailDialog.first().getByPlaceholder('Email subject');
    await expect(subjectInput).toBeVisible({ timeout: 5000 });
    const originalSubject = await subjectInput.inputValue();

    await subjectInput.clear();
    await subjectInput.fill('Custom subject override');
    await page.waitForTimeout(500);

    // Visual checkpoint 2: Subject manually modified
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-subject-manually-modified.png`,
      fullPage: false,
    });

    // Step 5: Click template selector to see available templates
    await templateSelector.click();
    await page.waitForTimeout(500);

    const dropdownContent = page.locator('[role="listbox"]');
    await expect(dropdownContent).toBeVisible({ timeout: 5000 });

    // Visual checkpoint 3: Template dropdown open
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-template-dropdown-open.png`,
      fullPage: false,
    });

    // Step 6: Select a template option
    const templateOptions = page.locator('[role="option"]');
    const optionCount = await templateOptions.count();
    expect(optionCount).toBeGreaterThan(0);

    if (optionCount > 1) {
      await templateOptions.nth(1).click();
    } else {
      await templateOptions.first().click();
    }
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');

    // Step 7: Click Reset to Template
    await expect(resetButton).toBeVisible({ timeout: 5000 });
    await resetButton.click();
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');

    // Verify subject was restored
    const restoredSubject = await subjectInput.inputValue();
    expect(restoredSubject).not.toBe('Custom subject override');
    expect(restoredSubject.length).toBeGreaterThan(0);

    // Verify body has content
    const bodyTextarea = emailDialog.first().getByPlaceholder('Email body');
    await expect(bodyTextarea).toBeVisible({ timeout: 5000 });
    const bodyValue = await bodyTextarea.inputValue();
    expect(bodyValue.length).toBeGreaterThan(20);

    // Visual checkpoint 4: Fields reset to template values
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-7-fields-reset-to-template.png`,
      fullPage: false,
    });
  });
});
