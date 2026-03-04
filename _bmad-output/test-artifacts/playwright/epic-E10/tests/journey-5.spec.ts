import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '_bmad-output/test-artifacts/screenshots/epic-E10/journey-5';

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

test.describe('Journey 5: Duplicate Recipient Detection Across Fields', () => {
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

  test('should detect duplicate recipients across TO and CC fields with warning styling', async ({
    page,
  }) => {
    // Step 1: Navigate to AR Invoices list page
    await spaNavigate(page, '/ar/invoices');

    const pageHeading = page
      .getByRole('heading', { name: /invoices/i })
      .or(page.getByText('Invoices', { exact: true }));
    await expect(pageHeading.first()).toBeVisible({ timeout: 15000 });

    // Step 2: Click on a POSTED invoice, open overflow menu, click Email to Customer
    const firstInvoiceLink = page.getByText('INV-2026-0042');
    await expect(firstInvoiceLink).toBeVisible({ timeout: 10000 });
    await firstInvoiceLink.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify we're on the invoice detail page
    const detailHeading = page.locator('h1').filter({ hasText: /INV-2026-0042/ });
    await expect(detailHeading).toBeVisible({ timeout: 10000 });

    // Open overflow menu
    const overflowButton = page
      .locator('svg.lucide-more-horizontal, svg.lucide-ellipsis')
      .first()
      .locator('..');
    await expect(overflowButton).toBeVisible({ timeout: 10000 });
    await overflowButton.click();
    await page.waitForTimeout(500);

    // Click "Email to Customer"
    const emailMenuItem = page.getByText('Email to Customer');
    await expect(emailMenuItem).toBeVisible({ timeout: 5000 });
    await emailMenuItem.click();
    await page.waitForTimeout(2000);

    // Verify email composition dialog is open
    const emailDialog = page.getByRole('dialog');
    await expect(emailDialog.first()).toBeVisible({ timeout: 10000 });

    // Wait for async preview data to load
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle');

    // Determine the test email — either from pre-filled To chip or add one manually
    const testEmail = 'customer@example.com';

    // Check if To field has a pre-filled email chip
    const existingChip = emailDialog
      .first()
      .locator('button[aria-label^="Remove "]')
      .first();
    const hasPrefilledChip = await existingChip.isVisible().catch(() => false);

    let customerEmail: string;

    if (hasPrefilledChip) {
      // Use the pre-filled email from the API preview
      const ariaLabel = await existingChip.getAttribute('aria-label');
      customerEmail = ariaLabel?.replace('Remove ', '') ?? testEmail;
    } else {
      // No pre-filled email — manually add one to the To field
      customerEmail = testEmail;
      const toInput = emailDialog
        .first()
        .getByPlaceholder('Add recipient email');
      await expect(toInput).toBeVisible({ timeout: 5000 });
      await toInput.fill(customerEmail);
      await toInput.press('Enter');
      await page.waitForTimeout(500);

      // Verify chip was created in To field
      const toChip = emailDialog
        .first()
        .locator(`button[aria-label="Remove ${customerEmail}"]`);
      await expect(toChip).toBeVisible({ timeout: 5000 });
    }

    // Visual checkpoint 1: Dialog opened with email in To field
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-email-dialog-opened.png`,
      fullPage: false,
    });

    // Step 3: Click "+ Cc" toggle to expand CC field
    const ccToggle = emailDialog.first().getByText('+ Cc');
    await expect(ccToggle).toBeVisible({ timeout: 5000 });
    await ccToggle.click();
    await page.waitForTimeout(500);

    // Verify CC field is now visible
    const ccLabel = emailDialog.first().getByText('Cc', { exact: true });
    await expect(ccLabel).toBeVisible({ timeout: 5000 });

    // Step 4-5: Enter the same email as To field into the CC input and press Enter
    const ccInput = emailDialog.first().getByPlaceholder('Add Cc recipient');
    await expect(ccInput).toBeVisible({ timeout: 5000 });
    await ccInput.fill(customerEmail);
    await ccInput.press('Enter');
    await page.waitForTimeout(1000);

    // Verify the duplicate chip was created in CC field
    // There should now be at least 2 remove buttons for this email (one in To, one in Cc)
    const removeButtons = emailDialog
      .first()
      .locator(`button[aria-label="Remove ${customerEmail}"]`);
    const chipCount = await removeButtons.count();
    expect(chipCount).toBeGreaterThanOrEqual(2);

    // Verify the CC chip has warning/error styling (red indicator for duplicate)
    // The CC section's chip should have: bg-red-50 text-red-700 border-red-200
    const ccSection = emailDialog
      .first()
      .locator('label:has-text("Cc")')
      .locator('..');
    const ccChipSpan = ccSection
      .locator('span.inline-flex')
      .filter({ hasText: customerEmail });
    await expect(ccChipSpan).toBeVisible({ timeout: 5000 });

    // Verify the chip has the red/warning class (duplicate detection per BR-COM-002)
    const chipClass = await ccChipSpan.getAttribute('class');
    expect(chipClass).toContain('bg-red-50');
    expect(chipClass).toContain('text-red-700');

    // Visual checkpoint 2: Duplicate chip with warning styling
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-duplicate-chip-warning.png`,
      fullPage: false,
    });

    // Verify "Duplicate recipient" tooltip on hover
    await ccChipSpan.hover();
    await page.waitForTimeout(500);
    const tooltip = page.getByText('Duplicate recipient');
    await expect(tooltip).toBeVisible({ timeout: 5000 });
  });
});
