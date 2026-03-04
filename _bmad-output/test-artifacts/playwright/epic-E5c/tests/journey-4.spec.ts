import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR = '../../screenshots/epic-E5c/journey-4';

/**
 * Helper: navigate within the SPA using TanStack Router.
 * Auth tokens are in-memory only (Zustand), so page.goto() would
 * cause a full reload and lose the authenticated session.
 */
async function spaNavigate(page: import('@playwright/test').Page, path: string) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await page.waitForTimeout(500);
  await page.waitForLoadState('networkidle');
}

test.describe('Journey 4: Model List Search and Delete Guard', () => {
  test.setTimeout(120_000);

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

    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 30000,
    });
    await page.waitForLoadState('networkidle');
  });

  test('Search filters model list and delete guard prevents deleting referenced model', async ({
    page,
  }) => {
    // Log API responses for debugging
    page.on('response', async (response) => {
      if (response.url().includes('/ai/admin/models')) {
        const body = await response.text().catch(() => 'no body');
        console.log(`[API] ${response.status()} ${response.url()} → ${body.substring(0, 500)}`);
      }
    });

    // ── Step 1: Navigate to /ai/admin/models ────────────────────────────────
    await spaNavigate(page, '/ai/admin/models');
    await expect(
      page.getByLabel('breadcrumb').getByText('Model Registry'),
    ).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(3000);

    // Verify at least the seeded models are visible
    await expect(page.getByText('claude-opus-4-6').first()).toBeVisible({
      timeout: 15000,
    });

    // Count initial model rows (at least 3 seeded)
    const initialRows = page.locator('table tbody tr');
    const initialCount = await initialRows.count();
    expect(initialCount).toBeGreaterThanOrEqual(3);

    // ── Step 2: Search for "opus" ───────────────────────────────────────────
    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput).toBeVisible();
    await searchInput.fill('opus');

    // Wait for debounce (300ms) + API response
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');

    // Verify filtered results: only claude-opus-4-6 should be visible
    await expect(page.getByText('claude-opus-4-6').first()).toBeVisible();

    // Other models should not be visible
    const filteredRows = page.locator('table tbody tr');
    const filteredCount = await filteredRows.count();
    expect(filteredCount).toBeLessThan(initialCount);

    // ── Checkpoint 1: Search Filters Model List ─────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-search-filtered-opus.png`,
      fullPage: true,
    });

    // ── Step 3: Clear search — list resets ───────────────────────────────────
    await searchInput.clear();

    // Wait for debounce + API response
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');

    // Verify all models are back
    const resetRows = page.locator('table tbody tr');
    const resetCount = await resetRows.count();
    expect(resetCount).toBeGreaterThanOrEqual(initialCount);

    // ── Step 4: Click overflow menu on claude-opus-4-6 row ──────────────────
    const opusRow = page.getByRole('row').filter({ hasText: 'claude-opus-4-6' });
    await expect(opusRow).toBeVisible();

    // Click the overflow menu button (MoreHorizontal icon) in the opus row
    const overflowButton = opusRow.locator('button').filter({ has: page.locator('svg') }).last();
    await overflowButton.click();

    // Wait for dropdown to appear
    await page.waitForTimeout(500);

    // Verify dropdown menu items
    const editMenuItem = page.getByRole('menuitem', { name: /edit/i });
    const deleteMenuItem = page.getByRole('menuitem', { name: /delete/i });
    await expect(editMenuItem).toBeVisible();
    await expect(deleteMenuItem).toBeVisible();

    // Also verify the toggle active item is present
    const toggleMenuItem = page
      .getByRole('menuitem', { name: /deactivate|activate/i })
      .first();
    await expect(toggleMenuItem).toBeVisible();

    // ── Checkpoint 2: Overflow Menu Actions ──────────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-overflow-menu-open.png`,
      fullPage: true,
    });

    // ── Step 5: Click Delete action ─────────────────────────────────────────
    await deleteMenuItem.click();

    // Wait for confirmation dialog
    const dialog = page.locator('[role="alertdialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Verify dialog content
    await expect(dialog.getByText('Delete Model')).toBeVisible();
    await expect(
      dialog.getByText(/cannot be undone/i),
    ).toBeVisible();
    // Model name should appear in mono font
    await expect(dialog.getByText('claude-opus-4-6')).toBeVisible();

    // ── Checkpoint 3: Delete Confirmation Dialog ────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-delete-confirmation-dialog.png`,
      fullPage: true,
    });

    // ── Step 6: Confirm delete — expect error (model referenced by agents) ──
    // Listen for the DELETE response to verify server-side guard
    const deleteResponsePromise = page.waitForResponse(
      (resp) =>
        resp.url().includes('/ai/admin/models/') &&
        resp.request().method() === 'DELETE',
      { timeout: 15000 },
    );

    const confirmButton = dialog.getByRole('button', { name: /delete/i });
    await expect(confirmButton).toBeVisible();
    await confirmButton.click();

    // Wait for the API response
    const deleteResponse = await deleteResponsePromise;
    const deleteStatus = deleteResponse.status();

    // Expect a 4xx error (422 or 409 for referenced model)
    expect(deleteStatus).toBeGreaterThanOrEqual(400);

    // Verify error toast appears
    await expect(
      page
        .getByText(/referenced by/i)
        .or(page.getByText(/cannot.*delete/i))
        .or(page.getByText(/remove.*agent.*references/i))
        .or(page.getByText(/Failed to delete/i))
        .first(),
    ).toBeVisible({ timeout: 10000 });

    // Wait a moment for the toast to be fully visible
    await page.waitForTimeout(1000);

    // ── Checkpoint 4: Delete Blocked Error Toast ────────────────────────────
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-delete-blocked-error-toast.png`,
      fullPage: true,
    });

    // Verify model is still in the list (not deleted)
    await page.waitForTimeout(1000);

    // If dialog is still visible, close it
    const cancelButton = page
      .locator('[role="alertdialog"] button')
      .filter({ hasText: /cancel/i });
    if (await cancelButton.isVisible().catch(() => false)) {
      await cancelButton.click();
      await page.waitForTimeout(500);
    }

    // Confirm the model is still displayed in the list
    await expect(page.getByText('claude-opus-4-6').first()).toBeVisible({
      timeout: 10000,
    });
  });
});
