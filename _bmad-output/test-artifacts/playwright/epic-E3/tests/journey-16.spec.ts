import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E3/journey-16';

test.describe('Journey 16: Filter Dead Letter Queue by Event Name', () => {
  test('Admin filters DLQ entries by event name', async ({ page }) => {
    // Step 1: Navigate to /login
    await page.goto('/login');

    // Verify login form is present
    const emailInput = page.getByLabel(/email/i);
    const passwordInput = page.getByLabel(/password/i);
    const signInButton = page.getByRole('button', { name: /sign in/i });

    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await expect(passwordInput).toBeVisible();
    await expect(signInButton).toBeVisible();

    // Visual Checkpoint 1: Login page loaded
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-1-login-page.png` });

    // Step 2: Fill login form with admin credentials
    await emailInput.fill('admin@nexa-test.co.uk');
    await passwordInput.fill('Admin123!');

    // Step 3: Click Sign In
    await signInButton.click();

    // Wait for navigation away from login page
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 15000,
    });

    // Visual Checkpoint 2: Dashboard after login
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-3-dashboard-after-login.png` });

    // Verify sidebar/navigation is visible
    await expect(page.locator('nav, [role="navigation"], aside')).toBeVisible();

    // Step 4: Navigate to Dead Letter Queue page
    await page.goto('/system/dead-letter-queue');
    await page.waitForLoadState('networkidle');

    // Visual Checkpoint 3: DLQ page loaded (unfiltered)
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-4-dlq-page-loaded.png` });

    // Verify DLQ page loaded
    const dlqHeading = page.getByRole('heading', { name: /dead.?letter/i });
    const dlqPageIndicator = page.getByText(/dead.?letter/i).first();
    await expect(dlqHeading.or(dlqPageIndicator)).toBeVisible({ timeout: 10000 });

    // Step 5: Fill Event Name filter with "accessGroup.created"
    const eventNameFilter = page.getByLabel(/event.?name/i)
      .or(page.getByPlaceholder(/event.?name/i))
      .or(page.locator('[data-testid="filter-event-name"]'))
      .or(page.locator('input[name="eventName"]'));

    await expect(eventNameFilter.first()).toBeVisible({ timeout: 5000 });
    await eventNameFilter.first().fill('accessGroup.created');

    // Step 6: Click Apply Filters button
    const applyButton = page.getByRole('button', { name: /apply|filter|search/i })
      .or(page.locator('[data-testid="apply-filters"]'))
      .or(page.getByRole('button', { name: /apply filters/i }));

    await applyButton.first().click();

    // Wait for table to refresh
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Visual Checkpoint 4: Filtered results by event name
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-6-filtered-by-event-name.png` });

    // Verify filtered results: either matching entries are shown or empty state
    const dlqTable = page.locator('table, [role="table"], [data-testid*="dlq"], [data-testid*="dead-letter"]');
    const emptyState = page.getByText(/no.*entries/i)
      .or(page.getByText(/no.*results/i))
      .or(page.getByText(/no.*events/i))
      .or(page.getByText(/empty/i));

    const tableVisible = await dlqTable.first().isVisible().catch(() => false);
    const emptyVisible = await emptyState.first().isVisible().catch(() => false);

    // Either filtered table rows or empty state should be visible
    expect(tableVisible || emptyVisible).toBe(true);

    // If table is visible with rows, verify all visible event names match the filter
    if (tableVisible) {
      const rows = page.locator('table tbody tr, [role="row"]');
      const rowCount = await rows.count().catch(() => 0);

      if (rowCount > 0) {
        // Check that each visible row contains the filtered event name
        for (let i = 0; i < rowCount; i++) {
          const rowText = await rows.nth(i).textContent().catch(() => '');
          if (rowText && rowText.trim().length > 0) {
            expect(rowText.toLowerCase()).toContain('accessgroup.created');
          }
        }
      }
    }
  });
});
