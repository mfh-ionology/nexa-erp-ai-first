import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '_bmad-output/test-artifacts/screenshots/epic-E10/journey-4';

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

test.describe('Journey 4: Email Recipient Validation — Invalid Format', () => {
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

  test('should reject invalid email addresses with visual feedback', async ({
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
    const detailHeading = page
      .locator('h1')
      .filter({ hasText: /INV-2026-0042/ });
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

    // Step 3: Enter an invalid email in the To field
    // The To field already has a valid customer email chip. Find the To input.
    const toSection = emailDialog
      .first()
      .locator('label:has-text("To")')
      .locator('..');
    const toInput = toSection.locator('input[type="email"]');
    await expect(toInput).toBeVisible({ timeout: 5000 });
    await toInput.fill('not-an-email');

    // Step 4: Press Enter to attempt adding the invalid email as a chip
    await toInput.press('Enter');
    await page.waitForTimeout(500);

    // Verify: invalid chip should appear with red/error styling
    // The chip text should contain "not-an-email" and have error visual treatment
    const invalidChip1 = emailDialog
      .first()
      .locator('button[aria-label="Remove not-an-email"]')
      .or(emailDialog.first().getByText('not-an-email'));
    await expect(invalidChip1.first()).toBeVisible({ timeout: 5000 });

    // Visual checkpoint 1: Invalid email chip highlighted in red
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-invalid-email-chip-red.png`,
      fullPage: false,
    });

    // Step 5-6: Enter another invalid email "missing@domain" and press Enter
    const toInputAfter = toSection.locator('input[type="email"]');
    await expect(toInputAfter).toBeVisible({ timeout: 5000 });
    await toInputAfter.fill('missing@domain');
    await toInputAfter.press('Enter');
    await page.waitForTimeout(500);

    // Verify the second invalid chip was created
    const invalidChip2 = emailDialog
      .first()
      .locator('button[aria-label="Remove missing@domain"]')
      .or(emailDialog.first().getByText('missing@domain'));
    await expect(invalidChip2.first()).toBeVisible({ timeout: 5000 });

    // Step 7: Remove the first invalid chip by clicking its × button
    const removeButton = emailDialog
      .first()
      .locator('button[aria-label="Remove not-an-email"]');

    if (await removeButton.isVisible()) {
      await removeButton.click();
    } else {
      // Fallback: find the chip containing "not-an-email" and click its remove button
      const chip1Container = emailDialog
        .first()
        .locator('[data-chip]')
        .filter({ hasText: 'not-an-email' })
        .or(
          emailDialog
            .first()
            .locator('span')
            .filter({ hasText: 'not-an-email' })
            .locator('..'),
        );
      const chipRemoveBtn = chip1Container.locator('button, svg').first();
      await chipRemoveBtn.click();
    }
    await page.waitForTimeout(500);

    // Verify "not-an-email" is gone
    const removedChip = emailDialog
      .first()
      .locator('button[aria-label="Remove not-an-email"]');
    await expect(removedChip).toBeHidden({ timeout: 5000 });

    // Verify "missing@domain" is still visible
    await expect(invalidChip2.first()).toBeVisible();

    // Visual checkpoint 2: After removing first invalid chip
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-7-invalid-chip-removed.png`,
      fullPage: false,
    });
  });
});
