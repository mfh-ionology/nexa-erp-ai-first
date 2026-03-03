import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E3/journey-15';

test.describe('Journey 15: View Dead Letter Queue Entry Details', () => {
  test('Admin views DLQ entry details with all required fields', async ({ page }) => {
    // Step 1: Navigate to login page
    await page.goto('/login');

    // Visual Checkpoint 1: Login page loaded
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-1-login-page.png` });

    // Verify login form is present
    const emailInput = page.getByLabel(/email/i);
    const passwordInput = page.getByLabel(/password/i);
    const signInButton = page.getByRole('button', { name: /sign in/i });

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(signInButton).toBeVisible();

    // Step 2: Fill login form
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

    // Verify we're on the dashboard (sidebar should be visible)
    await expect(page.locator('nav, [role="navigation"], aside')).toBeVisible();

    // Step 4: Navigate to Dead Letter Queue page
    await page.goto('/system/dead-letter-queue');

    // Wait for page to settle
    await page.waitForLoadState('networkidle');

    // Visual Checkpoint 3: DLQ page loaded
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-4-dlq-page-loaded.png` });

    // Verify DLQ page loaded — look for a table or list of DLQ entries
    const dlqTable = page.locator('table, [role="table"], [data-testid*="dlq"], [data-testid*="dead-letter"]');
    const dlqHeading = page.getByRole('heading', { name: /dead.?letter/i });
    const dlqPageIndicator = page.getByText(/dead.?letter/i).first();

    // At least one indicator that we're on the DLQ page
    await expect(
      dlqHeading.or(dlqPageIndicator).or(dlqTable)
    ).toBeVisible({ timeout: 10000 });

    // Step 5: Click first DLQ entry row to view details
    // Try multiple approaches to find and click a DLQ entry row
    const firstRow = page.locator('table tbody tr, [role="row"]').first();
    const clickableEntry = page.locator(
      '[data-testid*="dlq-entry"], [data-testid*="dead-letter-entry"]'
    ).first();
    const viewDetailButton = page.getByRole('button', { name: /view|detail|expand/i }).first();
    const viewLink = page.getByRole('link', { name: /view|detail/i }).first();

    // Try clicking the most specific element first, fall back to others
    if (await viewDetailButton.isVisible().catch(() => false)) {
      await viewDetailButton.click();
    } else if (await viewLink.isVisible().catch(() => false)) {
      await viewLink.click();
    } else if (await clickableEntry.isVisible().catch(() => false)) {
      await clickableEntry.click();
    } else {
      // Fall back to clicking the first table row
      await expect(firstRow).toBeVisible({ timeout: 5000 });
      await firstRow.click();
    }

    // Wait for detail view to appear
    await page.waitForTimeout(1000);

    // Visual Checkpoint 4: DLQ Entry Detail View (KEY CHECKPOINT)
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-5-dlq-entry-detail.png` });

    // Step 6: Verify all required fields are present in detail view
    // The detail view should contain these fields: eventName, payload, error, retryCount, originalTimestamp, reprocessed
    const detailContainer = page.locator(
      '[data-testid*="detail"], [role="dialog"], [class*="detail"], [class*="panel"], main'
    );

    // Check for eventName field
    const eventNameField = page.getByText(/event.?name/i).first();
    await expect(eventNameField).toBeVisible({ timeout: 5000 });

    // Check for payload field
    const payloadField = page.getByText(/payload/i).first();
    await expect(payloadField).toBeVisible();

    // Check for error field
    const errorField = page.getByText(/error/i).first();
    await expect(errorField).toBeVisible();

    // Check for retryCount field
    const retryCountField = page.getByText(/retry.?count/i).first();
    await expect(retryCountField).toBeVisible();

    // Check for originalTimestamp field
    const timestampField = page.getByText(/original.?timestamp|timestamp/i).first();
    await expect(timestampField).toBeVisible();

    // Check for reprocessed status field
    const reprocessedField = page.getByText(/reprocess/i).first();
    await expect(reprocessedField).toBeVisible();

    // Visual Checkpoint 5: After field verification
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-6-fields-verified.png` });
  });
});
