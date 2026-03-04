import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '_bmad-output/test-artifacts/screenshots/epic-E10/journey-3';

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

test.describe('Journey 3: Add CC and BCC Recipients', () => {
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

  test('should add CC and BCC recipients using chip inputs', async ({
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

    // Step 3: Open overflow menu and click "Email to Customer"
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

    // Wait for async preview data to load
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle');

    // Step 4: Verify "+ Cc" toggle link is visible
    const ccToggle = emailDialog.first().getByText('+ Cc');
    await expect(ccToggle).toBeVisible({ timeout: 5000 });

    // Step 5: Click "+ Cc" toggle to expand CC field
    await ccToggle.click();
    await page.waitForTimeout(500);

    // Verify CC field is now visible — locate by label text "Cc"
    const ccLabel = emailDialog.first().getByText('Cc', { exact: true });
    await expect(ccLabel).toBeVisible({ timeout: 5000 });

    // CC input: initially has placeholder since no chips yet
    const ccInput = emailDialog.first().getByPlaceholder('Add Cc recipient');
    await expect(ccInput).toBeVisible({ timeout: 5000 });

    // Verify "+ Bcc" toggle is now visible
    const bccToggle = emailDialog.first().getByText('+ Bcc');
    await expect(bccToggle).toBeVisible({ timeout: 5000 });

    // Visual checkpoint 1: CC field expanded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-cc-field-expanded.png`,
      fullPage: false,
    });

    // Step 6-7: Type first CC email and press Enter to create chip
    await ccInput.fill('finance@partner.com');
    await ccInput.press('Enter');
    await page.waitForTimeout(500);

    // Verify first CC chip was created
    const ccChip1 = emailDialog
      .first()
      .locator('button[aria-label="Remove finance@partner.com"]');
    await expect(ccChip1).toBeVisible({ timeout: 5000 });

    // Step 8-9: Type second CC email and press comma to create chip
    // After adding a chip, placeholder disappears — locate input by type within the Cc section
    // The Cc section has label "Cc" followed by a container with chips + input
    const ccSection = emailDialog.first().locator('label:has-text("Cc")').locator('..');
    const ccInputAfterChip = ccSection.locator('input[type="email"]');
    await expect(ccInputAfterChip).toBeVisible({ timeout: 5000 });
    await ccInputAfterChip.fill('manager@partner.com');
    // Press comma to create chip (alternative to Enter)
    await ccInputAfterChip.press(',');
    await page.waitForTimeout(500);

    // Verify second CC chip was created
    const ccChip2 = emailDialog
      .first()
      .locator('button[aria-label="Remove manager@partner.com"]');
    await expect(ccChip2).toBeVisible({ timeout: 5000 });

    // Step 10: Click "+ Bcc" toggle to expand BCC field
    await bccToggle.click();
    await page.waitForTimeout(500);

    // Verify BCC field is visible
    const bccInput = emailDialog.first().getByPlaceholder('Add Bcc recipient');
    await expect(bccInput).toBeVisible({ timeout: 5000 });

    // Step 11-12: Type BCC email and press Enter to create chip
    await bccInput.fill('audit@company.co.uk');
    await bccInput.press('Enter');
    await page.waitForTimeout(500);

    // Verify BCC chip was created
    const bccChip = emailDialog
      .first()
      .locator('button[aria-label="Remove audit@company.co.uk"]');
    await expect(bccChip).toBeVisible({ timeout: 5000 });

    // Visual checkpoint 2: All CC and BCC chips visible
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-12-cc-bcc-chips-added.png`,
      fullPage: false,
    });

    // Final verification: all CC and BCC chips are still present
    await expect(ccChip1).toBeVisible();
    await expect(ccChip2).toBeVisible();
    await expect(bccChip).toBeVisible();
  });
});
