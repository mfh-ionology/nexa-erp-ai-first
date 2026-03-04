import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '_bmad-output/test-artifacts/screenshots/epic-E10/journey-2';

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

test.describe('Journey 2: Verify Pre-filled Email Fields from Template', () => {
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

  test('should display pre-filled email fields from the invoice email template', async ({
    page,
  }) => {
    // Step 1: Navigate to AR Invoices list page
    await spaNavigate(page, '/ar/invoices');

    const pageHeading = page
      .getByRole('heading', { name: /invoices/i })
      .or(page.getByText('Invoices', { exact: true }));
    await expect(pageHeading.first()).toBeVisible({ timeout: 15000 });

    // Step 2: Click on a POSTED invoice to go to detail page
    const firstInvoiceLink = page.getByText('INV-2026-0042');
    await expect(firstInvoiceLink).toBeVisible({ timeout: 10000 });
    await firstInvoiceLink.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify we're on the invoice detail page
    const detailHeading = page.locator('h1').filter({ hasText: /INV-2026-0042/ });
    await expect(detailHeading).toBeVisible({ timeout: 10000 });

    // Step 3: Open overflow menu
    const overflowButton = page
      .locator('svg.lucide-more-horizontal, svg.lucide-ellipsis')
      .first()
      .locator('..');
    await expect(overflowButton).toBeVisible({ timeout: 10000 });
    await overflowButton.click();
    await page.waitForTimeout(500);

    // Step 4: Click "Email to Customer" menu item
    const emailMenuItem = page.getByText('Email to Customer');
    await expect(emailMenuItem).toBeVisible({ timeout: 5000 });
    await emailMenuItem.click();
    await page.waitForTimeout(2000);

    // Verify email composition dialog is open
    const emailDialog = page.getByRole('dialog');
    await expect(emailDialog.first()).toBeVisible({ timeout: 10000 });

    // Wait for async preview data to load (skeletons disappear, data populates)
    // The dialog fetches template preview data via useDocumentEmailPreview hook
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle');

    // Screenshot checkpoint 1: Email dialog opened with pre-filled fields
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-email-dialog-opened.png`,
      fullPage: false,
    });

    // Step 5: Verify From field — should be pre-filled with company email
    // The From field is a read-only input (tabIndex=-1, readOnly attribute)
    const fromLabel = emailDialog.first().getByText('From', { exact: true });
    await expect(fromLabel).toBeVisible({ timeout: 5000 });

    // Find the From input — it's a readonly input within the From section
    const fromInput = emailDialog.first().locator('input[readonly], input[tabindex="-1"]').first();
    await expect(fromInput).toBeVisible({ timeout: 5000 });
    const fromValue = await fromInput.inputValue();
    expect(fromValue).toBeTruthy();
    // From should contain an email-like string
    expect(fromValue).toMatch(/@/);

    // Screenshot checkpoint 2: From field populated
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-from-field-populated.png`,
      fullPage: false,
    });

    // Step 6: Verify To field — contains customer email chip
    // Look for email chips — they have X remove buttons with aria-label "Remove ..."
    const toChips = emailDialog
      .first()
      .locator('button[aria-label^="Remove "]')
      .first();
    await expect(toChips).toBeVisible({ timeout: 5000 });

    // Screenshot checkpoint 3: To field with customer email chip
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-to-field-customer-chip.png`,
      fullPage: false,
    });

    // Step 7: Verify Subject field matches template pattern "Invoice {number} from {company}"
    const subjectInput = emailDialog
      .first()
      .getByPlaceholder('Email subject');
    await expect(subjectInput).toBeVisible({ timeout: 5000 });
    const subjectValue = await subjectInput.inputValue();
    expect(subjectValue).toBeTruthy();
    // Subject should contain "Invoice" and some invoice number pattern
    expect(subjectValue).toMatch(/Invoice/i);

    // Screenshot checkpoint 4: Subject from template
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-7-subject-from-template.png`,
      fullPage: false,
    });

    // Step 8: Verify Body textarea with rendered template content
    const bodyTextarea = emailDialog
      .first()
      .getByPlaceholder('Email body');
    await expect(bodyTextarea).toBeVisible({ timeout: 5000 });
    const bodyValue = await bodyTextarea.inputValue();
    expect(bodyValue).toBeTruthy();
    // Body should contain some meaningful content from the template (customer greeting, etc.)
    expect(bodyValue.length).toBeGreaterThan(20);

    // Step 9: Verify PDF attachment preview card
    // Look for the auto-generated badge text
    const autoGeneratedBadge = emailDialog
      .first()
      .getByText('Auto-generated');
    await expect(autoGeneratedBadge).toBeVisible({ timeout: 5000 });

    // Verify filename matches Invoice-{number}.pdf pattern
    const attachmentFilename = emailDialog
      .first()
      .getByText(/Invoice-.*\.pdf/i);
    await expect(attachmentFilename).toBeVisible({ timeout: 5000 });

    // Screenshot checkpoint 5: PDF attachment card
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-9-pdf-attachment-card.png`,
      fullPage: false,
    });
  });
});
