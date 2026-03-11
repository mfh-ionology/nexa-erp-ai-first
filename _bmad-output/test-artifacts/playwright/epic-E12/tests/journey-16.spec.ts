import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E12/journey-16';

test.describe('Journey 16: Deactivate a Template and Show Inactive Templates', () => {
  test('should deactivate a template, verify removal from active list, and show it via Show Inactive toggle', async ({ page }) => {
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

    // ── Step 1: Verify template list with 'E2E Cloned Invoice Template' ──
    const clonedTemplateCard = page.getByText('E2E Cloned Invoice Template').first();
    await expect(clonedTemplateCard).toBeVisible({ timeout: 10000 });

    // CP-1: Template list loaded with target template visible
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-template-list-with-cloned-template.png`,
      fullPage: true,
    });

    // ── Step 2: Click overflow menu on 'E2E Cloned Invoice Template' ──
    // Find the template name element, go up to the card container, then find the "Template actions" button
    const clonedTemplateEl = page.getByText('E2E Cloned Invoice Template').first();
    // The card structure has the name h3 and the actions button as siblings in a flex row
    // Navigate from the template name up to the card element, then find the trigger
    const clonedCardContainer = clonedTemplateEl.locator('xpath=ancestor::div[contains(@class, "rounded") and contains(@class, "border")]').first();
    const overflowTrigger = clonedCardContainer.getByLabel('Template actions');
    await expect(overflowTrigger).toBeVisible({ timeout: 5000 });
    await overflowTrigger.click();

    // Wait for dropdown menu to appear
    await expect(page.getByRole('menuitem', { name: /Deactivate/i })).toBeVisible({ timeout: 5000 });

    // ── Step 3: Click Deactivate option ───────────────────────────────
    await page.getByRole('menuitem', { name: /Deactivate/i }).click();

    // Wait for confirmation dialog
    await expect(page.getByText(/Deactivate Template/i)).toBeVisible({ timeout: 5000 });

    // CP-2: Deactivation confirmation dialog
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-deactivate-confirmation-dialog.png`,
      fullPage: true,
    });

    // Verify dialog content mentions the template name in the description
    await expect(page.getByText(/Are you sure you want to deactivate.*E2E Cloned Invoice Template/i)).toBeVisible();

    // Click confirm Deactivate button in the dialog
    const confirmDeactivateBtn = page.getByRole('button', { name: /^Deactivate$/i });
    await expect(confirmDeactivateBtn).toBeVisible({ timeout: 3000 });
    await confirmDeactivateBtn.click();

    // Wait for success feedback and list to refresh
    await page.waitForTimeout(2000);

    // CP-3: Template deactivated — success toast and removed from list
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-template-deactivated-success.png`,
      fullPage: true,
    });

    // Verify 'E2E Cloned Invoice Template' is no longer visible in active list
    const clonedStillVisible = await page.getByText('E2E Cloned Invoice Template').first().isVisible().catch(() => false);
    expect(
      clonedStillVisible,
      'E2E Cloned Invoice Template should not be visible in the active template list after deactivation',
    ).toBeFalsy();

    // ── Step 4: Click Show Inactive toggle ────────────────────────────
    const showInactiveBtn = page.getByRole('button', { name: /Show Inactive/i });
    await expect(showInactiveBtn).toBeVisible({ timeout: 5000 });
    await showInactiveBtn.click();

    // Wait for list to refresh with inactive templates
    await page.waitForTimeout(1500);

    // 'E2E Cloned Invoice Template' should now be visible again
    await expect(page.getByText('E2E Cloned Invoice Template').first()).toBeVisible({ timeout: 10000 });

    // CP-4: Show Inactive toggled — inactive template visible
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-showing-inactive-templates.png`,
      fullPage: true,
    });

    // Verify the button text changed to 'Showing Inactive'
    await expect(page.getByRole('button', { name: /Showing Inactive/i })).toBeVisible({ timeout: 3000 });

    // Verify the deactivated template has an 'Inactive' badge
    const inactiveCardForBadge = page.getByText('E2E Cloned Invoice Template').first()
      .locator('xpath=ancestor::div[contains(@class, "rounded") and contains(@class, "border")]').first();
    await expect(inactiveCardForBadge.getByText('Inactive')).toBeVisible({ timeout: 5000 });

    // ── Step 5: Verify overflow menu shows 'Activate' for inactive template ──
    // Find the overflow trigger on the inactive template card using same approach
    const inactiveTemplateEl = page.getByText('E2E Cloned Invoice Template').first();
    const inactiveCardContainer = inactiveTemplateEl.locator('xpath=ancestor::div[contains(@class, "rounded") and contains(@class, "border")]').first();
    const inactiveOverflowTrigger = inactiveCardContainer.getByLabel('Template actions');
    await expect(inactiveOverflowTrigger).toBeVisible({ timeout: 5000 });
    await inactiveOverflowTrigger.click();

    // Verify 'Activate' option is shown (not 'Deactivate')
    await expect(page.getByRole('menuitem', { name: /Activate/i })).toBeVisible({ timeout: 5000 });

    // CP-5: Overflow menu shows Activate option for inactive template
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-activate-option-in-menu.png`,
      fullPage: true,
    });

    // Verify 'Deactivate' is NOT shown
    const deactivateOption = page.getByRole('menuitem', { name: /^Deactivate$/i });
    const deactivateVisible = await deactivateOption.isVisible().catch(() => false);
    expect(
      deactivateVisible,
      'Deactivate option should NOT be visible for an inactive template — only Activate should appear',
    ).toBeFalsy();

    // ── Cleanup: Reactivate the template so subsequent journeys work ──
    await page.getByRole('menuitem', { name: /Activate/i }).click();

    // Handle activation confirmation dialog if it appears
    const activateDialog = page.getByText(/Activate Template/i);
    const dialogAppeared = await activateDialog.isVisible({ timeout: 3000 }).catch(() => false);
    if (dialogAppeared) {
      const confirmActivateBtn = page.getByRole('button', { name: /^Activate$/i });
      await confirmActivateBtn.click();
    }

    // Wait for reactivation to complete
    await page.waitForTimeout(2000);
  });
});
