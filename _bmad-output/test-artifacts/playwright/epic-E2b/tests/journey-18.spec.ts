import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E2b/journey-18';

test.describe('Journey #18: Soft-Delete Custom Access Group', () => {
  // Pre-condition: login as admin before the journey starts
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@nexa-test.co.uk');
    await page.getByLabel('Password').fill('Admin123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
  });

  test('Admin removes QA_TESTER from sales user, then deactivates the custom access group', async ({
    page,
  }) => {
    // ═══════════════════════════════════════════════════════════════
    // PART 1: Remove QA_TESTER assignment from sales user
    // ═══════════════════════════════════════════════════════════════

    // ── Step 1: Navigate to /system/users ──
    await page.goto('/system/users');
    await expect(
      page.getByRole('heading', { name: /users/i })
    ).toBeVisible({ timeout: 10000 });

    // ── Step 2: Click sales@nexa-test.co.uk user row ──
    const salesUserRow = page.locator('table tbody tr', {
      hasText: 'sales@nexa-test.co.uk',
    });
    await expect(salesUserRow).toBeVisible({ timeout: 10000 });
    await salesUserRow.click();

    // Wait for navigation to user detail page
    await expect(page).toHaveURL(/\/system\/users\/.+/, {
      timeout: 10000,
    });

    // Verify user detail page loaded for the sales user
    await expect(
      page.getByText('sales@nexa-test.co.uk')
    ).toBeVisible({ timeout: 10000 });

    // ── Step 3: Update access group multi-select to only SALES_STAFF ──
    // Look for the access group selector (multi-select, combobox, or select)
    const accessGroupSelector = page.getByRole('combobox', { name: /access group/i })
      .or(page.getByLabel(/access group/i))
      .or(page.locator('[data-testid="access-group-selector"]'))
      .or(page.locator('select[name*="accessGroup"]'));

    // Try native multi-select first, then custom component fallback
    try {
      await accessGroupSelector.first().selectOption(['SALES_STAFF']);
    } catch {
      // Custom multi-select: remove QA_TESTER chip/tag
      const qaTesterChipRemove = page.locator('[data-testid="remove-QA_TESTER"]')
        .or(page.locator('button[aria-label*="remove QA_TESTER"]'))
        .or(page.locator('.chip', { hasText: 'QA_TESTER' }).locator('button'))
        .or(page.locator('.tag', { hasText: 'QA_TESTER' }).locator('button'));
      await qaTesterChipRemove.first().click();
    }

    // Verify only SALES_STAFF remains
    await expect(page.getByText('SALES_STAFF')).toBeVisible();

    // ── Step 4: Click Save access group assignments ──
    const saveAssignmentButton = page.getByRole('button', { name: /save.*access.*group/i })
      .or(page.getByRole('button', { name: /save.*assignment/i }))
      .or(page.getByRole('button', { name: /save/i }));
    await saveAssignmentButton.first().click();

    // Wait for success feedback
    const successToast1 = page.getByText(/updated|saved|success/i).first();
    await expect(successToast1).toBeVisible({ timeout: 10000 });

    // Verify QA_TESTER is no longer assigned
    await expect(page.getByText('QA_TESTER')).not.toBeVisible({ timeout: 5000 });

    // Visual Checkpoint 1: Access groups updated — only SALES_STAFF
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-sales-user-access-groups-updated.png`,
      fullPage: true,
    });

    // ═══════════════════════════════════════════════════════════════
    // PART 2: Navigate to QA_TESTER access group and deactivate it
    // ═══════════════════════════════════════════════════════════════

    // ── Step 5: Navigate to /system/access-groups ──
    await page.goto('/system/access-groups');
    await expect(
      page.getByRole('heading', { name: /access groups/i })
    ).toBeVisible({ timeout: 10000 });

    // ── Step 6: Click QA_TESTER row in table ──
    const qaTesterRow = page.locator('table tbody tr', {
      hasText: /QA_TESTER|QA Testing Team/i,
    });
    await expect(qaTesterRow).toBeVisible({ timeout: 10000 });
    await qaTesterRow.click();

    // Wait for navigation to detail page
    await expect(page).toHaveURL(/\/system\/access-groups\/.+/, {
      timeout: 10000,
    });

    // Verify detail page loaded for QA_TESTER
    await expect(
      page.getByText(/QA_TESTER|QA Testing Team/i)
    ).toBeVisible({ timeout: 10000 });

    // ── Step 7: Click Overflow menu (More Actions) ──
    const overflowButton = page.getByRole('button', { name: /more actions/i })
      .or(page.getByRole('button', { name: /overflow/i }))
      .or(page.locator('[data-testid="overflow-menu"]'))
      .or(page.locator('[data-testid="more-actions"]'))
      .or(page.locator('button[aria-label*="more"]'))
      .or(page.locator('button[aria-haspopup="menu"]'));
    await expect(overflowButton).toBeVisible({ timeout: 10000 });
    await overflowButton.click();

    // Wait for the menu to appear
    const menu = page.getByRole('menu')
      .or(page.locator('[role="menu"]'))
      .or(page.locator('[data-testid="overflow-menu-content"]'));
    await expect(menu).toBeVisible({ timeout: 5000 });

    // ── Step 8: Click Deactivate option ──
    const deactivateOption = page.getByRole('menuitem', { name: /deactivate/i })
      .or(page.getByText(/deactivate/i));
    await expect(deactivateOption).toBeVisible();
    await deactivateOption.click();

    // Wait for confirmation dialog
    const confirmDialog = page.getByRole('dialog')
      .or(page.getByRole('alertdialog'))
      .or(page.locator('[data-testid="confirm-dialog"]'));
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });

    // Verify dialog text mentions deactivation
    await expect(
      page.getByText(/are you sure.*deactivate/i)
        .or(page.getByText(/deactivate.*QA/i))
    ).toBeVisible();

    // Visual Checkpoint 2: Confirmation dialog for deactivation
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-8-deactivate-confirmation-dialog.png`,
      fullPage: true,
    });

    // ── Step 9: Click Confirm deactivation button ──
    const confirmButton = page.getByRole('button', { name: /confirm|yes|deactivate/i })
      .filter({ hasText: /confirm|yes|deactivate/i });
    await confirmButton.first().click();

    // Wait for success feedback and navigation back to list
    const successToast2 = page.getByText(/deactivated|removed|success/i).first();
    await expect(successToast2).toBeVisible({ timeout: 10000 });

    // Should be redirected to access group list
    await expect(page).toHaveURL(/\/system\/access-groups\/?$/, {
      timeout: 10000,
    });

    // Verify QA_TESTER is no longer visible in the active group list
    // (isActive filter defaults to true, so deactivated groups are hidden)
    await expect(
      page.locator('table tbody tr', { hasText: /QA_TESTER|QA Testing Team/i })
    ).not.toBeVisible({ timeout: 5000 });

    // Visual Checkpoint 3: Deactivation complete, QA_TESTER gone from list
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-9-deactivation-success-list.png`,
      fullPage: true,
    });
  });
});
