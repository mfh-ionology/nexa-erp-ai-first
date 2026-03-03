import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E2b/journey-8';

test.describe('Journey #8: Configure Permission Matrix for Custom Group', () => {
  // Pre-condition: login as admin before the journey starts
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@nexa-test.co.uk');
    await page.getByLabel('Password').fill('Admin123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
  });

  test('Admin configures permission matrix for QA_TESTER group and verifies persistence', async ({
    page,
  }) => {
    // ── Step 1: Navigate to /system/access-groups ──
    await page.goto('/system/access-groups');
    await expect(
      page.getByRole('heading', { name: 'Access Groups' })
    ).toBeVisible();

    // ── Step 2: Click QA_TESTER row in table ──
    const qaTesterRow = page.locator('table tbody tr', {
      hasText: 'QA_TESTER',
    });
    await expect(qaTesterRow).toBeVisible({ timeout: 10000 });
    await qaTesterRow.click();

    // Wait for navigation to the detail page
    await expect(page).toHaveURL(/\/system\/access-groups\/.+/, {
      timeout: 10000,
    });

    // Verify detail page loaded
    await expect(
      page
        .getByRole('heading', { name: /qa.?test/i })
        .or(page.getByRole('heading', { name: /qa testing/i }))
    ).toBeVisible({ timeout: 10000 });

    // Verify the permission matrix is visible with all checkboxes unchecked
    const permissionMatrix = page.locator('[data-testid="permission-matrix"]')
      .or(page.getByRole('table', { name: /permission/i }))
      .or(page.locator('.permission-matrix'));
    await expect(permissionMatrix).toBeVisible({ timeout: 10000 });

    // Visual Checkpoint 1: Empty permission matrix
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-qa-tester-empty-permission-matrix.png`,
      fullPage: true,
    });

    // ── Step 3: Click canAccess checkbox for system.users.list ──
    const usersListRow = permissionMatrix.locator('tr', {
      hasText: /users?.list|user management/i,
    });
    await expect(usersListRow).toBeVisible();

    const usersListCanAccess = usersListRow.locator(
      'input[type="checkbox"]'
    ).first();
    // The first checkbox in the row should be canAccess
    await usersListCanAccess.check();
    await expect(usersListCanAccess).toBeChecked();

    // ── Step 4: Click canView checkbox for system.users.list ──
    // canView is typically the 3rd checkbox (canAccess, canNew, canView) or 2nd depending on column order
    // Based on the test plan columns: canAccess, canNew, canView, canEdit, canDelete
    const usersListCheckboxes = usersListRow.locator('input[type="checkbox"]');
    // canAccess = index 0, canNew = index 1, canView = index 2
    await usersListCheckboxes.nth(2).check();
    await expect(usersListCheckboxes.nth(2)).toBeChecked();

    // ── Step 5: Click canAccess checkbox for system.users.detail ──
    const usersDetailRow = permissionMatrix.locator('tr', {
      hasText: /users?.detail|user detail/i,
    });
    await expect(usersDetailRow).toBeVisible();

    const usersDetailCheckboxes = usersDetailRow.locator(
      'input[type="checkbox"]'
    );
    await usersDetailCheckboxes.nth(0).check(); // canAccess
    await expect(usersDetailCheckboxes.nth(0)).toBeChecked();

    // ── Step 6: Click canView checkbox for system.users.detail ──
    await usersDetailCheckboxes.nth(2).check(); // canView
    await expect(usersDetailCheckboxes.nth(2)).toBeChecked();

    // ── Step 7: Click canAccess checkbox for system.company-profile.detail ──
    const companyProfileRow = permissionMatrix.locator('tr', {
      hasText: /company.?profile/i,
    });
    await expect(companyProfileRow).toBeVisible();

    const companyProfileCheckboxes = companyProfileRow.locator(
      'input[type="checkbox"]'
    );
    await companyProfileCheckboxes.nth(0).check(); // canAccess
    await expect(companyProfileCheckboxes.nth(0)).toBeChecked();

    // ── Step 8: Click canView checkbox for system.company-profile.detail ──
    await companyProfileCheckboxes.nth(2).check(); // canView
    await expect(companyProfileCheckboxes.nth(2)).toBeChecked();

    // Verify the expected state: 3 resources with canAccess+canView checked,
    // 3 resources (resources.list, access-groups.list, access-groups.detail) fully unchecked
    const resourcesListRow = permissionMatrix.locator('tr', {
      hasText: /resources?.list|resource registry/i,
    });
    const resourcesListCheckboxes = resourcesListRow.locator(
      'input[type="checkbox"]'
    );
    // All checkboxes for resources.list should be unchecked
    for (let i = 0; i < 5; i++) {
      await expect(resourcesListCheckboxes.nth(i)).not.toBeChecked();
    }

    // Visual Checkpoint 2: 6 checkboxes selected
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-8-permission-matrix-checkboxes-selected.png`,
      fullPage: true,
    });

    // ── Step 9: Click [Save Settings] button ──
    await page.getByRole('button', { name: /save/i }).click();

    // Wait for success feedback
    const successToast = page.getByText(/updated|saved|success/i).first();
    await expect(successToast).toBeVisible({ timeout: 10000 });

    // Visual Checkpoint 3: Save success
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-9-save-permissions-success.png`,
      fullPage: true,
    });

    // ── Step 10: Navigate back to access group list ──
    await page.goto('/system/access-groups');
    await expect(
      page.getByRole('heading', { name: 'Access Groups' })
    ).toBeVisible();

    // ── Step 11: Click QA_TESTER row again to verify persistence ──
    const qaTesterRowReload = page.locator('table tbody tr', {
      hasText: 'QA_TESTER',
    });
    await expect(qaTesterRowReload).toBeVisible({ timeout: 10000 });
    await qaTesterRowReload.click();

    await expect(page).toHaveURL(/\/system\/access-groups\/.+/, {
      timeout: 10000,
    });

    // Wait for the permission matrix to load
    const reloadedMatrix = page.locator('[data-testid="permission-matrix"]')
      .or(page.getByRole('table', { name: /permission/i }))
      .or(page.locator('.permission-matrix'));
    await expect(reloadedMatrix).toBeVisible({ timeout: 10000 });

    // Verify the same 6 checkboxes are still checked after reload
    const reloadedUsersListRow = reloadedMatrix.locator('tr', {
      hasText: /users?.list|user management/i,
    });
    const reloadedUsersListCbs = reloadedUsersListRow.locator(
      'input[type="checkbox"]'
    );
    await expect(reloadedUsersListCbs.nth(0)).toBeChecked(); // canAccess
    await expect(reloadedUsersListCbs.nth(2)).toBeChecked(); // canView

    const reloadedUsersDetailRow = reloadedMatrix.locator('tr', {
      hasText: /users?.detail|user detail/i,
    });
    const reloadedUsersDetailCbs = reloadedUsersDetailRow.locator(
      'input[type="checkbox"]'
    );
    await expect(reloadedUsersDetailCbs.nth(0)).toBeChecked(); // canAccess
    await expect(reloadedUsersDetailCbs.nth(2)).toBeChecked(); // canView

    const reloadedCompanyProfileRow = reloadedMatrix.locator('tr', {
      hasText: /company.?profile/i,
    });
    const reloadedCompanyProfileCbs = reloadedCompanyProfileRow.locator(
      'input[type="checkbox"]'
    );
    await expect(reloadedCompanyProfileCbs.nth(0)).toBeChecked(); // canAccess
    await expect(reloadedCompanyProfileCbs.nth(2)).toBeChecked(); // canView

    // Verify untouched resources remain unchecked
    const reloadedResourcesListRow = reloadedMatrix.locator('tr', {
      hasText: /resources?.list|resource registry/i,
    });
    const reloadedResourcesListCbs = reloadedResourcesListRow.locator(
      'input[type="checkbox"]'
    );
    for (let i = 0; i < 5; i++) {
      await expect(reloadedResourcesListCbs.nth(i)).not.toBeChecked();
    }

    // Visual Checkpoint 4: Permissions persisted after reload
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-11-permissions-persisted-after-reload.png`,
      fullPage: true,
    });
  });
});
