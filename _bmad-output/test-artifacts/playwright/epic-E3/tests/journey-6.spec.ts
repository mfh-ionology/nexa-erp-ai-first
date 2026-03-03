import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E3/journey-6';

const ADMIN_EMAIL = 'admin@nexa-test.co.uk';
const ADMIN_PASSWORD = 'Admin123!';

test.describe('Journey 6: Filter Audit Log by Date Range', () => {
  test('j06 — Apply dateFrom and dateTo filters to narrow audit records to today', async ({
    page,
  }) => {
    // Step 1: Navigate to login page
    await page.goto('/login');
    await expect(
      page.getByRole('heading', { name: /sign in|log in|login/i })
    ).toBeVisible();

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
    await expect(
      page
        .getByRole('heading', { name: /audit log/i })
        .or(page.locator('text=Audit Log'))
    ).toBeVisible();
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-audit-log-page-loaded.png`,
    });

    // Step 5: Fill date range filters with today's date
    // Try dateFrom / "from" / "start date" label patterns
    const dateFromFilter = page
      .getByLabel(/date\s*from|from\s*date|start\s*date|from/i)
      .or(page.locator('[name="dateFrom"]'))
      .or(page.locator('[data-testid="date-from-filter"]'))
      .or(page.locator('input[type="date"]').first())
      .or(page.locator('input[type="datetime-local"]').first());

    const dateToFilter = page
      .getByLabel(/date\s*to|to\s*date|end\s*date|to/i)
      .or(page.locator('[name="dateTo"]'))
      .or(page.locator('[data-testid="date-to-filter"]'))
      .or(page.locator('input[type="date"]').last())
      .or(page.locator('input[type="datetime-local"]').last());

    // Fill with today's date — format depends on whether input is date or datetime-local
    const dateFromInput = dateFromFilter.first();
    const dateToInput = dateToFilter.first();

    const dateFromType = await dateFromInput.getAttribute('type').catch(() => 'text');

    if (dateFromType === 'date') {
      await dateFromInput.fill('2026-02-21');
      await dateToInput.fill('2026-02-21');
    } else if (dateFromType === 'datetime-local') {
      await dateFromInput.fill('2026-02-21T00:00');
      await dateToInput.fill('2026-02-21T23:59');
    } else {
      // Text input — try ISO format
      await dateFromInput.fill('2026-02-21');
      await dateToInput.fill('2026-02-21');
    }

    // Step 6: Click Apply Filters
    await page
      .getByRole('button', { name: /apply|filter|search/i })
      .first()
      .click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-filtered-by-date-range.png`,
    });

    // Step 7: Verify all visible row timestamps are within the date range
    await page.waitForTimeout(1000);

    const tableRows = page.locator('table tbody tr').or(page.locator('[role="row"]'));
    const rowCount = await tableRows.count();

    // There should be at least 1 result — we just logged in, generating an audit record today
    expect(rowCount).toBeGreaterThan(0);

    // Check each row's Timestamp cell contains today's date (2026-02-21)
    // Timestamp is typically the 1st column
    for (let i = 0; i < rowCount; i++) {
      const row = tableRows.nth(i);
      const timestampCell = row
        .locator('td:nth-child(1)')
        .or(row.locator('[data-column="timestamp"]'))
        .or(row.locator('[data-column="createdAt"]'));

      const cellText = await timestampCell.first().textContent();
      // Verify the timestamp contains today's date in some recognisable format
      // Could be "2026-02-21", "21/02/2026", "Feb 21, 2026", "21 Feb 2026" etc.
      expect(
        cellText?.includes('2026-02-21') ||
          cellText?.includes('21/02/2026') ||
          cellText?.includes('Feb 21') ||
          cellText?.includes('21 Feb') ||
          cellText?.includes('02/21/2026'),
        `Row ${i} timestamp "${cellText}" should contain today's date (2026-02-21)`
      ).toBeTruthy();
    }

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-7-all-timestamps-in-range.png`,
    });
  });
});
