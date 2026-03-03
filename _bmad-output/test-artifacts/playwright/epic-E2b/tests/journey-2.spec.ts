import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E2b/journey-2';

test.describe('Journey 2: View System Resource Registry', () => {
  // Pre-condition: login as admin before the journey starts
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@nexa-test.co.uk');
    await page.getByLabel('Password').fill('Admin123!');
    await page.getByRole('button', { name: 'Sign In' }).click();
    // Wait for dashboard to load after login
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
  });

  test('Admin views Resource Registry with filters and search', async ({ page }) => {
    // --- Step 1: Click Resource Registry sidebar link ---
    await page.getByRole('link', { name: 'Resource Registry' }).click();
    await expect(page).toHaveURL(/\/system\/resources/);

    // --- Step 2: Verify Resource Registry page title ---
    await expect(
      page.getByRole('heading', { name: 'Resource Registry' })
    ).toBeVisible();

    // Visual Checkpoint 1: Resource Registry page loaded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-resource-registry-page.png`,
      fullPage: true,
    });

    // Verify read-only page: no [+ New] button
    await expect(
      page.getByRole('button', { name: /new/i })
    ).not.toBeVisible();

    // --- Step 3: Verify table contains at least 6 rows ---
    const tableRows = page.locator('table tbody tr');
    await expect(tableRows).toHaveCount(6, { timeout: 10000 });

    // --- Step 4: Verify all 6 seeded resource codes are visible ---
    const expectedCodes = [
      'system.users.list',
      'system.users.detail',
      'system.company-profile.detail',
      'system.resources.list',
      'system.access-groups.list',
      'system.access-groups.detail',
    ];

    for (const code of expectedCodes) {
      await expect(page.getByText(code)).toBeVisible();
    }

    // --- Step 5: Filter by module "system" ---
    // Look for a module filter dropdown/select
    const moduleFilter = page.getByRole('combobox', { name: /module/i }).or(
      page.getByLabel(/module/i)
    );
    await moduleFilter.click();
    await page.getByRole('option', { name: /system/i }).click();

    // Verify table still shows system resources
    for (const code of expectedCodes) {
      await expect(page.getByText(code)).toBeVisible();
    }

    // Visual Checkpoint 2: Module filter applied
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-module-filter-system.png`,
      fullPage: true,
    });

    // --- Step 6: Filter by type "PAGE" ---
    const typeFilter = page.getByRole('combobox', { name: /type/i }).or(
      page.getByLabel(/type/i)
    );
    await typeFilter.click();
    await page.getByRole('option', { name: /page/i }).click();

    // --- Step 7: Search for "access" ---
    const searchInput = page.getByPlaceholder(/search/i).or(
      page.getByRole('searchbox')
    );
    await searchInput.fill('access');

    // Wait for filter to take effect
    await page.waitForTimeout(500);

    // Verify filtered results show only access-group resources
    await expect(page.getByText('system.access-groups.list')).toBeVisible();
    await expect(page.getByText('system.access-groups.detail')).toBeVisible();

    // The non-access resources should be filtered out
    await expect(page.getByText('system.users.list')).not.toBeVisible();
    await expect(page.getByText('system.company-profile.detail')).not.toBeVisible();

    // Visual Checkpoint 3: Search filter for "access"
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-7-search-access.png`,
      fullPage: true,
    });
  });
});
