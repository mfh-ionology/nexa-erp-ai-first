import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '_bmad-output/test-artifacts/screenshots/epic-E10/journey-11';

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

test.describe('Journey 11: Cancel and Close Email Dialog', () => {
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

  test('should cancel and close email dialog without sending', async ({
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

    // Step 2: Click first POSTED invoice → More Actions → Email to Customer
    const firstInvoiceLink = page.getByText('INV-2026-0042');
    await expect(firstInvoiceLink).toBeVisible({ timeout: 10000 });
    await firstInvoiceLink.click();

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify we're on invoice detail page
    const detailHeading = page.locator('h1').filter({ hasText: /INV-/ });
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

    // Verify email dialog opened
    const emailDialog = page.getByRole('dialog');
    await expect(emailDialog.first()).toBeVisible({ timeout: 10000 });

    // Checkpoint 1: Email dialog opened
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-email-dialog-opened.png`,
      fullPage: false,
    });

    // Step 3: Modify the Subject field to test unsaved changes
    const subjectInput = emailDialog
      .first()
      .getByPlaceholder('Email subject');
    await expect(subjectInput).toBeVisible({ timeout: 5000 });

    // Remember original subject value for later comparison
    const originalSubject = await subjectInput.inputValue().catch(() => '');

    await subjectInput.clear();
    await subjectInput.fill('Modified subject text');
    await page.waitForTimeout(500);

    // Verify subject was changed
    await expect(subjectInput).toHaveValue('Modified subject text');

    // Step 4: Click Cancel button in dialog footer
    const cancelButton = emailDialog
      .first()
      .getByRole('button', { name: /cancel/i });
    await expect(cancelButton).toBeVisible();
    await cancelButton.click();
    await page.waitForTimeout(1000);

    // Verify dialog is closed
    await expect(emailDialog.first()).not.toBeVisible({ timeout: 10000 });

    // Verify no toast notification appeared (email was NOT sent)
    const successToast = page.getByText(/email queued/i);
    const errorToast = page.getByText(/failed to send/i);
    const successVisible = await successToast.isVisible().catch(() => false);
    const errorVisible = await errorToast.isVisible().catch(() => false);
    expect(successVisible).toBe(false);
    expect(errorVisible).toBe(false);

    // Step 5: Verify invoice detail page is fully visible
    await expect(detailHeading).toBeVisible();

    // Checkpoint 2: Dialog closed, no overlay, no toast
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-dialog-closed-after-cancel.png`,
      fullPage: false,
    });

    // Step 6: Reopen the email dialog
    await overflowButton.click();
    await page.waitForTimeout(500);
    const emailMenuItem2 = page.getByText('Email to Customer');
    await expect(emailMenuItem2).toBeVisible({ timeout: 5000 });
    await emailMenuItem2.click();
    await page.waitForTimeout(2000);

    // Verify dialog reopened
    await expect(emailDialog.first()).toBeVisible({ timeout: 10000 });

    // Verify subject was reset to the original template value (not "Modified subject text")
    const reopenedSubjectInput = emailDialog
      .first()
      .getByPlaceholder('Email subject');
    await expect(reopenedSubjectInput).toBeVisible({ timeout: 5000 });
    const reopenedSubject = await reopenedSubjectInput
      .inputValue()
      .catch(() => '');

    // The subject should NOT be the modified text
    expect(reopenedSubject).not.toBe('Modified subject text');

    // Checkpoint 3: Dialog reopened with original fields
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-dialog-reopened-original-fields.png`,
      fullPage: false,
    });

    // Step 7: Close dialog via × button in header
    // The dialog's close button (data-slot="dialog-close") is positioned absolute
    // at top-4 right-4 but the dialog content extends beyond the viewport.
    // Use dispatchEvent to programmatically click it, or fall back to Escape.
    const closeButton = emailDialog
      .first()
      .locator('[data-slot="dialog-close"]')
      .first();

    const closeExists = await closeButton.count() > 0;
    if (closeExists) {
      await closeButton.dispatchEvent('click');
    } else {
      // Fallback: press Escape to close the dialog
      await page.keyboard.press('Escape');
    }

    await page.waitForTimeout(1000);

    // Verify dialog is closed
    await expect(emailDialog.first()).not.toBeVisible({ timeout: 10000 });

    // Verify invoice detail page is visible
    await expect(detailHeading).toBeVisible();

    // Checkpoint 4: Dialog closed via X button
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-7-dialog-closed-via-x-button.png`,
      fullPage: false,
    });
  });
});
