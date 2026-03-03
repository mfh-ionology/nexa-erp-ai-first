import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E3/journey-13';

test.describe('Journey 13: Audit Log Rejects Users Without Permission', () => {
  test('sales user without system.audit-log.list permission is denied access to audit log', async ({
    page,
  }) => {
    // Step 1: Navigate to login page
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Verify login page is displayed
    const emailInput = page
      .getByLabel(/email/i)
      .or(page.getByPlaceholder(/email/i))
      .or(page.locator('input[type="email"]'));
    const passwordInput = page
      .getByLabel(/password/i)
      .or(page.getByPlaceholder(/password/i))
      .or(page.locator('input[type="password"]'));

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    // Step 2: Fill login form with sales user credentials (no audit-log permission)
    await emailInput.fill('sales@nexa-test.co.uk');
    await passwordInput.fill('Sales123!');

    // Step 3: Click Sign In button
    const signInButton = page
      .getByRole('button', { name: /sign in/i })
      .or(page.getByRole('button', { name: /log in/i }))
      .or(page.getByRole('button', { name: /login/i }));

    await signInButton.click();

    // Wait for login to complete and redirect to dashboard
    await page.waitForLoadState('networkidle');

    // Wait for dashboard to load (should no longer be on /login)
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 15000,
    });

    // Visual checkpoint 1: Sales user on dashboard
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-sales-user-dashboard.png`,
      fullPage: true,
    });

    // Verify we're logged in (not still on login page)
    const currentUrlAfterLogin = page.url();
    expect(currentUrlAfterLogin).not.toContain('/login');

    // Step 4: Navigate directly to /system/audit-log
    await page.goto('/system/audit-log');
    await page.waitForLoadState('networkidle');

    // Give the page a moment to render the error/redirect
    await page.waitForTimeout(2000);

    // Visual checkpoint 2: Access denied / 403 Forbidden
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-audit-log-forbidden.png`,
      fullPage: true,
    });

    // Verify: User should see a 403 Forbidden error, redirect to an error page,
    // or the audit log data should NOT be accessible
    const pageContent = await page.textContent('body');
    const currentUrl = page.url();

    // Check for 403/Forbidden indicators
    const showsForbidden =
      pageContent?.toLowerCase().includes('forbidden') ||
      pageContent?.toLowerCase().includes('403') ||
      pageContent?.toLowerCase().includes('not have permission') ||
      pageContent?.toLowerCase().includes('access denied') ||
      pageContent?.toLowerCase().includes('not authorized') ||
      pageContent?.toLowerCase().includes('unauthorized');

    // Check if redirected away from audit-log page (e.g., to dashboard or error page)
    const redirectedAway = !currentUrl.includes('/system/audit-log');

    // One of these must be true: forbidden error shown OR redirected away
    expect(
      showsForbidden || redirectedAway,
      `Expected 403 Forbidden error or redirect, but got URL: ${currentUrl} with content containing neither forbidden/403/permission messages`,
    ).toBeTruthy();

    // Verify audit log data is NOT visible to this user
    // The audit log table with its characteristic columns should not render
    const hasAuditLogData =
      pageContent?.includes('Entity Type') &&
      pageContent?.includes('Entity ID') &&
      pageContent?.includes('Action') &&
      pageContent?.includes('Timestamp');

    expect(
      hasAuditLogData,
      'Audit log data table should NOT be visible to a user without system.audit-log.list permission',
    ).toBeFalsy();

    // Additional check: if the sidebar is visible, the Audit Log link should
    // ideally not be shown for this user (permission-filtered navigation)
    const sidebarAuditLink = page.getByRole('link', { name: /audit log/i });
    const auditLinkVisible = await sidebarAuditLink
      .isVisible()
      .catch(() => false);

    // Note: Even if the link is visible in the sidebar, the page itself must
    // deny access. We check but don't fail on this — it's a UX improvement.
    if (auditLinkVisible) {
      // Sidebar shows audit log link but page should still deny access
      // This is acceptable but worth noting — ideally the sidebar would hide it
      console.log(
        'NOTE: Audit Log link visible in sidebar for user without permission — consider hiding it',
      );
    }
  });
});
