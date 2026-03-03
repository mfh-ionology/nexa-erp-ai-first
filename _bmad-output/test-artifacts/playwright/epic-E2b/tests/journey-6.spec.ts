import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E2b/journey-6';

test.describe('Journey #6: View Access Group Detail with Permission Matrix', () => {
  // Pre-condition: login as admin before the journey starts
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@nexa-test.co.uk');
    await page.getByLabel('Password').fill('Admin123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
  });

  test('Admin views FULL_ACCESS detail page with permission matrix and field overrides', async ({
    page,
  }) => {
    // ── Step 1: Navigate to /system/access-groups ──
    await page.goto('/system/access-groups');
    await expect(
      page.getByRole('heading', { name: 'Access Groups' })
    ).toBeVisible();

    // ── Step 2: Click FULL_ACCESS row in table ──
    const fullAccessRow = page.locator('table tbody tr', {
      hasText: 'FULL_ACCESS',
    });
    await expect(fullAccessRow).toBeVisible();
    await fullAccessRow.click();

    // Wait for navigation to the detail page
    await expect(page).toHaveURL(/\/system\/access-groups\/.+/, { timeout: 10000 });

    // Verify detail page loaded — title should show "Full Access"
    await expect(
      page.getByRole('heading', { name: /full access/i })
    ).toBeVisible();

    // Verify system group banner is visible
    const systemBanner = page.getByText(/system.*(access group|group)/i)
      .or(page.locator('[data-testid="system-group-banner"]'))
      .or(page.getByText(/cannot be (changed|deleted)/i));
    await expect(systemBanner).toBeVisible();

    // Verify [Save Settings] button is present
    await expect(
      page.getByRole('button', { name: /save/i })
    ).toBeVisible();

    // Visual Checkpoint 1: FULL_ACCESS detail page loaded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-full-access-detail-page.png`,
      fullPage: true,
    });

    // ── Step 3: Verify group metadata — code and name ──
    await expect(page.getByText('FULL_ACCESS')).toBeVisible();
    await expect(page.getByText('Full Access')).toBeVisible();

    // ── Step 4: Verify permission matrix grid ──
    // The permission matrix should have checkbox columns
    const permissionMatrix = page.locator('[data-testid="permission-matrix"]')
      .or(page.locator('.permission-matrix'))
      .or(page.locator('table').filter({ hasText: /canAccess|Access/i }));
    await expect(permissionMatrix).toBeVisible({ timeout: 10000 });

    // Verify column headers exist (canAccess, canNew, canView, canEdit, canDelete)
    // These may be rendered as table headers or as labels
    const columnHeaders = ['Access', 'New', 'View', 'Edit', 'Delete'];
    for (const header of columnHeaders) {
      await expect(
        permissionMatrix.getByText(header, { exact: false }).first()
      ).toBeVisible();
    }

    // Visual Checkpoint 2: Permission matrix grid visible
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-permission-matrix.png`,
      fullPage: true,
    });

    // ── Step 5: Verify System module section with all 6 resources, all checked ──
    // Check that system resources are listed in the permission matrix
    const resourceNames = [
      'users.list',
      'users.detail',
      'company-profile.detail',
      'resources.list',
      'access-groups.list',
      'access-groups.detail',
    ];

    for (const resourceName of resourceNames) {
      // Each resource code should appear in the permission matrix
      await expect(
        page.getByText(resourceName, { exact: false }).first()
      ).toBeVisible();
    }

    // For FULL_ACCESS, verify that checkboxes are checked
    // Find all checkboxes within the permission matrix area and verify they're checked
    const checkboxes = permissionMatrix.locator('input[type="checkbox"]');
    const checkboxCount = await checkboxes.count();
    // Should have at least 6 resources * 5 permissions = 30 checkboxes
    expect(checkboxCount).toBeGreaterThanOrEqual(30);

    // Verify all checkboxes in the FULL_ACCESS permission matrix are checked
    for (let i = 0; i < checkboxCount; i++) {
      await expect(checkboxes.nth(i)).toBeChecked();
    }

    // ── Step 6: Verify Field Overrides section ──
    const fieldOverridesSection = page.getByText(/field overrides/i).first()
      .or(page.locator('[data-testid="field-overrides"]'))
      .or(page.locator('.field-overrides'));
    await expect(fieldOverridesSection).toBeVisible();

    // Verify resource selector dropdown is present in the field overrides area
    const resourceSelector = page.getByRole('combobox', { name: /resource/i })
      .or(page.locator('select').filter({ hasText: /select resource/i }))
      .or(page.getByPlaceholder(/select resource/i));
    await expect(resourceSelector).toBeVisible();

    // Visual Checkpoint 3: Field Overrides section visible
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-field-overrides-section.png`,
      fullPage: true,
    });
  });
});
