import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '_bmad-output/test-artifacts/screenshots/epic-E10/journey-1';

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

test.describe('Journey 1: Open Email Dialog from Invoice Detail', () => {
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

  test('should navigate to a posted invoice and open the email composition dialog via overflow menu', async ({
    page,
  }) => {
    // Step 1: Navigate to AR Invoices list page via SPA
    await spaNavigate(page, '/ar/invoices');

    // Wait for the "Invoices" heading to appear
    const pageHeading = page.getByRole('heading', { name: /invoices/i }).or(
      page.getByText('Invoices', { exact: true }),
    );
    await expect(pageHeading.first()).toBeVisible({ timeout: 15000 });

    // Wait for invoice rows to load
    const firstInvoiceLink = page.getByText('INV-2026-0042');
    await expect(firstInvoiceLink).toBeVisible({ timeout: 10000 });

    // Screenshot checkpoint 1: Invoice list page loaded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-invoice-list-page.png`,
      fullPage: false,
    });

    // Step 2: Click on the first invoice (INV-2026-0042) to navigate to detail
    await firstInvoiceLink.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify we're on the invoice detail page — look for line items or invoice header
    // The detail page shows "INV-2026-0042" as a heading and has action buttons
    const detailHeading = page.locator('h1').filter({ hasText: /INV-2026-0042/ });
    await expect(detailHeading).toBeVisible({ timeout: 10000 });

    // Step 3: Verify action bar with overflow menu (More Actions ⋯ button)
    // The overflow trigger is an icon-only button with MoreHorizontal SVG
    // It's in the action bar area next to "Send Reminder" and "Print"
    // Locate it as a button with data-state attribute (Radix dropdown trigger)
    // that's near the action buttons (not the page-level ⋯ button)
    const actionBar = page.locator('.flex.items-center.gap-2').filter({
      has: page.locator('svg.lucide-more-horizontal'),
    });

    // Find the MoreHorizontal icon button within the action bar
    const overflowButton = actionBar.locator('button').filter({
      has: page.locator('svg.lucide-more-horizontal'),
    });

    // Fallback: find button with MoreHorizontal icon that's near Send Reminder
    const overflowAlt = page
      .locator('svg.lucide-more-horizontal, svg.lucide-ellipsis')
      .first()
      .locator('..');

    let menuTrigger = overflowButton.first();
    if (!(await menuTrigger.isVisible().catch(() => false))) {
      menuTrigger = overflowAlt;
    }

    await expect(menuTrigger).toBeVisible({ timeout: 10000 });

    // Screenshot checkpoint 2: Invoice detail page with action bar
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-invoice-detail-action-bar.png`,
      fullPage: false,
    });

    // Step 4: Click the overflow menu button
    await menuTrigger.click();
    await page.waitForTimeout(500);

    // Step 5: Verify "Email to Customer" menu item is visible in dropdown
    const emailMenuItem = page.getByText('Email to Customer');
    await expect(emailMenuItem).toBeVisible({ timeout: 5000 });

    // Screenshot checkpoint 3: Overflow menu with Email action visible
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-overflow-menu-email-action.png`,
      fullPage: false,
    });

    // Step 6: Click "Email to Customer" menu item
    await emailMenuItem.click();
    await page.waitForTimeout(2000);

    // Step 7: Verify email composition dialog is visible
    const emailDialog = page.getByRole('dialog');
    await expect(emailDialog.first()).toBeVisible({ timeout: 10000 });

    // Verify Send button is present in dialog
    const sendButton = emailDialog
      .first()
      .getByRole('button', { name: /send/i });
    await expect(sendButton.first()).toBeVisible();

    // Verify Cancel button is present in dialog
    const cancelButton = emailDialog
      .first()
      .getByRole('button', { name: /cancel/i });
    await expect(cancelButton.first()).toBeVisible();

    // Screenshot checkpoint 4: Email composition dialog open
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-7-email-composition-dialog.png`,
      fullPage: false,
    });
  });
});
