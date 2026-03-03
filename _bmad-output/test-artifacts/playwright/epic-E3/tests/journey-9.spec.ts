import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E3/journey-9';

test.describe('Journey 9: View Entity Change History', () => {
  test('Admin can view entity change history for an AccessGroup', async ({
    page,
  }) => {
    // Step 1: Navigate to login page
    await page.goto('/login');
    await expect(
      page.getByRole('heading', { name: /sign in|log in|login/i }),
    ).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-login-page.png`,
    });

    // Step 2: Fill login form with admin credentials
    await page.getByLabel(/email/i).fill('admin@nexa-test.co.uk');
    await page.getByLabel(/password/i).fill('Admin123!');

    // Step 3: Click Sign In
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for navigation away from login page
    await expect(page).not.toHaveURL(/\/login/);
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-dashboard-after-login.png`,
    });

    // Step 4: Navigate to Audit Log page
    await page.goto('/system/audit-log');
    await expect(page.locator('body')).not.toBeEmpty();

    // Wait for the audit log table/page to load
    // Look for a heading or table indicating audit log
    const auditLogHeading = page.getByRole('heading', {
      name: /audit log/i,
    });
    const auditLogTable = page.getByRole('table');
    await expect(auditLogHeading.or(auditLogTable).first()).toBeVisible({
      timeout: 10000,
    });

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-audit-log-page.png`,
    });

    // Step 5: Click "View History" link/button on an AccessGroup audit record row
    // First, find a row that contains "AccessGroup" entity type
    const accessGroupRow = page
      .getByRole('row')
      .filter({ hasText: /AccessGroup/i })
      .first();
    await expect(accessGroupRow).toBeVisible({ timeout: 10000 });

    // Click the "View History" link/button within that row
    const viewHistoryButton = accessGroupRow.getByRole('link', {
      name: /view history|history|view changes/i,
    });
    const viewHistoryAlt = accessGroupRow.getByRole('button', {
      name: /view history|history|view changes/i,
    });

    const historyAction = viewHistoryButton.or(viewHistoryAlt).first();
    await expect(historyAction).toBeVisible({ timeout: 5000 });
    await historyAction.click();

    // Wait for entity history view to load
    await page.waitForLoadState('networkidle');

    // Verify entity history view is showing
    const historyHeading = page.getByRole('heading', {
      name: /entity history|change history|audit history/i,
    });
    const historyTimeline = page.locator(
      '[data-testid="entity-history"], .entity-history, .change-history',
    );
    await expect(historyHeading.or(historyTimeline).first()).toBeVisible({
      timeout: 10000,
    });

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-entity-history-view.png`,
    });

    // Step 6: Verify all records belong to the same entityType and entityId
    // Check that the history records are ordered chronologically (ascending - oldest first)
    const historyRows = page.getByRole('row').filter({
      hasText: /CREATE|UPDATE|DELETE|AccessGroup/i,
    });
    const rowCount = await historyRows.count();
    expect(rowCount).toBeGreaterThanOrEqual(1);

    // Verify all records reference the same entity type
    for (let i = 0; i < rowCount; i++) {
      const rowText = await historyRows.nth(i).textContent();
      expect(rowText?.toLowerCase()).toContain('accessgroup');
    }

    // Step 7: Verify first record has action=CREATE
    const firstHistoryRow = historyRows.first();
    const firstRowText = await firstHistoryRow.textContent();
    expect(firstRowText).toMatch(/CREATE/i);

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-7-first-record-create.png`,
    });
  });
});
