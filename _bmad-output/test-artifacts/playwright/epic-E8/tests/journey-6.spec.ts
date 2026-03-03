import { test, expect } from '@playwright/test';
import path from 'path';

const SCREENSHOTS_DIR = path.resolve(
  __dirname,
  '../../../screenshots/epic-E8/journey-6',
);

// Test credentials from seed data
// Journey #6 requires a STAFF-role user. The seed only creates a SUPER_ADMIN user.
// We log in as admin and attempt to find an Attachments button which requires
// the cross-cutting ActionBar integration (not yet wired into invoice detail page).
const TEST_EMAIL = 'admin@nexa-erp.dev';
const TEST_PASSWORD = 'NexaDev2026!';

// Use a placeholder invoice ID — the detail page is currently a static mock
const INVOICE_ID = 'test-invoice-001';

test.describe('Journey 6: STAFF User Cannot Delete Attachments', () => {
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

  test('should hide delete button for STAFF-role user while showing download', async ({
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
      path: path.join(SCREENSHOTS_DIR, 'step-1-invoice-detail-loaded-staff.png'),
      fullPage: true,
    });

    // ── Step 2: Click Attachments button in ActionBar ────────────────
    // The ActionBar should contain an Attachments button as a persistent tool.
    // NOTE: The invoice detail page is a static mock (v0 design reference).
    // The reusable ActionBar with cross-cutting persistent tools (Attachments,
    // Links) is NOT wired into this page yet.
    const attachmentsButton = page.getByRole('button', {
      name: /attachments/i,
    });

    // This will likely fail — Attachments button does not exist on the static mock page
    await expect(attachmentsButton).toBeVisible({ timeout: 5000 });

    // ** Checkpoint 2: Attachment panel about to open **
    await attachmentsButton.click();

    // Wait for the AttachmentPanel Sheet to open
    const panel = page.getByRole('dialog');
    await expect(panel).toBeVisible({ timeout: 5000 });

    // Verify panel title contains "Attachments"
    await expect(
      panel.getByRole('heading', { name: /attachments/i }),
    ).toBeVisible();

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'step-2-attachment-panel-open.png'),
      fullPage: true,
    });

    // ── Step 3: Verify Download button IS visible on attachment row ──
    // At least one attachment should exist in the list for this test entity.
    // The download button should be visible for STAFF users.
    const downloadButton = panel.getByRole('button', { name: /download/i }).first();
    await expect(downloadButton).toBeVisible({ timeout: 5000 });

    // ── Step 4: Verify Delete button is NOT visible ──────────────────
    // For STAFF role, canDelete should be false, so the Trash2 delete button
    // should NOT render (it's conditionally rendered via {canDelete && ...}).
    const deleteButton = panel.getByRole('button', { name: /delete/i });
    await expect(deleteButton).not.toBeVisible({ timeout: 3000 });

    // ** Checkpoint 3: RBAC verification — download visible, delete hidden **
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'step-4-rbac-no-delete-button.png'),
      fullPage: true,
    });
  });
});
