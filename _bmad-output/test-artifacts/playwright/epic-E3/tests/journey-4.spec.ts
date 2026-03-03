import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E3/journey-4';

const ADMIN_EMAIL = 'admin@nexa-test.co.uk';
const ADMIN_PASSWORD = 'Admin123!';

test.describe('Journey 4: Filter Audit Log by Entity Type', () => {
  test('j04 — Apply entityType filter to show only User records', async ({ page }) => {
    // Step 1: Navigate to login page
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /sign in|log in|login/i })).toBeVisible();
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-login-page.png`,
    });

    // Step 2: Fill login form
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);

    // Step 3: Click Sign In — expect redirect to dashboard
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/dashboard**', { timeout: 10000 }).catch(() => {
      // Some apps redirect to / or /home instead of /dashboard
    });
    // Wait for the page to stabilize after login
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-dashboard-after-login.png`,
    });

    // Step 4: Navigate to audit log page
    await page.goto('/system/audit-log');
    await page.waitForLoadState('networkidle');
    // Verify we're on the audit log page
    await expect(
      page.getByRole('heading', { name: /audit log/i }).or(page.locator('text=Audit Log'))
    ).toBeVisible();
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-audit-log-default.png`,
    });

    // Step 5: Set Entity Type filter to "User"
    // Try multiple common patterns: dropdown/select, combobox, or text input
    const entityTypeFilter = page
      .getByLabel(/entity type/i)
      .or(page.getByRole('combobox', { name: /entity type/i }))
      .or(page.locator('[name="entityType"]'))
      .or(page.locator('[data-testid="entity-type-filter"]'));

    await entityTypeFilter.first().click();

    // If it's a dropdown/select, pick the "User" option
    const userOption = page
      .getByRole('option', { name: /^User$/i })
      .or(page.getByRole('menuitem', { name: /^User$/i }))
      .or(page.locator('[data-value="User"]'));

    const isDropdown = await userOption.first().isVisible().catch(() => false);
    if (isDropdown) {
      await userOption.first().click();
    } else {
      // It might be a text input — type the value
      await entityTypeFilter.first().fill('User');
    }

    // Step 6: Click Apply Filters
    await page
      .getByRole('button', { name: /apply|filter|search/i })
      .first()
      .click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-filtered-entity-type-user.png`,
    });

    // Step 7: Verify every visible row in the Entity Type column shows "User"
    // Wait for the table to update
    await page.waitForTimeout(1000);

    // Find all rows in the audit log table
    const tableRows = page.locator('table tbody tr').or(page.locator('[role="row"]'));
    const rowCount = await tableRows.count();

    // There should be at least 1 result (the admin login generates a User audit record)
    expect(rowCount).toBeGreaterThan(0);

    // Check each row's Entity Type cell contains "User"
    for (let i = 0; i < rowCount; i++) {
      const row = tableRows.nth(i);
      // Entity Type is typically the 2nd column (after Timestamp)
      const entityTypeCell = row
        .locator('td:nth-child(2)')
        .or(row.locator('[data-column="entityType"]'))
        .or(row.locator(':text("User")'));
      await expect(entityTypeCell.first()).toContainText('User');
    }

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-7-verify-all-rows-user.png`,
    });
  });
});
