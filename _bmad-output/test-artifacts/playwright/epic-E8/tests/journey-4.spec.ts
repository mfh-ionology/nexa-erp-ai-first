import { test, expect } from '@playwright/test';
import path from 'path';

const SCREENSHOTS_DIR = path.resolve(
  __dirname,
  '../../../screenshots/epic-E8/journey-4',
);

// Test credentials from seed data
const TEST_EMAIL = 'admin@nexa-erp.dev';
const TEST_PASSWORD = 'NexaDev2026!';

// Use a placeholder invoice ID — the detail page is currently a static mock
const INVOICE_ID = 'test-invoice-001';

test.describe('Journey 4: Reject Oversized File Upload', () => {
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

  test('should reject a file exceeding 50MB limit with validation error before presign request', async ({
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

    // Verify the invoice detail page has loaded — look for the invoice heading
    await expect(page.getByText('INV-2026-0042')).toBeVisible({ timeout: 15000 });

    // ** Checkpoint 1: Invoice detail page loaded **
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'step-1-invoice-detail-loaded.png'),
      fullPage: true,
    });

    // ── Step 2: Click Attachments button in ActionBar ─────────────────
    // The ActionBar should render as a toolbar with role="toolbar"
    // containing an Attachments button with a paperclip icon.
    // NOTE: The invoice detail page is a static mock (v0 design reference).
    // The reusable ActionBar with cross-cutting persistent tools (Attachments,
    // Links) is NOT wired into this page yet.
    const attachmentsButton = page.getByRole('button', {
      name: /attachments/i,
    });

    // This will fail if Attachments button is not present
    await expect(attachmentsButton).toBeVisible({ timeout: 5000 });

    // ── Step 3: Click Attachments to open panel ──────────────────────
    await attachmentsButton.click();

    // Verify AttachmentPanel Sheet opens
    const panel = page.getByRole('dialog');
    await expect(panel).toBeVisible({ timeout: 5000 });

    // Verify panel title
    await expect(
      panel.getByRole('heading', { name: /attachments/i }),
    ).toBeVisible();

    // ** Checkpoint 2: Attachment panel open **
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'step-2-attachment-panel-open.png'),
      fullPage: true,
    });

    // ── Step 3: Attempt to upload oversized file (60MB) via file input ──
    // The FileUploadZone has a hidden file input. We'll set it to a large file.
    // Client-side validation in FileUploadZone should block this BEFORE
    // any presign API call is made (50MB = 52428800 bytes limit).
    const fileInput = panel.locator('input[type="file"]');

    // Set up a route interceptor to verify NO presign request is made
    let presignRequestMade = false;
    await page.route('**/attachments/presign*', (route) => {
      presignRequestMade = true;
      route.continue();
    });
    await page.route('**/api/attachments*', (route) => {
      if (route.request().method() === 'POST') {
        presignRequestMade = true;
      }
      route.continue();
    });

    // Create a buffer that simulates a 60MB file.
    // Playwright's setInputFiles with buffer doesn't actually create a 60MB
    // file in memory for size validation — the File object's size property
    // is derived from the buffer length. We need a buffer large enough to
    // exceed 50MB. However, creating a real 60MB buffer in the test would be
    // very slow. Instead, we'll use a small buffer but override the file size
    // via the page context if possible.
    //
    // Strategy: Use page.evaluate to programmatically create a File object
    // with the correct size and dispatch it to the file input, since
    // setInputFiles buffer approach may not work for large file simulation.
    const oversizedFileCreated = await page.evaluate(() => {
      const fileInput = document.querySelector('input[type="file"]');
      if (!fileInput) return false;

      // Create a DataTransfer with a mock file
      // Use a Blob with enough size to exceed 50MB
      // We'll create a sparse approach: small content but set via File constructor
      const sizeInBytes = 62914560; // 60 MB
      // Create a File with the right size by using an ArrayBuffer
      const buffer = new ArrayBuffer(sizeInBytes);
      const file = new File([buffer], 'oversized-60mb.bin', {
        type: 'application/octet-stream',
      });

      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      (fileInput as HTMLInputElement).files = dataTransfer.files;

      // Dispatch change event to trigger validation
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    });

    expect(oversizedFileCreated).toBe(true);

    // Wait a moment for validation to run
    await page.waitForTimeout(1000);

    // ── Step 4: Verify file size validation error is displayed ────────
    // FileUploadZone should show a red error message about file too large.
    // The translation key is crossCutting.attachments.fileTooLarge.
    // Since the crossCutting i18n namespace is missing, the raw key is shown.

    // Try multiple possible error text patterns
    const errorLocator = panel.locator('p.text-destructive').first();
    const rawKeyLocator = panel.getByText('crossCutting.attachments.fileTooLarge');
    const friendlyErrorLocator = panel.locator(
      'text=/too large|exceeds.*maximum|file size|50.*MB/i',
    );

    // Check for any of the error indicators
    const hasDestructiveText = await errorLocator.isVisible().catch(() => false);
    const hasRawKey = await rawKeyLocator.isVisible().catch(() => false);
    const hasFriendlyError = await friendlyErrorLocator.first().isVisible().catch(() => false);

    // At least one error indicator should be visible
    const errorFound = hasDestructiveText || hasRawKey || hasFriendlyError;
    expect(errorFound).toBe(true);

    // ** Checkpoint 3: File size validation error displayed **
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'step-3-file-rejected-oversized.png'),
      fullPage: true,
    });

    // Verify NO upload progress bar appeared (file was rejected client-side)
    const progressIndicator = panel.locator(
      'text=/preparing|uploading|confirming/i',
    );
    await expect(progressIndicator).not.toBeVisible();

    // Verify no presign API call was made
    expect(presignRequestMade).toBe(false);

    // Verify the file does NOT appear in the attachment list
    await expect(panel.getByText('oversized-60mb.bin')).not.toBeVisible();

    // Verify the upload zone is still interactive (not disabled)
    const dropZone = panel.getByRole('button', {
      name: /drop.*zone|upload|drag/i,
    });
    if (await dropZone.isVisible().catch(() => false)) {
      await expect(dropZone).toBeEnabled();
    }

    // ** Checkpoint 4: Error message detail and zone state **
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'step-4-error-message-detail.png'),
      fullPage: true,
    });
  });
});
