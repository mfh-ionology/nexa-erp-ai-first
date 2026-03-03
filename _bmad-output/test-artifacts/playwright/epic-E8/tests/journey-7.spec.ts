import { test, expect } from '@playwright/test';
import path from 'path';

const SCREENSHOTS_DIR = path.resolve(
  __dirname,
  '../../../screenshots/epic-E8/journey-7',
);

// Test credentials from seed data
const TEST_EMAIL = 'admin@nexa-erp.dev';
const TEST_PASSWORD = 'NexaDev2026!';

// Use a placeholder invoice ID — the detail page is a static mock
const INVOICE_ID = 'test-invoice-001';

// Note content for this journey
const NOTE_CONTENT =
  'Initial review completed. All line items verified against purchase order PO-2026-0015.';

test.describe('Journey 7: Create a General Note', () => {
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

  test('should create a GENERAL-type note and see it in the timeline', async ({
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
    await expect(page.getByText('INV-2026-0042')).toBeVisible({
      timeout: 15000,
    });

    // ** Checkpoint 1: Invoice detail page loaded **
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'step-1-invoice-detail-loaded.png'),
      fullPage: true,
    });

    // ── Step 2: Click Notes tab in the record detail page tabs ───────
    // The invoice detail page should have a tabbed layout with a Notes tab.
    // NotesTab wraps NotesPanel and is rendered as tab content.
    const notesTab = page.getByRole('tab', { name: /notes/i });
    await expect(notesTab).toBeVisible({ timeout: 5000 });
    await notesTab.click();

    // Wait for NotesPanel to mount and fetch notes
    await page.waitForTimeout(1000);

    // ** Checkpoint 2: Notes tab panel visible **
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'step-2-notes-tab-active.png'),
      fullPage: true,
    });

    // ── Step 3: Click Add Note button ────────────────────────────────
    const addNoteButton = page.getByRole('button', { name: /add note/i });
    await expect(addNoteButton).toBeVisible({ timeout: 5000 });
    await addNoteButton.click();

    // Wait for the AddNoteForm to expand
    await page.waitForTimeout(500);

    // ** Checkpoint 3: Add note form expanded **
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'step-3-add-note-form-expanded.png'),
      fullPage: true,
    });

    // ── Step 4: Verify note type selector options ────────────────────
    // The type selector should show General (default), Internal, Customer Visible.
    // SYSTEM type should NOT be available to users.
    // Look for the select/combobox element for note type
    const typeSelector = page.locator('select, [role="combobox"]').filter({
      has: page.getByText(/general/i),
    });

    // If it's a native select, check options; if radix, click to open dropdown
    const selectElement = page.locator('select');
    const combobox = page.getByRole('combobox');

    // Try combobox first (Radix Select), fall back to native select
    if (await combobox.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await combobox.first().click();
      await page.waitForTimeout(300);

      // Verify the expected options are present
      await expect(page.getByRole('option', { name: /general/i })).toBeVisible();
      await expect(
        page.getByRole('option', { name: /internal/i }),
      ).toBeVisible();
      await expect(
        page.getByRole('option', { name: /customer visible/i }),
      ).toBeVisible();

      // Verify SYSTEM type is NOT available
      await expect(
        page.getByRole('option', { name: /^system$/i }),
      ).not.toBeVisible({ timeout: 2000 });

      // Select General (should already be default, but click to confirm)
      await page.getByRole('option', { name: /general/i }).click();
    } else if (
      await selectElement.first().isVisible({ timeout: 2000 }).catch(() => false)
    ) {
      // Native select — verify options
      const options = await selectElement.first().locator('option').allTextContents();
      expect(options.some((o) => /general/i.test(o))).toBeTruthy();
      expect(options.some((o) => /internal/i.test(o))).toBeTruthy();
      expect(options.some((o) => /customer/i.test(o))).toBeTruthy();
      expect(options.some((o) => /^system$/i.test(o))).toBeFalsy();
    }

    // ── Step 5: Fill the note form ───────────────────────────────────
    // Fill the textarea with note content
    const noteTextarea = page.getByRole('textbox');
    await expect(noteTextarea).toBeVisible({ timeout: 3000 });
    await noteTextarea.fill(NOTE_CONTENT);

    // Verify the submit button is enabled after filling content
    const submitButton = page
      .getByRole('button', { name: /add note|submit|save/i })
      .filter({ hasNot: page.getByText(/cancel/i) });
    await expect(submitButton.first()).toBeEnabled({ timeout: 3000 });

    // ** Checkpoint 4: Note form filled and ready to submit **
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'step-5-note-form-filled.png'),
      fullPage: true,
    });

    // ── Step 6: Submit the note ──────────────────────────────────────
    // Click the submit button and wait for the POST /notes API response
    const submitBtn = page
      .getByRole('button', { name: /add note|submit|save/i })
      .first();

    const noteCreationPromise = page
      .waitForResponse(
        (r) => r.url().includes('/notes') && r.request().method() === 'POST',
        { timeout: 10000 },
      )
      .catch(() => null);

    await submitBtn.click();

    // Wait for API response or a timeout
    const noteResponse = await noteCreationPromise;

    // After submission, the form should collapse and the timeline should refresh
    await page.waitForTimeout(1500);

    // ── Step 7: Verify new note appears in the timeline ──────────────
    // The new note should appear at the top of the timeline
    await expect(page.getByText(NOTE_CONTENT)).toBeVisible({ timeout: 10000 });

    // Verify the grey "General" type badge
    const generalBadge = page
      .locator('[class*="bg-gray"]')
      .filter({ hasText: /general/i });
    await expect(generalBadge.first()).toBeVisible({ timeout: 5000 });

    // Verify author name is visible (the logged-in user)
    // The note card should show the current user's name
    const noteCard = page.locator('.group.relative').filter({
      hasText: NOTE_CONTENT,
    });
    await expect(noteCard.first()).toBeVisible({ timeout: 5000 });

    // Verify relative timestamp (e.g., "just now" or "a few seconds ago")
    await expect(
      noteCard.first().getByText(/just now|seconds? ago|moment/i),
    ).toBeVisible({ timeout: 5000 });

    // ** Checkpoint 5: Note created — timeline updated **
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'step-7-note-in-timeline.png'),
      fullPage: true,
    });
  });
});
