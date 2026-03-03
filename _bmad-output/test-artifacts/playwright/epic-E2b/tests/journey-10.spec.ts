import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E2b/journey-10';

test.describe('Journey #10: Assign Access Groups to a User', () => {
  // Pre-condition: login as admin before the journey starts
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@nexa-test.co.uk');
    await page.getByLabel('Password').fill('Admin123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
  });

  test('Admin assigns QA_TESTER and SALES_STAFF access groups to sales user via user detail page', async ({
    page,
  }) => {
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

    // Visual Checkpoint 1: User detail page with current access groups
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-user-detail-sales-access-groups.png`,
      fullPage: true,
    });

    // ── Step 3: Verify Access Groups assignment panel ──
    // The panel should show the currently assigned group: SALES_STAFF
    const accessGroupsPanel = page.locator('[data-testid="access-groups-panel"]')
      .or(page.locator('section', { hasText: /access group/i }))
      .or(page.locator('div', { hasText: /access group/i }).first());
    await expect(accessGroupsPanel).toBeVisible({ timeout: 10000 });

    // Verify SALES_STAFF is currently assigned (shown as tag/chip)
    await expect(
      page.getByText('SALES_STAFF')
    ).toBeVisible({ timeout: 5000 });

    // ── Step 4: Click Add access group selector / multi-select ──
    // Look for a multi-select dropdown, combobox, or add button for access groups
    const accessGroupSelector = page.getByRole('combobox', { name: /access group/i })
      .or(page.getByLabel(/access group/i))
      .or(page.locator('[data-testid="access-group-selector"]'))
      .or(page.locator('select[name*="accessGroup"]'));
    await accessGroupSelector.first().click();

    // ── Step 5: Select both SALES_STAFF and QA_TESTER ──
    // For multi-select, we need to select QA_TESTER (SALES_STAFF may already be selected)
    const qaTesterOption = page.getByRole('option', { name: /QA_TESTER/i })
      .or(page.getByText(/QA_TESTER/i))
      .or(page.getByRole('checkbox', { name: /QA_TESTER/i }));

    // If it's a native multi-select
    try {
      await accessGroupSelector.first().selectOption(['SALES_STAFF', 'QA_TESTER']);
    } catch {
      // Fallback: custom multi-select — click QA_TESTER option
      await qaTesterOption.first().click();
    }

    // Verify both are now selected
    await expect(page.getByText('SALES_STAFF')).toBeVisible();
    await expect(page.getByText('QA_TESTER')).toBeVisible();

    // ── Step 6: Click Save access group assignments button ──
    const saveButton = page.getByRole('button', { name: /save.*access.*group/i })
      .or(page.getByRole('button', { name: /save.*assignment/i }))
      .or(page.getByRole('button', { name: /save/i }));
    await saveButton.first().click();

    // Wait for success feedback — 200 response from PUT /system/users/:id/access-groups
    const successToast = page.getByText(/updated|saved|success/i).first();
    await expect(successToast).toBeVisible({ timeout: 10000 });

    // Verify both groups are displayed after save
    await expect(page.getByText('SALES_STAFF')).toBeVisible();
    await expect(page.getByText('QA_TESTER')).toBeVisible();

    // Visual Checkpoint 2: Access groups saved successfully
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-access-groups-save-success.png`,
      fullPage: true,
    });

    // ── Step 7: Navigate back to /system/users ──
    await page.goto('/system/users');
    await expect(
      page.getByRole('heading', { name: /users/i })
    ).toBeVisible({ timeout: 10000 });

    // ── Step 8: Click sales@nexa-test.co.uk user row again to verify persistence ──
    const salesUserRowReload = page.locator('table tbody tr', {
      hasText: 'sales@nexa-test.co.uk',
    });
    await expect(salesUserRowReload).toBeVisible({ timeout: 10000 });
    await salesUserRowReload.click();

    // Wait for navigation to user detail page
    await expect(page).toHaveURL(/\/system\/users\/.+/, {
      timeout: 10000,
    });

    // Verify the access groups persisted — both SALES_STAFF and QA_TESTER still assigned
    await expect(page.getByText('SALES_STAFF')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('QA_TESTER')).toBeVisible({ timeout: 10000 });

    // Visual Checkpoint 3: Access groups persisted after reload
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-8-access-groups-persisted.png`,
      fullPage: true,
    });
  });
});
