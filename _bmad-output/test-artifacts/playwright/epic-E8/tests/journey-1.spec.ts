import { test, expect } from '@playwright/test';
import path from 'path';

const SCREENSHOTS_DIR = path.resolve(
  __dirname,
  '../../../screenshots/epic-E8/journey-1',
);

// Test credentials from seed data
const TEST_EMAIL = 'admin@nexa-erp.dev';
const TEST_PASSWORD = 'NexaDev2026!';

// Use a placeholder invoice ID — the detail page is currently a static mock
const INVOICE_ID = 'test-invoice-001';

test.describe('Journey 1: Upload Attachment via Drag-and-Drop', () => {
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

  test('should upload a PDF attachment via the AttachmentPanel and verify badge count', async ({
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
      path: path.join(SCREENSHOTS_DIR, 'step-1-invoice-detail-page.png'),
      fullPage: true,
    });

    // ── Step 2: Verify ActionBar with Attachments button ─────────────
    // The ActionBar should render as a toolbar with role="toolbar"
    // containing an Attachments button with a paperclip icon.
    // NOTE: The invoice detail page is a static mock (v0 design reference).
    // The reusable ActionBar with cross-cutting persistent tools (Attachments,
    // Links) is NOT wired into this page yet. The page uses custom header
    // buttons (Send Reminder, Print, overflow menu).
    const attachmentsButton = page.getByRole('button', {
      name: /attachments/i,
    });

    // This will fail — Attachments button does not exist on the page
    await expect(attachmentsButton).toBeVisible({ timeout: 5000 });

    // Verify no count badge initially (0 attachments)
    await expect(attachmentsButton).not.toContainText(/\(\d+\)/);

    // ── Step 3: Click Attachments button to open panel ───────────────
    await attachmentsButton.click();

    // ── Step 4: Verify AttachmentPanel Sheet opens ───────────────────
    const panel = page.getByRole('dialog');
    await expect(panel).toBeVisible({ timeout: 5000 });

    // Verify panel title
    await expect(
      panel.getByRole('heading', { name: /attachments/i }),
    ).toBeVisible();

    // Verify drop zone is visible
    const dropZone = panel.getByRole('button', {
      name: /click or drag files here|drop zone/i,
    });
    await expect(dropZone).toBeVisible();

    // Verify empty state message
    await expect(panel.getByText(/no attachments/i)).toBeVisible();

    // ** Checkpoint 2: Attachment panel open with empty state **
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'step-4-attachment-panel-empty.png'),
      fullPage: true,
    });

    // ── Step 5: Upload a file via file input ─────────────────────────
    const fileInput = panel.locator('input[type="file"]');

    // Create a test PDF buffer (minimal valid PDF)
    const testPdfContent = Buffer.from(
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF',
    );

    await fileInput.setInputFiles({
      name: 'test-document.pdf',
      mimeType: 'application/pdf',
      buffer: testPdfContent,
    });

    // ── Step 6: Verify upload progress ───────────────────────────────
    const progressIndicator = panel.locator(
      'text=/preparing|uploading|confirming|upload complete/i',
    );
    await expect(progressIndicator.first()).toBeVisible({ timeout: 10000 });

    // ** Checkpoint 3: Upload progress visible **
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'step-6-upload-progress.png'),
      fullPage: true,
    });

    // Wait for upload to complete
    await expect(
      panel.getByText(/upload complete/i),
    ).toBeVisible({ timeout: 30000 });

    // ── Step 7: Verify file appears in attachment list ────────────────
    await expect(panel.getByText('test-document.pdf')).toBeVisible({
      timeout: 10000,
    });

    // Verify file size is displayed
    await expect(
      panel.locator('text=/\\d+(\\.\\d+)?\\s*(B|KB|MB)/i').first(),
    ).toBeVisible();

    // Verify download button exists
    await expect(
      panel.getByRole('button', { name: /download/i }).first(),
    ).toBeVisible();

    // ── Step 8: Verify count badge in panel header ───────────────────
    await expect(panel.getByText('1')).toBeVisible();

    // ** Checkpoint 4: Upload complete, file in list **
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'step-8-attachment-list-with-file.png'),
      fullPage: true,
    });

    // ── Step 9: Close the panel ──────────────────────────────────────
    const closeButton = panel.getByRole('button', { name: /close/i });
    await closeButton.click();

    // Verify the panel is closed
    await expect(panel).not.toBeVisible({ timeout: 5000 });

    // ── Step 10: Verify ActionBar badge shows count ──────────────────
    await expect(attachmentsButton).toContainText(/1/);

    // ** Checkpoint 5: ActionBar badge updated **
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'step-10-actionbar-badge-updated.png'),
      fullPage: true,
    });
  });
});
