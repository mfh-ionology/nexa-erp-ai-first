import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5d/journey-16';

/**
 * Helper: navigate within the SPA using pushState + popstate.
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

test.describe('Journey 16: Suggested Knowledge — Reject Platform Suggestion', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    // Login as admin user
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const emailInput = page.getByRole('textbox', { name: 'Email' });
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.fill('admin@nexa-erp.dev');

    const passwordInput = page.locator('input[type="password"]');
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

  test('Reject a platform-suggested knowledge article', async ({ page }) => {
    // ── Step 1: Navigate to Suggested tab ──────────────────────────────
    await spaNavigate(page, '/ai/admin/knowledge#suggested');
    await page.waitForTimeout(1000);

    // Verify Knowledge Management page loaded
    const heading = page.getByRole('heading', { name: /knowledge management/i });
    await expect(heading).toBeVisible({ timeout: 15000 });

    // Click the Suggested tab to ensure it's active
    const suggestedTab = page.getByRole('tab', { name: /suggested/i });
    if (await suggestedTab.isVisible().catch(() => false)) {
      await suggestedTab.click();
      await page.waitForTimeout(1000);
    } else {
      const suggestedText = page.getByText('Suggested', { exact: true }).first();
      if (await suggestedText.isVisible().catch(() => false)) {
        await suggestedText.click();
        await page.waitForTimeout(1000);
      }
    }

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Checkpoint 1: Suggested tab loaded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-suggested-tab-loaded.png`,
      fullPage: true,
    });

    // Check if we have suggestion cards or empty state
    const rejectButtons = page.getByRole('button', { name: /^reject$/i });
    const emptyState = page.getByText(/all caught up/i).or(
      page.getByText(/no suggestions/i),
    );
    const hasRejectButton = await rejectButtons.first().isVisible({ timeout: 5000 }).catch(() => false);
    const hasEmptyState = await emptyState.first().isVisible({ timeout: 3000 }).catch(() => false);

    if (hasEmptyState && !hasRejectButton) {
      console.log('NOTICE: No suggested articles available — empty state displayed. Cannot test Reject flow.');
      return;
    }

    // Count suggestions before rejection
    const initialCount = await rejectButtons.count();
    console.log(`Suggestion cards with Reject button before: ${initialCount}`);

    // ── Step 2: Click "Reject" on the first suggestion card ────────────
    await rejectButtons.first().click();
    await page.waitForTimeout(500);

    // Verify confirmation dialog appears (AlertDialog with "Reject Suggestion?" title)
    const dialogTitle = page.getByText(/reject suggestion/i);
    const hasDialog = await dialogTitle.isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasDialog, 'Reject confirmation dialog should appear').toBeTruthy();

    // Checkpoint 2: Reject confirmation dialog
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-reject-confirmation-dialog.png`,
      fullPage: true,
    });

    // Verify dialog has Cancel and Reject buttons
    const cancelBtn = page.getByRole('button', { name: /cancel/i });
    await expect(cancelBtn).toBeVisible({ timeout: 3000 });

    // ── Step 3: Confirm rejection ──────────────────────────────────────
    // The dialog has a Reject button inside the AlertDialog — find it specifically
    const alertDialog = page.getByRole('alertdialog');
    const confirmRejectBtn = alertDialog.getByRole('button', { name: /^reject$/i });
    const hasConfirmReject = await confirmRejectBtn.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasConfirmReject) {
      await confirmRejectBtn.click();
    } else {
      // Fallback: click any Reject button inside dialog-like container
      const dialogReject = page.locator('[role="alertdialog"] button, [data-radix-alert-dialog-content] button')
        .filter({ hasText: /^reject$/i })
        .first();
      await dialogReject.click();
    }

    await page.waitForTimeout(2000);

    // Check for success toast
    const successToast = page.getByText(/suggestion rejected/i).or(
      page.getByText(/rejected/i),
    );
    const hasToast = await successToast.first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasToast, 'Success toast should appear after rejecting suggestion').toBeTruthy();

    // Verify the card was removed (count decreased or empty state shown)
    const postRejectCount = await rejectButtons.count();
    const postEmptyState = await emptyState.first().isVisible({ timeout: 3000 }).catch(() => false);

    if (initialCount > 1) {
      expect(postRejectCount).toBeLessThan(initialCount);
      console.log(`✓ Suggestion card removed — count went from ${initialCount} to ${postRejectCount}`);
    } else if (postEmptyState) {
      console.log('✓ Last suggestion rejected — empty state now shown');
    }

    // Checkpoint 3: After rejection confirmed
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-rejection-confirmed.png`,
      fullPage: true,
    });
  });
});
