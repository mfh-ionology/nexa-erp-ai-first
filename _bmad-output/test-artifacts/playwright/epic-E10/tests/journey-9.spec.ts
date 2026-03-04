import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '_bmad-output/test-artifacts/screenshots/epic-E10/journey-9';

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

test.describe('Journey 9: Email Action Hidden for Non-Sendable Status', () => {
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

  test('should hide or disable Email action for DRAFT invoices', async ({
    page,
  }) => {
    // Step 1: Navigate to AR Invoices list page
    await spaNavigate(page, '/ar/invoices');

    const pageHeading = page.getByRole('heading', { name: /invoices/i }).or(
      page.getByText('Invoices', { exact: true }),
    );
    await expect(pageHeading.first()).toBeVisible({ timeout: 15000 });

    // Wait for invoice data to load
    await page.waitForTimeout(2000);

    // Screenshot checkpoint 1: Invoice list page loaded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-invoice-list-page.png`,
      fullPage: false,
    });

    // Step 2: Click the "Draft" filter tab to show only draft invoices
    const draftTab = page.getByRole('button', { name: /draft/i }).or(
      page.getByText('Draft', { exact: true }),
    );
    await expect(draftTab.first()).toBeVisible({ timeout: 5000 });
    await draftTab.first().click();
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');

    // Verify the draft invoice INV-2026-0057 is visible in the filtered list
    const draftInvoiceText = page.getByText('INV-2026-0057');
    await expect(draftInvoiceText).toBeVisible({ timeout: 10000 });

    // Click the table row containing the draft invoice
    // Note: the table rows use onClick with navigate(), so we click the row
    const draftRow = page.locator('tr').filter({ hasText: 'INV-2026-0057' });
    await draftRow.click();

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // NOTE: The invoice detail page is currently a static mock page that ALWAYS
    // shows INV-2026-0042 with POSTED/Overdue status regardless of which invoice
    // was clicked. It does not use the route param to look up different invoices.
    // Therefore we cannot properly test "Email hidden for DRAFT" status.
    // We verify the current (incorrect) behavior and document it as missing functionality.

    // Screenshot checkpoint 2: Invoice detail page (currently always shows POSTED invoice)
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-draft-invoice-detail.png`,
      fullPage: false,
    });

    // Step 3: Click the More Actions overflow menu button
    const overflowButton = page
      .locator('svg.lucide-more-horizontal, svg.lucide-ellipsis')
      .first()
      .locator('..');

    await expect(overflowButton).toBeVisible({ timeout: 10000 });
    await overflowButton.click();
    await page.waitForTimeout(500);

    // Screenshot checkpoint 3: Overflow menu state
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-overflow-menu-email-hidden.png`,
      fullPage: false,
    });

    // Step 4: Check Email to Customer status
    // Because the detail page always shows POSTED status, the email action
    // will be enabled. This is the MISSING FUNCTIONALITY — DRAFT invoices
    // should show the email action as hidden/disabled.
    const emailMenuItem = page.getByText('Email to Customer');
    const emailItemCount = await emailMenuItem.count();

    if (emailItemCount === 0) {
      // Email action is completely hidden — expected behavior for DRAFT
      const menuContent = page.locator('[role="menu"], [role="menuitem"], [data-radix-menu-content]');
      await expect(menuContent.first()).toBeVisible({ timeout: 5000 });
      await expect(emailMenuItem).not.toBeVisible();
    } else {
      // Email action exists — check if disabled (expected for DRAFT)
      const menuItem = emailMenuItem.first();
      const ariaDisabled = await menuItem.getAttribute('aria-disabled');
      const dataDisabled = await menuItem.getAttribute('data-disabled');

      if (ariaDisabled === 'true' || dataDisabled !== null) {
        // Disabled — correct behavior for DRAFT
        expect(true).toBeTruthy();
      } else {
        // Email action is ENABLED — this is wrong for a DRAFT invoice.
        // The detail page always shows POSTED status (static mock),
        // so the email action is always enabled regardless of clicked invoice.
        // This test FAILS because the feature is missing.
        expect(ariaDisabled).toBe('true');
      }
    }
  });
});
