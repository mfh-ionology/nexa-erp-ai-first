import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E3/journey-12';

test.describe('Journey 12: Audit Log Rejects Unauthenticated Requests', () => {
  test('unauthenticated user is redirected to login or shown 401 when accessing audit log', async ({
    page,
  }) => {
    // Step 1: Navigate directly to /system/audit-log without logging in
    await page.goto('/system/audit-log');

    // Wait for the page to settle (redirect or error render)
    await page.waitForLoadState('networkidle');

    // Visual checkpoint: capture what the user sees
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-unauthenticated-audit-redirect.png`,
      fullPage: true,
    });

    // Verify: Either redirected to login page OR shown 401/unauthorized error
    const currentUrl = page.url();
    const pageContent = await page.textContent('body');

    // Check for redirect to login page
    const isOnLoginPage = currentUrl.includes('/login');

    // Check for 401/unauthorized error display on the page
    const shows401Error =
      pageContent?.toLowerCase().includes('unauthorized') ||
      pageContent?.toLowerCase().includes('401') ||
      pageContent?.includes('Sign In') ||
      pageContent?.includes('Log in');

    // One of these must be true
    expect(
      isOnLoginPage || shows401Error,
      `Expected redirect to login or 401 error, but got URL: ${currentUrl}`,
    ).toBeTruthy();

    // Verify audit log data is NOT visible
    // The audit log table should not be present
    const auditTable = page.getByRole('table');
    const auditTableVisible = await auditTable.isVisible().catch(() => false);

    // If a table IS visible, verify it's NOT the audit log table
    // (it could be a login form table or error page layout)
    if (auditTableVisible) {
      // Check that audit-specific content is not present
      const hasAuditColumns =
        pageContent?.includes('Entity Type') &&
        pageContent?.includes('Entity ID') &&
        pageContent?.includes('Action');
      expect(
        hasAuditColumns,
        'Audit log data table should not be visible to unauthenticated users',
      ).toBeFalsy();
    }

    // Additional check: if redirected to login, verify login form elements exist
    if (isOnLoginPage) {
      const emailInput =
        page.getByLabel(/email/i) ||
        page.getByPlaceholder(/email/i) ||
        page.locator('input[type="email"]');
      const passwordInput =
        page.getByLabel(/password/i) ||
        page.getByPlaceholder(/password/i) ||
        page.locator('input[type="password"]');

      await expect(
        emailInput.or(page.locator('input[type="email"]')),
      ).toBeVisible();
      await expect(
        passwordInput.or(page.locator('input[type="password"]')),
      ).toBeVisible();
    }
  });
});
