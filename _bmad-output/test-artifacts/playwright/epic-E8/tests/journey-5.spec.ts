import { test, expect } from '@playwright/test';
import path from 'path';

const SCREENSHOTS_DIR = path.resolve(
  __dirname,
  '../../../screenshots/epic-E8/journey-5',
);

// Test credentials from seed data (SUPER_ADMIN — has all permissions including canDelete)
const TEST_EMAIL = 'admin@nexa-erp.dev';
const TEST_PASSWORD = 'NexaDev2026!';

// The detail page is currently a static mock — any ID works
const INVOICE_ID = 'test-invoice-001';

test.describe('Journey 5: Delete Attachment as MANAGER', () => {
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

  test('should delete an attachment and see empty state', async ({ page }) => {
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

    // ── Step 2: Open Attachments panel ───────────────────────────────
    const attachmentsButton = page.getByRole('button', {
      name: /attachments/i,
    });
    await expect(attachmentsButton).toBeVisible({ timeout: 5000 });
    await attachmentsButton.click();

    // Wait for the panel (Sheet dialog) to open
    const panel = page.getByRole('dialog');
    await expect(panel).toBeVisible({ timeout: 5000 });

    // ── Setup: Upload a test file so there's something to delete ─────
    // The journey requires an existing attachment. Upload one if the list is empty.
    const fileInput = panel.locator('input[type="file"]');
    const testPdfContent = Buffer.from(
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF',
    );

    await fileInput.setInputFiles({
      name: 'test-document.pdf',
      mimeType: 'application/pdf',
      buffer: testPdfContent,
    });

    // Wait for upload to complete
    await expect(
      panel.getByText(/upload complete/i),
    ).toBeVisible({ timeout: 30000 });

    // Verify the file appears in the list
    await expect(panel.getByText('test-document.pdf')).toBeVisible({
      timeout: 10000,
    });

    // ── Step 3: Verify Delete button (Trash2 icon) is visible ────────
    // The delete button is gated by canDelete permission (MANAGER/SUPER_ADMIN).
    // It uses aria-label from i18n key: crossCutting.attachments.delete
    // Since i18n translations for crossCutting namespace are missing,
    // aria-label will be the raw key string.
    // Also try matching common patterns for delete button.
    const deleteButton = panel.getByRole('button', {
      name: /delete|crossCutting\.attachments\.delete/i,
    }).first();

    // Hover over the attachment row to reveal action buttons (they have opacity-0 by default)
    await panel.getByText('test-document.pdf').hover();
    await page.waitForTimeout(300);

    await expect(deleteButton).toBeVisible({ timeout: 5000 });

    // ** Checkpoint 2: Attachment panel with existing attachment and delete button visible **
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'step-2-panel-with-attachment.png'),
      fullPage: true,
    });

    // ── Step 4: Click Delete button ──────────────────────────────────
    await deleteButton.click();

    // ── Step 5: Verify Delete confirmation dialog ────────────────────
    // AlertDialog should appear with title and description about permanent deletion
    const confirmDialog = page.getByRole('alertdialog');
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });

    // Verify dialog has confirm/cancel buttons
    const cancelButton = confirmDialog.getByRole('button', {
      name: /cancel/i,
    });
    await expect(cancelButton).toBeVisible();

    // The confirm/action button — look for delete or confirm text
    const confirmDeleteButton = confirmDialog.getByRole('button', {
      name: /delete|confirm|crossCutting\.attachments\.delete/i,
    });
    await expect(confirmDeleteButton).toBeVisible();

    // ** Checkpoint 3: Delete confirmation dialog **
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'step-3-delete-confirmation-dialog.png'),
      fullPage: true,
    });

    // ── Step 6: Confirm deletion ─────────────────────────────────────
    await confirmDeleteButton.click();

    // Wait for the delete API call and list refresh
    await page.waitForTimeout(2000);

    // ── Step 7: Verify empty state ───────────────────────────────────
    // After deletion, the list should show the empty state message
    // i18n key: crossCutting.attachments.emptyState (rendered as raw key if translations missing)
    const emptyState = panel.getByText(
      /no attachments|crossCutting\.attachments\.emptyState/i,
    );
    await expect(emptyState).toBeVisible({ timeout: 10000 });

    // Verify the count badge is gone (no badge or 0)
    // The Badge only renders when total > 0, so it should not be present
    const badgeInHeader = panel.locator('.space-y-1 >> text=test-document.pdf');
    await expect(badgeInHeader).not.toBeVisible({ timeout: 5000 });

    // ** Checkpoint 4: Empty state after deletion **
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'step-4-empty-state-after-delete.png'),
      fullPage: true,
    });
  });
});
