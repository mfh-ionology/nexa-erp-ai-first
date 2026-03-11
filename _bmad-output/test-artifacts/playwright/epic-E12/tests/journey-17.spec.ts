import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E12/journey-17';

test.describe('Journey 17: Reactivate a Deactivated Template', () => {
  test('should reactivate a deactivated template and verify it reappears in the active list', async ({ page }) => {
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

    // ── Navigate to document templates page ───────────────────────────
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

    // ── Prerequisite: Ensure 'E2E Cloned Invoice Template' is deactivated ──
    // Check if it's currently in the active list
    const clonedInActive = await page.getByText('E2E Cloned Invoice Template').first().isVisible().catch(() => false);

    if (clonedInActive) {
      // Template is active — deactivate it first as prerequisite
      const templateEl = page.getByText('E2E Cloned Invoice Template').first();
      const cardContainer = templateEl.locator('xpath=ancestor::div[contains(@class, "rounded") and contains(@class, "border")]').first();
      const overflowBtn = cardContainer.getByLabel('Template actions');
      await expect(overflowBtn).toBeVisible({ timeout: 5000 });
      await overflowBtn.click();

      await expect(page.getByRole('menuitem', { name: /Deactivate/i })).toBeVisible({ timeout: 5000 });
      await page.getByRole('menuitem', { name: /Deactivate/i }).click();

      // Handle confirmation dialog
      const deactivateDialog = page.getByText(/Deactivate Template/i);
      const dialogShown = await deactivateDialog.isVisible({ timeout: 3000 }).catch(() => false);
      if (dialogShown) {
        const confirmBtn = page.getByRole('button', { name: /^Deactivate$/i });
        await expect(confirmBtn).toBeVisible({ timeout: 3000 });
        await confirmBtn.click();
      }

      // Wait for deactivation to complete
      await page.waitForTimeout(2000);

      // Verify it's gone from active list
      const stillVisible = await page.getByText('E2E Cloned Invoice Template').first().isVisible().catch(() => false);
      expect(
        stillVisible,
        'Prerequisite: E2E Cloned Invoice Template should be deactivated before reactivation test',
      ).toBeFalsy();
    }

    // ── Step 1: Navigate to /settings/document-templates (already there) ──
    // Template list is loaded with active templates by default

    // ── Step 2: Click Show Inactive toggle ──────────────────────────────
    const showInactiveBtn = page.getByRole('button', { name: /Show Inactive/i });
    await expect(showInactiveBtn).toBeVisible({ timeout: 5000 });
    await showInactiveBtn.click();

    // Wait for list to refresh with inactive templates
    await page.waitForTimeout(1500);

    // Verify 'E2E Cloned Invoice Template' is visible in inactive list
    await expect(page.getByText('E2E Cloned Invoice Template').first()).toBeVisible({ timeout: 10000 });

    // CP-1: Inactive list showing deactivated template
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-inactive-list-with-deactivated-template.png`,
      fullPage: true,
    });

    // Verify the template has an 'Inactive' badge
    const inactiveCard = page.getByText('E2E Cloned Invoice Template').first()
      .locator('xpath=ancestor::div[contains(@class, "rounded") and contains(@class, "border")]').first();
    await expect(inactiveCard.getByText('Inactive')).toBeVisible({ timeout: 5000 });

    // ── Step 3: Click overflow menu on inactive template card ────────────
    const inactiveOverflowTrigger = inactiveCard.getByLabel('Template actions');
    await expect(inactiveOverflowTrigger).toBeVisible({ timeout: 5000 });
    await inactiveOverflowTrigger.click();

    // Verify 'Activate' option appears
    await expect(page.getByRole('menuitem', { name: /Activate/i })).toBeVisible({ timeout: 5000 });

    // CP-2: Overflow menu with Activate option
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-overflow-menu-activate-option.png`,
      fullPage: true,
    });

    // ── Step 4: Click Activate option ───────────────────────────────────
    await page.getByRole('menuitem', { name: /Activate/i }).click();

    // Handle activation confirmation dialog if it appears
    const activateDialog = page.getByText(/Activate Template/i);
    const activateDialogShown = await activateDialog.isVisible({ timeout: 3000 }).catch(() => false);
    if (activateDialogShown) {
      const confirmActivateBtn = page.getByRole('button', { name: /^Activate$/i });
      await expect(confirmActivateBtn).toBeVisible({ timeout: 3000 });
      await confirmActivateBtn.click();
    }

    // Wait for reactivation to complete
    await page.waitForTimeout(2000);

    // CP-3: Template reactivated — success toast
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-template-reactivated-success.png`,
      fullPage: true,
    });

    // ── Step 5: Toggle back to active view ──────────────────────────────
    // The toggle should now say "Showing Inactive" — click to go back to active
    const showingInactiveBtn = page.getByRole('button', { name: /Showing Inactive|Show Inactive/i });
    await expect(showingInactiveBtn).toBeVisible({ timeout: 5000 });
    await showingInactiveBtn.click();

    // Wait for active list to load
    await page.waitForTimeout(1500);

    // Verify 'E2E Cloned Invoice Template' is now visible in the active list
    await expect(page.getByText('E2E Cloned Invoice Template').first()).toBeVisible({ timeout: 10000 });

    // CP-4: Active list with reactivated template
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-active-list-with-reactivated-template.png`,
      fullPage: true,
    });

    // Verify the template now has an 'Active' badge (green)
    const reactivatedCard = page.getByText('E2E Cloned Invoice Template').first()
      .locator('xpath=ancestor::div[contains(@class, "rounded") and contains(@class, "border")]').first();
    await expect(reactivatedCard.getByText('Active')).toBeVisible({ timeout: 5000 });
  });
});
