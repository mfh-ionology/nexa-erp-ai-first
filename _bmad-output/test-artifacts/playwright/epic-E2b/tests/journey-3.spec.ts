import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E2b/journey-3';

test.describe('Journey 3: View Access Group List with Pre-Built Groups', () => {
  // Pre-condition: login as admin before the journey starts
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@nexa-test.co.uk');
    await page.getByLabel('Password').fill('Admin123!');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
  });

  test('Admin views Access Group list with all 12 pre-built groups, system badges, and search filter', async ({
    page,
  }) => {
    // --- Step 1: Click Access Groups sidebar link ---
    await page.getByRole('link', { name: 'Access Groups' }).click();
    await expect(page).toHaveURL(/\/system\/access-groups/);

    // --- Step 2: Verify Access Groups page title ---
    await expect(
      page.getByRole('heading', { name: 'Access Groups' })
    ).toBeVisible();

    // Verify [+ New Access Group] button is visible
    await expect(
      page.getByRole('link', { name: /new access group/i }).or(
        page.getByRole('button', { name: /new access group/i })
      )
    ).toBeVisible();

    // Visual Checkpoint 1: Access Groups page loaded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-access-groups-page.png`,
      fullPage: true,
    });

    // --- Step 3: Verify table contains 12 rows for pre-built groups ---
    const tableRows = page.locator('table tbody tr');
    await expect(tableRows).toHaveCount(12, { timeout: 10000 });

    // --- Step 4: Verify all 12 pre-built access group codes are visible ---
    const expectedCodes = [
      'FULL_ACCESS',
      'FINANCE_MANAGER',
      'FINANCE_CLERK',
      'SALES_MANAGER',
      'SALES_STAFF',
      'PURCHASE_MANAGER',
      'PURCHASE_CLERK',
      'WAREHOUSE_STAFF',
      'HR_MANAGER',
      'HR_VIEWER',
      'REPORT_VIEWER',
      'READ_ONLY',
    ];

    for (const code of expectedCodes) {
      await expect(page.getByText(code, { exact: true })).toBeVisible();
    }

    // --- Step 5: Verify System badge on pre-built groups ---
    // All 12 pre-built groups should have a system badge/indicator
    const systemBadges = page.locator('table tbody tr').locator('text=System').or(
      page.locator('table tbody tr [data-testid="system-badge"]')
    );
    // At minimum, verify the FULL_ACCESS row has a system badge
    const fullAccessRow = page.locator('table tbody tr', {
      hasText: 'FULL_ACCESS',
    });
    await expect(fullAccessRow).toBeVisible();
    // Check for a system indicator within the row (badge, icon, or text)
    await expect(
      fullAccessRow.getByText('System').or(
        fullAccessRow.locator('[data-testid="system-badge"]')
      ).or(
        fullAccessRow.locator('.badge, .chip, .tag').filter({ hasText: /system/i })
      )
    ).toBeVisible();

    // --- Step 6: Search for "manager" ---
    const searchInput = page.getByPlaceholder(/search/i).or(
      page.getByRole('searchbox')
    );
    await searchInput.fill('manager');

    // Wait for filter to take effect
    await page.waitForTimeout(500);

    // Verify filtered results show only the 4 manager groups
    const managerCodes = [
      'FINANCE_MANAGER',
      'SALES_MANAGER',
      'PURCHASE_MANAGER',
      'HR_MANAGER',
    ];
    for (const code of managerCodes) {
      await expect(page.getByText(code, { exact: true })).toBeVisible();
    }

    // Non-manager groups should be filtered out
    const nonManagerCodes = [
      'FULL_ACCESS',
      'FINANCE_CLERK',
      'SALES_STAFF',
      'PURCHASE_CLERK',
      'WAREHOUSE_STAFF',
      'HR_VIEWER',
      'REPORT_VIEWER',
      'READ_ONLY',
    ];
    for (const code of nonManagerCodes) {
      await expect(page.getByText(code, { exact: true })).not.toBeVisible();
    }

    // Visual Checkpoint 2: Search filtered to "manager"
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-search-manager-filtered.png`,
      fullPage: true,
    });

    // --- Step 7: Clear search — all groups visible again ---
    await searchInput.clear();

    // Wait for filter to clear
    await page.waitForTimeout(500);

    // Verify all 12 groups are visible again
    for (const code of expectedCodes) {
      await expect(page.getByText(code, { exact: true })).toBeVisible();
    }
  });
});
