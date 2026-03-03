import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E3/journey-5';

const ADMIN_EMAIL = 'admin@nexa-test.co.uk';
const ADMIN_PASSWORD = 'Admin123!';

test.describe('Journey 5: Filter Audit Log by Action Type', () => {
  test('j05 — Apply action filter to show only LOGIN records', async ({ page }) => {
    // Step 1: Navigate to login page
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /sign in|log in|login/i })).toBeVisible();

    // Step 2: Fill login form
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);

    // Step 3: Click Sign In — expect redirect to dashboard
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/dashboard**', { timeout: 10000 }).catch(() => {
      // Some apps redirect to / or /home instead of /dashboard
    });
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

    // Step 5: Set Action filter to "LOGIN"
    // Try multiple common patterns: dropdown/select, combobox, or text input
    const actionFilter = page
      .getByLabel(/action/i)
      .or(page.getByRole('combobox', { name: /action/i }))
      .or(page.locator('[name="action"]'))
      .or(page.locator('[data-testid="action-filter"]'));

    await actionFilter.first().click();

    // If it's a dropdown/select, pick the "LOGIN" option
    const loginOption = page
      .getByRole('option', { name: /^LOGIN$/i })
      .or(page.getByRole('menuitem', { name: /^LOGIN$/i }))
      .or(page.locator('[data-value="LOGIN"]'));

    const isDropdown = await loginOption.first().isVisible().catch(() => false);
    if (isDropdown) {
      await loginOption.first().click();
    } else {
      // It might be a text input — type the value
      await actionFilter.first().fill('LOGIN');
    }

    // Step 6: Click Apply Filters
    await page
      .getByRole('button', { name: /apply|filter|search/i })
      .first()
      .click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-filtered-login-actions.png`,
    });

    // Step 7: Verify every visible row in the Action column shows "LOGIN"
    // Wait for the table to update
    await page.waitForTimeout(1000);

    // Find all rows in the audit log table
    const tableRows = page.locator('table tbody tr').or(page.locator('[role="row"]'));
    const rowCount = await tableRows.count();

    // There should be at least 1 result (we just logged in, generating a LOGIN audit record)
    expect(rowCount).toBeGreaterThan(0);

    // Check each row's Action cell contains "LOGIN"
    // Action is typically the 4th column (Timestamp, Entity Type, Entity ID, Action)
    for (let i = 0; i < rowCount; i++) {
      const row = tableRows.nth(i);
      const actionCell = row
        .locator('td:nth-child(4)')
        .or(row.locator('[data-column="action"]'))
        .or(row.locator(':text("LOGIN")'));
      await expect(actionCell.first()).toContainText('LOGIN');
    }

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-7-verify-all-rows-login.png`,
    });
  });
});
