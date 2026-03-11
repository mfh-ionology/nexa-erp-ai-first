import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E12/journey-18';

test.describe('Journey 18: Delete a Template Version with Confirmation Dialog', () => {
  test('should delete the French locale version from E2E Test Invoice Template with confirmation', async ({
    page,
  }) => {
    // ── Setup: Navigate and authenticate ──────────────────────────────
    await page.goto('/');

    if (page.url().includes('/login')) {
      await page.getByPlaceholder('you@company.co.uk').fill('admin@nexa-erp.dev');
      await page.getByPlaceholder('Enter your password').fill('NexaDev2026!');
      await page.getByRole('button', { name: 'Sign In' }).click();
      await page.waitForFunction(
        () => !window.location.pathname.includes('/login'),
        { timeout: 20000 },
      );
    }

    await page.waitForSelector('nav, aside', { timeout: 15000 });

    // ── Step 1: Navigate to /settings/document-templates ──────────────
    const docTemplatesLink = page.locator('a[href*="document-templates"]');
    const linkCount = await docTemplatesLink.count();

    if (linkCount > 0) {
      await docTemplatesLink.first().click();
    } else {
      await page.evaluate(async () => {
        const mod = await import('/src/router.ts');
        await mod.router.navigate({ to: '/settings/document-templates' });
      });
    }

    await page.waitForFunction(
      () => window.location.pathname.includes('/settings/document-templates'),
      { timeout: 10000 },
    );

    // Wait for template list to load
    await expect(page.getByText(/\(\d+ templates?\)/).first()).toBeVisible({ timeout: 15000 });

    // Wait for skeletons to clear
    try {
      await page.waitForFunction(
        () => document.querySelectorAll('[class*="skeleton"]').length === 0,
        { timeout: 10000 },
      );
    } catch {
      // Already gone
    }

    // ── Step 2: Click 'E2E Test Invoice Template' card to enter detail view ──
    const e2eTemplateCard = page.locator('.cursor-pointer.rounded-xl', {
      hasText: 'E2E Test Invoice Template',
    });
    await expect(e2eTemplateCard).toBeVisible({ timeout: 10000 });
    await e2eTemplateCard.click();

    // Wait for detail view to load
    await expect(page.locator('h2', { hasText: 'E2E Test Invoice Template' })).toBeVisible({
      timeout: 10000,
    });

    // Verify Versions section is visible
    const versionsHeader = page.locator('h3', { hasText: 'Versions' });
    await expect(versionsHeader).toBeVisible({ timeout: 5000 });

    // Wait for version data to load
    await page.waitForTimeout(1000);

    // CP-1: Template detail view with version visible
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-detail-view-with-version.png`,
      fullPage: true,
    });

    // ── Step 3: Click three-dot overflow menu on the French version card ──
    const versionActionsBtn = page.getByRole('button', { name: 'Version actions' }).first();
    await expect(versionActionsBtn).toBeVisible({ timeout: 5000 });
    await versionActionsBtn.click();

    // Wait for overflow menu to appear
    await page.waitForTimeout(300);

    // Verify Delete option is in the menu
    const deleteMenuItem = page.getByRole('menuitem', { name: /Delete/i });
    await expect(deleteMenuItem).toBeVisible({ timeout: 5000 });

    // ── Step 4: Click Delete option in version overflow menu ──────────
    await deleteMenuItem.click();

    // Verify confirmation dialog appears
    const dialog = page.locator('[role="dialog"], [role="alertdialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Verify dialog has heading and warning text about deletion
    await expect(dialog.getByRole('heading', { name: 'Delete Version' })).toBeVisible({ timeout: 5000 });
    await expect(dialog.getByText(/Are you sure you want to permanently delete/i)).toBeVisible({ timeout: 5000 });

    // Verify Cancel and Delete buttons are present
    await expect(dialog.getByRole('button', { name: /Cancel/i })).toBeVisible({ timeout: 3000 });
    const deleteConfirmBtn = dialog.getByRole('button', { name: /Delete/i });
    await expect(deleteConfirmBtn).toBeVisible({ timeout: 3000 });

    // CP-2: Delete confirmation dialog
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-delete-confirmation-dialog.png`,
      fullPage: true,
    });

    // ── Step 5: Click Cancel to dismiss the dialog ────────────────────
    await dialog.getByRole('button', { name: /Cancel/i }).click();

    // Wait for dialog to close
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // ── Step 6: Verify version is still present after cancellation ────
    // The version card should still be visible
    await expect(versionActionsBtn).toBeVisible({ timeout: 5000 });

    // CP-3: Version still present after Cancel
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-version-still-present-after-cancel.png`,
      fullPage: true,
    });

    // ── Step 7: Click overflow menu again on the French version card ──
    await versionActionsBtn.click();
    await page.waitForTimeout(300);

    // ── Step 8: Click Delete option again ─────────────────────────────
    const deleteMenuItem2 = page.getByRole('menuitem', { name: /Delete/i });
    await expect(deleteMenuItem2).toBeVisible({ timeout: 5000 });
    await deleteMenuItem2.click();

    // Verify confirmation dialog appears again
    const dialog2 = page.locator('[role="dialog"], [role="alertdialog"]');
    await expect(dialog2).toBeVisible({ timeout: 5000 });

    // ── Step 9: Click Delete confirmation button (red) ────────────────
    const confirmDeleteBtn = dialog2.getByRole('button', { name: /Delete/i });
    await expect(confirmDeleteBtn).toBeVisible({ timeout: 3000 });
    await confirmDeleteBtn.click();

    // Wait for dialog to close and version to be deleted
    await expect(dialog2).not.toBeVisible({ timeout: 10000 });

    // Wait for the versions list to refresh
    await page.waitForTimeout(1500);

    // Verify version count shows (0) or empty state
    const zeroVersions = page.getByText('(0)');
    const emptyState = page.getByText(/no versions|empty/i);
    const hasZero = await zeroVersions.isVisible().catch(() => false);
    const hasEmpty = await emptyState.isVisible().catch(() => false);
    expect(hasZero || hasEmpty, 'Expected version count (0) or empty state after deletion').toBeTruthy();

    // CP-4: Version deleted successfully
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-9-version-deleted-success.png`,
      fullPage: true,
    });
  });
});
