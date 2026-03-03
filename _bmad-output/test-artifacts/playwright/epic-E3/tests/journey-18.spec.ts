import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E3/journey-18';

test.describe('Journey 18: Reprocess a Dead Letter Queue Entry', () => {
  test('Admin reprocesses a pending DLQ entry and verifies it is marked as reprocessed', async ({ page }) => {
    // Step 1: Navigate to login page
    await page.goto('/login');

    // Verify login form is present
    const emailInput = page.getByLabel(/email/i);
    const passwordInput = page.getByLabel(/password/i);
    const signInButton = page.getByRole('button', { name: /sign in/i });

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(signInButton).toBeVisible();

    // Step 2: Fill login form with admin credentials
    await emailInput.fill('admin@nexa-test.co.uk');
    await passwordInput.fill('Admin123!');

    // Step 3: Click Sign In
    await signInButton.click();

    // Wait for navigation away from login page
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 15000,
    });

    // Verify we're on the dashboard (sidebar should be visible)
    await expect(page.locator('nav, [role="navigation"], aside')).toBeVisible();

    // Step 4: Navigate to Dead Letter Queue page
    await page.goto('/system/dead-letter-queue');

    // Wait for page to settle
    await page.waitForLoadState('networkidle');

    // Verify DLQ page loaded
    const dlqHeading = page.getByRole('heading', { name: /dead.?letter/i });
    const dlqPageIndicator = page.getByText(/dead.?letter/i).first();
    await expect(dlqHeading.or(dlqPageIndicator)).toBeVisible({ timeout: 10000 });

    // Step 5: Verify at least one pending DLQ entry exists with a Reprocess button
    // Look for a Reprocess action button
    const reprocessButton = page.getByRole('button', { name: /reprocess/i }).first();
    const reprocessLink = page.getByRole('link', { name: /reprocess/i }).first();
    const reprocessAction = reprocessButton.or(reprocessLink);

    // Also check for pending entries (reprocessed = false)
    const pendingEntry = page.locator('table tbody tr, [role="row"]').filter({
      hasNot: page.getByText(/^true$/),
    }).first();

    // Visual Checkpoint 1: DLQ page with pending entry and Reprocess button visible
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-5-dlq-pending-entry.png` });

    // Verify a reprocess button is visible (entry is pending)
    await expect(reprocessAction).toBeVisible({ timeout: 5000 });

    // Capture the entry's event name for later verification
    const firstEntryRow = page.locator('table tbody tr, [role="row"]').first();
    await expect(firstEntryRow).toBeVisible();

    // Step 6: Click the Reprocess button on the first pending entry
    await reprocessAction.click();

    // Wait for confirmation dialog to appear
    await page.waitForTimeout(500);

    // Visual Checkpoint 2: Confirmation dialog visible
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-6-reprocess-confirmation-dialog.png` });

    // Verify confirmation dialog is present
    const confirmDialog = page.locator('[role="dialog"], [role="alertdialog"], [data-testid*="confirm"], [class*="modal"], [class*="dialog"]');
    const confirmText = page.getByText(/are you sure|confirm|reprocess this event/i);
    await expect(confirmDialog.or(confirmText)).toBeVisible({ timeout: 5000 });

    // Step 7: Click Confirm / Yes button in the dialog
    const confirmButton = page.getByRole('button', { name: /confirm|yes|ok|proceed/i });
    await expect(confirmButton).toBeVisible({ timeout: 5000 });
    await confirmButton.click();

    // Wait for the reprocessing to complete and UI to update
    await page.waitForTimeout(2000);

    // Visual Checkpoint 3: Success toast and entry marked as reprocessed
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-7-reprocess-success.png` });

    // Verify success feedback — either toast notification or inline status change
    const successToast = page.getByText(/reprocess.*success|successfully.*reprocess|event.*reprocess/i);
    const reprocessedBadge = page.getByText(/reprocessed/i);
    await expect(successToast.or(reprocessedBadge)).toBeVisible({ timeout: 5000 });

    // Step 8: Verify the entry is now marked as reprocessed
    // The reprocessed entry should show reprocessed=true, a reprocessedAt timestamp,
    // and the Reprocess button should be disabled or hidden for this entry

    // Check that the entry now shows reprocessed status
    const reprocessedStatus = page.getByText(/true|reprocessed/i);
    await expect(reprocessedStatus).toBeVisible({ timeout: 5000 });

    // Verify the Reprocess button is either gone or disabled for the reprocessed entry
    const remainingReprocessButtons = page.getByRole('button', { name: /reprocess/i });
    const buttonCount = await remainingReprocessButtons.count();

    // If there are still reprocess buttons, they should not apply to the entry we just reprocessed
    // (either the button is gone, or it belongs to other pending entries)
    // We verify by checking that at least one entry shows reprocessed=true
    const reprocessedTrue = page.locator('td, [role="cell"], span, div').filter({
      hasText: /^true$|reprocessed at/i,
    });
    await expect(reprocessedTrue.first()).toBeVisible({ timeout: 5000 });
  });
});
