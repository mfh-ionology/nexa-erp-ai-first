import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E2b/journey-21';

test.describe('Journey #21: Verify Cache Invalidation After Permission Change', () => {
  test('Admin modifies SALES_STAFF permissions and sales user sees changes immediately', async ({
    page,
  }) => {
    // ═══════════════════════════════════════════════════════════════════
    // PHASE 1: Admin grants canAccess+canView on system.resources.list
    //          to SALES_STAFF group
    // ═══════════════════════════════════════════════════════════════════

    // ── Step 1: Login as admin ──
    await page.goto('/login');
    await expect(page.getByLabel('Email')).toBeVisible({ timeout: 10000 });
    await page.getByLabel('Email').fill('admin@nexa-test.co.uk');
    await page.getByLabel('Password').fill('Admin123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/dashboard**', { timeout: 15000 });

    // ── Step 1: Navigate to /system/access-groups ──
    await page.goto('/system/access-groups');
    await expect(
      page.getByRole('heading', { name: 'Access Groups' })
    ).toBeVisible({ timeout: 10000 });

    // ── Step 2: Click SALES_STAFF row in table ──
    const salesStaffRow = page.locator('table tbody tr', {
      hasText: 'SALES_STAFF',
    });
    await expect(salesStaffRow).toBeVisible({ timeout: 10000 });
    await salesStaffRow.click();

    // Wait for navigation to the detail page
    await expect(page).toHaveURL(/\/system\/access-groups\/.+/, {
      timeout: 10000,
    });

    // Wait for the permission matrix to load
    const permissionMatrix = page
      .locator('[data-testid="permission-matrix"]')
      .or(page.getByRole('table', { name: /permission/i }))
      .or(page.locator('.permission-matrix'));
    await expect(permissionMatrix).toBeVisible({ timeout: 10000 });

    // ── Step 3: Click canAccess checkbox for system.resources.list ──
    const resourcesListRow = permissionMatrix.locator('tr', {
      hasText: /resources?.list|resource registry/i,
    });
    await expect(resourcesListRow).toBeVisible();

    const resourcesListCheckboxes = resourcesListRow.locator(
      'input[type="checkbox"]'
    );
    // canAccess = index 0
    await resourcesListCheckboxes.nth(0).check();
    await expect(resourcesListCheckboxes.nth(0)).toBeChecked();

    // ── Step 4: Click canView checkbox for system.resources.list ──
    // canView = index 2 (canAccess=0, canNew=1, canView=2)
    await resourcesListCheckboxes.nth(2).check();
    await expect(resourcesListCheckboxes.nth(2)).toBeChecked();

    // ── Step 5: Click [Save Settings] button ──
    await page.getByRole('button', { name: /save/i }).click();

    // Wait for success feedback
    const successToast = page.getByText(/updated|saved|success/i).first();
    await expect(successToast).toBeVisible({ timeout: 10000 });

    // Visual Checkpoint 1: Permission save success toast
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-permissions-saved-success-toast.png`,
      fullPage: true,
    });

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 2: Login as sales user and verify updated permissions
    //          take effect immediately (cache was invalidated)
    // ═══════════════════════════════════════════════════════════════════

    // ── Step 6: Navigate to /login to switch users ──
    await page.goto('/login');
    await expect(page.getByLabel('Email')).toBeVisible({ timeout: 10000 });

    // ── Step 7: Fill login form with sales user credentials ──
    await page.getByLabel('Email').fill('sales@nexa-test.co.uk');
    await page.getByLabel('Password').fill('Sales123!');

    // ── Step 8: Click Sign In ──
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/dashboard**', { timeout: 15000 });

    // Wait for sidebar to be fully rendered (permissions loaded via GET /system/my-permissions)
    const sidebar = page.locator(
      'nav, [role="navigation"], aside, [data-testid="sidebar"]'
    );
    await expect(sidebar.first()).toBeVisible({ timeout: 10000 });

    // Allow time for permission-driven sidebar to render
    await page.waitForTimeout(1000);

    // Verify "Resource Registry" is now visible in sidebar
    // (it was previously absent for SALES_STAFF — the permission change + cache invalidation made it visible)
    await expect(
      sidebar.first().getByText('Resource Registry')
    ).toBeVisible({ timeout: 10000 });

    // Visual Checkpoint 2: Sales user dashboard with Resource Registry in sidebar
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-8-sales-dashboard-resource-registry-visible.png`,
      fullPage: true,
    });

    // ── Step 9: Click Resource Registry sidebar link ──
    await sidebar.first().getByText('Resource Registry').click();

    // Verify the Resource Registry page loads successfully (not denied)
    await expect(
      page.getByRole('heading', { name: /resource registry/i })
    ).toBeVisible({ timeout: 10000 });

    // Visual Checkpoint 3: Resource Registry page accessible by sales user
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-9-resource-registry-accessible-by-sales.png`,
      fullPage: true,
    });

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 3: Revert — admin removes the permissions we just added
    //          to restore SALES_STAFF to original state
    // ═══════════════════════════════════════════════════════════════════

    // ── Step 10: Navigate to /login to switch back to admin ──
    await page.goto('/login');
    await expect(page.getByLabel('Email')).toBeVisible({ timeout: 10000 });

    // ── Step 11: Fill admin credentials ──
    await page.getByLabel('Email').fill('admin@nexa-test.co.uk');
    await page.getByLabel('Password').fill('Admin123!');

    // ── Step 12: Click Sign In ──
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/dashboard**', { timeout: 15000 });

    // ── Step 13: Navigate to /system/access-groups ──
    await page.goto('/system/access-groups');
    await expect(
      page.getByRole('heading', { name: 'Access Groups' })
    ).toBeVisible({ timeout: 10000 });

    // ── Step 14: Click SALES_STAFF row ──
    const salesStaffRowRevert = page.locator('table tbody tr', {
      hasText: 'SALES_STAFF',
    });
    await expect(salesStaffRowRevert).toBeVisible({ timeout: 10000 });
    await salesStaffRowRevert.click();

    await expect(page).toHaveURL(/\/system\/access-groups\/.+/, {
      timeout: 10000,
    });

    // Wait for the permission matrix to load
    const revertMatrix = page
      .locator('[data-testid="permission-matrix"]')
      .or(page.getByRole('table', { name: /permission/i }))
      .or(page.locator('.permission-matrix'));
    await expect(revertMatrix).toBeVisible({ timeout: 10000 });

    // ── Step 15: Uncheck canAccess for system.resources.list ──
    const revertResourcesListRow = revertMatrix.locator('tr', {
      hasText: /resources?.list|resource registry/i,
    });
    await expect(revertResourcesListRow).toBeVisible();

    const revertResourcesListCheckboxes = revertResourcesListRow.locator(
      'input[type="checkbox"]'
    );
    await revertResourcesListCheckboxes.nth(0).uncheck(); // canAccess
    await expect(revertResourcesListCheckboxes.nth(0)).not.toBeChecked();

    // ── Step 16: Uncheck canView for system.resources.list ──
    await revertResourcesListCheckboxes.nth(2).uncheck(); // canView
    await expect(revertResourcesListCheckboxes.nth(2)).not.toBeChecked();

    // ── Step 17: Click [Save Settings] to restore original state ──
    await page.getByRole('button', { name: /save/i }).click();

    // Wait for success feedback
    const revertSuccessToast = page
      .getByText(/updated|saved|success/i)
      .first();
    await expect(revertSuccessToast).toBeVisible({ timeout: 10000 });
  });
});
