import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E3/journey-21';

test.describe('Journey 21: Dead Letter Queue Rejects Users Without Permission', () => {
  test('Sales user without system.dead-letter-queue.list permission gets 403 Forbidden', async ({
    page,
  }) => {
    // Step 1: Navigate to login page
    await page.goto('/login');
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-login-page.png`,
    });

    // Step 2: Fill login form with sales user credentials (no DLQ permission)
    await page.getByRole('textbox', { name: /email/i }).fill('sales@nexa-test.co.uk');
    await page.locator('input[type="password"]').fill('Sales123!');

    // Step 3: Click Sign In button
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for navigation away from login page (dashboard loads)
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 15000,
    });
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-sales-user-dashboard.png`,
    });

    // Step 4: Navigate directly to /system/dead-letter-queue
    // Sales user does NOT have system.dead-letter-queue.list permission
    await page.goto('/system/dead-letter-queue');

    // Wait for the page to settle
    await page.waitForLoadState('networkidle');

    // Take screenshot of the forbidden/access denied state
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-dlq-forbidden-403.png`,
    });

    // Verify access is denied: look for forbidden/unauthorized indicators
    // The app may redirect to login, show an error page, show a toast, or show inline error
    const forbiddenIndicators = [
      page.getByText(/forbidden/i),
      page.getByText(/403/i),
      page.getByText(/do not have permission/i),
      page.getByText(/access denied/i),
      page.getByText(/not authorized/i),
      page.getByText(/unauthorized/i),
    ];

    // Check if we were redirected back to login (also a valid 401/403 response)
    const redirectedToLogin = page.url().includes('/login');

    // Check if any forbidden indicator is visible
    let forbiddenFound = redirectedToLogin;
    for (const indicator of forbiddenIndicators) {
      try {
        const isVisible = await indicator.isVisible();
        if (isVisible) {
          forbiddenFound = true;
          break;
        }
      } catch {
        // Locator may not exist, continue
      }
    }

    expect(forbiddenFound).toBe(true);

    // Verify DLQ data is NOT displayed - the data table should not be visible
    const dlqTable = page.getByRole('table');
    const dlqTableVisible = await dlqTable.isVisible().catch(() => false);

    // If a table IS visible, verify it's not showing DLQ data
    if (dlqTableVisible) {
      // The table should not contain DLQ-specific columns
      const hasEventNameColumn = await page
        .getByText(/event name/i)
        .isVisible()
        .catch(() => false);
      const hasRetryCountColumn = await page
        .getByText(/retry count/i)
        .isVisible()
        .catch(() => false);
      expect(hasEventNameColumn && hasRetryCountColumn).toBe(false);
    }
  });
});
