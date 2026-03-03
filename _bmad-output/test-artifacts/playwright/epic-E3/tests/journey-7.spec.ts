import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E3/journey-7';

const ADMIN_EMAIL = 'admin@nexa-test.co.uk';
const ADMIN_PASSWORD = 'Admin123!';

test.describe('Journey 7: Filter Audit Log by User ID', () => {
  test('j07 — Apply userId filter to show only records for the admin user', async ({
    page,
  }) => {
    // Step 1: Navigate to login page
    await page.goto('/login');
    await expect(
      page.getByRole('heading', { name: /sign in|log in|login/i })
    ).toBeVisible();

    // Step 2: Fill login form with admin credentials
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);

    // Step 3: Click Sign In — expect redirect to dashboard
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/dashboard**', { timeout: 10000 }).catch(() => {
      // Some apps redirect to / or /home instead of /dashboard
    });
    await page.waitForLoadState('networkidle');

    // Checkpoint 1: Dashboard after login
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-dashboard-after-login.png`,
    });

    // Capture admin user ID from the login response or page context
    // The user ID is typically available in local storage, a cookie, or the app state
    let adminUserId: string | null = null;

    // Try to extract user ID from localStorage (common pattern for SPAs)
    adminUserId = await page
      .evaluate(() => {
        // Check localStorage for user data
        const userData = localStorage.getItem('user');
        if (userData) {
          try {
            return JSON.parse(userData)?.id || null;
          } catch {
            return null;
          }
        }
        // Check for token payload
        const token = localStorage.getItem('accessToken');
        if (token) {
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.sub || payload.userId || null;
          } catch {
            return null;
          }
        }
        return null;
      })
      .catch(() => null);

    // Step 4: Navigate to audit log page
    await page.goto('/system/audit-log');
    await page.waitForLoadState('networkidle');
    await expect(
      page
        .getByRole('heading', { name: /audit log/i })
        .or(page.locator('text=Audit Log'))
    ).toBeVisible();

    // Checkpoint 2: Audit Log page loaded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-audit-log-page-loaded.png`,
    });

    // If we couldn't get the user ID from localStorage, try to extract it from the audit log table
    // by looking at the User column of an existing row that matches the admin email
    if (!adminUserId) {
      // Look in the first few rows for a user ID we can use for filtering
      // Try extracting from the table data or a user cell that contains the admin info
      const firstUserCell = page
        .locator('table tbody tr:first-child td')
        .filter({ hasText: /admin/i })
        .or(
          page
            .locator('[role="row"]')
            .first()
            .locator('[data-column="userId"]')
        );

      const userCellText = await firstUserCell.first().textContent().catch(() => null);
      // UUID pattern: 8-4-4-4-12
      const uuidMatch = userCellText?.match(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
      );
      if (uuidMatch) {
        adminUserId = uuidMatch[0];
      }
    }

    // Step 5: Fill User filter
    // The user filter could be a text input for userId, a combobox/dropdown to select user, or a search field
    const userFilter = page
      .getByLabel(/user/i)
      .or(page.locator('[name="userId"]'))
      .or(page.locator('[data-testid="filter-user"]'))
      .or(page.locator('[data-testid="filter-userId"]'))
      .or(page.locator('[placeholder*="user" i]'));

    const userFilterElement = userFilter.first();
    await expect(userFilterElement).toBeVisible({ timeout: 5000 });

    // Determine the filter type and fill accordingly
    const tagName = await userFilterElement.evaluate((el) =>
      el.tagName.toLowerCase()
    );
    const inputType = await userFilterElement
      .getAttribute('type')
      .catch(() => null);
    const role = await userFilterElement
      .getAttribute('role')
      .catch(() => null);

    if (role === 'combobox' || tagName === 'select') {
      // It's a dropdown/combobox — try to select the admin user by visible text
      if (tagName === 'select') {
        // Native select — look for option with admin text
        await userFilterElement.selectOption({ label: /admin/i });
      } else {
        // Combobox — type to search and select
        await userFilterElement.fill('admin');
        await page.waitForTimeout(500);
        // Click the matching option
        await page
          .getByRole('option', { name: /admin/i })
          .or(page.locator('[role="listbox"] [role="option"]').filter({ hasText: /admin/i }))
          .first()
          .click();
      }
    } else {
      // Text input — fill with the admin user ID if we have it, otherwise try the email
      if (adminUserId) {
        await userFilterElement.fill(adminUserId);
      } else {
        // Fallback: try the admin email as identifier
        await userFilterElement.fill(ADMIN_EMAIL);
      }
    }

    // Step 6: Click Apply Filters
    await page
      .getByRole('button', { name: /apply|filter|search/i })
      .first()
      .click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Checkpoint 3: Filtered results by User ID
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-filtered-by-user-id.png`,
    });

    // Verify: all visible rows show the admin user
    const tableRows = page
      .locator('table tbody tr')
      .or(page.locator('[role="row"]'));
    const rowCount = await tableRows.count();

    // There should be at least 1 result — we just logged in, generating an audit record for this user
    expect(rowCount).toBeGreaterThan(0);

    // Check each row's User column contains the admin user identifier
    for (let i = 0; i < rowCount; i++) {
      const row = tableRows.nth(i);
      const rowText = await row.textContent();

      // The row should reference the admin user — either by userId, name, or email
      // At minimum, all rows should have the same user indicator
      if (adminUserId) {
        // If we know the UUID, check it appears in the row or the user cell matches
        const userCell = row
          .locator('[data-column="userId"]')
          .or(row.locator('[data-column="user"]'))
          .or(row.locator('td').nth(4)) // User is typically the 5th column
          .first();

        const cellText = await userCell.textContent().catch(() => rowText);
        // The cell should contain admin user info (ID, name, or email)
        expect(
          cellText?.toLowerCase().includes('admin') ||
            cellText?.includes(adminUserId) ||
            cellText?.toLowerCase().includes(ADMIN_EMAIL),
          `Row ${i} should show admin user, got: "${cellText}"`
        ).toBeTruthy();
      }
    }

    // Verify first row's user matches the last row's user (all same user)
    if (rowCount >= 2) {
      const firstRowUser = await tableRows
        .first()
        .locator('td')
        .nth(4)
        .textContent()
        .catch(() => '');
      const lastRowUser = await tableRows
        .last()
        .locator('td')
        .nth(4)
        .textContent()
        .catch(() => '');

      if (firstRowUser && lastRowUser) {
        expect(
          firstRowUser.trim(),
          'All rows should show the same user'
        ).toBe(lastRowUser.trim());
      }
    }
  });
});
