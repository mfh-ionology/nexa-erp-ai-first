import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E3/journey-8';

const ADMIN_EMAIL = 'admin@nexa-test.co.uk';
const ADMIN_PASSWORD = 'Admin123!';

test.describe('Journey 8: Apply Multiple Filters Simultaneously', () => {
  test('j08 — Apply entityType, action, and date range filters together', async ({ page }) => {
    // Step 1: Navigate to login page
    await page.goto('/login');
    await expect(
      page.getByRole('heading', { name: /sign in|log in|login/i })
    ).toBeVisible();
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
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-dashboard-loaded.png`,
    });

    // Step 4: Navigate to audit log page
    await page.goto('/system/audit-log');
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByRole('heading', { name: /audit log/i }).or(page.locator('text=Audit Log'))
    ).toBeVisible();
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-audit-log-default.png`,
    });

    // Step 5: Set all three filters: entityType=User, action=LOGIN, date range=today

    // 5a: Set Entity Type filter to "User"
    const entityTypeFilter = page
      .getByLabel(/entity\s*type/i)
      .or(page.getByRole('combobox', { name: /entity\s*type/i }))
      .or(page.locator('[name="entityType"]'))
      .or(page.locator('[data-testid="entityType-filter"]'));

    await entityTypeFilter.first().click();

    const userOption = page
      .getByRole('option', { name: /^User$/i })
      .or(page.getByRole('menuitem', { name: /^User$/i }))
      .or(page.locator('[data-value="User"]'));

    const isEntityDropdown = await userOption.first().isVisible().catch(() => false);
    if (isEntityDropdown) {
      await userOption.first().click();
    } else {
      await entityTypeFilter.first().fill('User');
    }

    // 5b: Set Action filter to "LOGIN"
    const actionFilter = page
      .getByLabel(/action/i)
      .or(page.getByRole('combobox', { name: /action/i }))
      .or(page.locator('[name="action"]'))
      .or(page.locator('[data-testid="action-filter"]'));

    await actionFilter.first().click();

    const loginOption = page
      .getByRole('option', { name: /^LOGIN$/i })
      .or(page.getByRole('menuitem', { name: /^LOGIN$/i }))
      .or(page.locator('[data-value="LOGIN"]'));

    const isActionDropdown = await loginOption.first().isVisible().catch(() => false);
    if (isActionDropdown) {
      await loginOption.first().click();
    } else {
      await actionFilter.first().fill('LOGIN');
    }

    // 5c: Set Date From filter to today's date start
    const dateFromFilter = page
      .getByLabel(/date\s*from|from\s*date|start\s*date/i)
      .or(page.locator('[name="dateFrom"]'))
      .or(page.locator('[data-testid="dateFrom-filter"]'))
      .or(page.locator('input[type="date"]').first());

    await dateFromFilter.first().fill('2026-02-21');

    // 5d: Set Date To filter to today's date end
    const dateToFilter = page
      .getByLabel(/date\s*to|to\s*date|end\s*date/i)
      .or(page.locator('[name="dateTo"]'))
      .or(page.locator('[data-testid="dateTo-filter"]'))
      .or(page.locator('input[type="date"]').last());

    await dateToFilter.first().fill('2026-02-21');

    // Step 6: Click Apply Filters
    await page
      .getByRole('button', { name: /apply|filter|search/i })
      .first()
      .click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-combined-filters-applied.png`,
    });

    // Verify the filtered results: every visible row should match ALL three criteria
    const tableRows = page.locator('table tbody tr').or(page.locator('[role="row"]'));
    const rowCount = await tableRows.count();

    // There should be at least 1 result (we just logged in as User with LOGIN action today)
    expect(rowCount).toBeGreaterThan(0);

    // Check each row matches the combined filter criteria
    for (let i = 0; i < rowCount; i++) {
      const row = tableRows.nth(i);

      // Entity Type column (typically 2nd column) should show "User"
      const entityTypeCell = row
        .locator('td:nth-child(2)')
        .or(row.locator('[data-column="entityType"]'));
      await expect(entityTypeCell.first()).toContainText('User');

      // Action column (typically 4th column) should show "LOGIN"
      const actionCell = row
        .locator('td:nth-child(4)')
        .or(row.locator('[data-column="action"]'));
      await expect(actionCell.first()).toContainText('LOGIN');

      // Timestamp column (typically 1st column) should be from today (2026-02-21)
      const timestampCell = row
        .locator('td:nth-child(1)')
        .or(row.locator('[data-column="timestamp"]'));
      const timestampText = await timestampCell.first().textContent();
      expect(timestampText).toContain('2026-02-21');
    }
  });
});
