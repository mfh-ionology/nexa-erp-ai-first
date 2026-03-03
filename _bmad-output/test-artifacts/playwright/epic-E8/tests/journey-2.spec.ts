import { test, expect } from '@playwright/test';
import path from 'path';

const SCREENSHOTS_DIR = path.resolve(
  __dirname,
  '../../../screenshots/epic-E8/journey-2',
);

// Test credentials from seed data
const TEST_EMAIL = 'admin@nexa-erp.dev';
const TEST_PASSWORD = 'NexaDev2026!';

// Use a placeholder invoice ID — the detail page is currently a static mock
const INVOICE_ID = 'test-invoice-001';

test.describe('Journey 2: Download an Attachment', () => {
  test.beforeEach(async ({ page }) => {
    // Login: navigate to login page, fill form, and submit
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await page.getByRole('textbox', { name: 'Email' }).fill(TEST_EMAIL);
    await page.getByRole('textbox', { name: 'Password' }).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for login API response and navigation to dashboard
    await page.waitForResponse(
      (r) => r.url().includes('/auth/login') && r.status() === 200,
      { timeout: 10000 },
    );
    // Wait for the dashboard to render (in-memory auth state is set)
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');
  });

  test('should download an attachment via presigned URL from the AttachmentPanel', async ({
    page,
  }) => {
    // ── Step 1: Navigate to invoice detail page ──────────────────────
    // Auth state is in-memory (Zustand), so page.goto() would lose it.
    // Use client-side navigation via history API + popstate event.
    await page.evaluate((invoiceId) => {
      window.history.pushState({}, '', `/ar/invoices/${invoiceId}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, INVOICE_ID);
    await page.waitForTimeout(1500);

    // Verify the invoice detail page has loaded
    await expect(page.getByText('INV-2026-0042')).toBeVisible({ timeout: 15000 });

    // ** Checkpoint 1: Invoice detail page loaded **
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'step-1-invoice-detail-page.png'),
      fullPage: true,
    });

    // ── Step 2: Click Attachments button in ActionBar ─────────────────
    const attachmentsButton = page.getByRole('button', {
      name: /attachments/i,
    });
    await expect(attachmentsButton).toBeVisible({ timeout: 5000 });
    await attachmentsButton.click();

    // ── Step 3: Verify AttachmentPanel opens with previously uploaded file ──
    const panel = page.getByRole('dialog');
    await expect(panel).toBeVisible({ timeout: 5000 });

    // Verify panel title
    await expect(
      panel.getByRole('heading', { name: /attachments/i }),
    ).toBeVisible();

    // Verify previously uploaded file is present (from Journey 1 or seed data)
    await expect(panel.getByText('test-document.pdf')).toBeVisible({
      timeout: 10000,
    });

    // ── Step 4: Verify download button visible on first attachment row ──
    // The download button uses aria-label with a Download icon.
    // Buttons are hidden until hover/focus — force hover on the attachment row.
    const attachmentRow = panel.locator('.group').filter({
      hasText: 'test-document.pdf',
    });
    await attachmentRow.hover();

    const downloadButton = attachmentRow.getByRole('button', {
      name: /download/i,
    });
    await expect(downloadButton).toBeVisible({ timeout: 5000 });

    // ** Checkpoint 2: Attachment panel open with file listed **
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'step-2-attachment-panel-open.png'),
      fullPage: true,
    });

    // ── Step 5: Click Download button and verify network response ────
    // Listen for the download API call before clicking
    const downloadResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/attachments/') &&
        response.url().includes('/download') &&
        response.request().method() === 'GET',
      { timeout: 15000 },
    );

    // Intercept new tabs/popups that may open for the download URL
    const downloadPagePromise = page.context().waitForEvent('page', {
      timeout: 10000,
    }).catch(() => null); // May not open a new tab

    await downloadButton.click();

    // Verify the API call to /attachments/{id}/download returned 200
    const downloadResponse = await downloadResponsePromise;
    expect(downloadResponse.status()).toBe(200);

    // Verify the response body contains expected fields
    const responseBody = await downloadResponse.json();
    expect(responseBody).toHaveProperty('downloadUrl');
    expect(responseBody).toHaveProperty('fileName');
    expect(responseBody).toHaveProperty('mimeType');
    expect(responseBody.fileName).toBe('test-document.pdf');

    // Close any new tab that was opened for the download
    const downloadPage = await downloadPagePromise;
    if (downloadPage) {
      await downloadPage.close();
    }

    // ** Checkpoint 3: Download initiated successfully **
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'step-3-download-initiated.png'),
      fullPage: true,
    });

    // Verify no error toasts appeared
    const errorToast = page.locator('[data-state="open"]').filter({
      hasText: /error|failed/i,
    });
    await expect(errorToast).not.toBeVisible();
  });
});
