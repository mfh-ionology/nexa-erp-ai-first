import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E2b/journey-12';

test.describe('Journey #12: Verify Permission Enforcement - Limited User Denied Access', () => {
  test('Sales staff user cannot see or access admin-only pages (Resource Registry, Access Groups)', async ({
    page,
  }) => {
    // ── Step 1: Navigate to /login ──
    await page.goto('/login');
    await expect(page.getByLabel('Email')).toBeVisible({ timeout: 10000 });

    // ── Step 2: Fill login form with sales user credentials ──
    await page.getByLabel('Email').fill('sales@nexa-test.co.uk');
    await page.getByLabel('Password').fill('Sales123!');

    // ── Step 3: Click Sign In button ──
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for dashboard to load after login
    await page.waitForURL('**/dashboard**', { timeout: 15000 });

    // Wait for sidebar to be fully rendered (permissions loaded via GET /system/my-permissions)
    const sidebar = page.locator('nav, [role="navigation"], aside, [data-testid="sidebar"]');
    await expect(sidebar.first()).toBeVisible({ timeout: 10000 });

    // Allow time for permission-driven sidebar to render
    await page.waitForTimeout(1000);

    // Visual Checkpoint 1: Dashboard with limited sidebar
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-sales-dashboard-limited-sidebar.png`,
      fullPage: true,
    });

    // ── Step 4: Verify sidebar does NOT contain Resource Registry or Access Groups ──
    // These links should be absent because SALES_STAFF group lacks canAccess on
    // system.resources.list and system.access-groups.list
    const sidebarContent = sidebar.first();

    await expect(
      sidebarContent.getByText('Resource Registry')
    ).toBeHidden({ timeout: 5000 });

    await expect(
      sidebarContent.getByText('Access Groups')
    ).toBeHidden({ timeout: 5000 });

    // ── Step 5: Navigate directly to /system/resources (should be denied) ──
    await page.goto('/system/resources');

    // Wait for the page to settle — expect access denied, 403, or redirect
    await page.waitForTimeout(2000);

    // Check for access denied indicators — the app may show an error page,
    // a toast, redirect to /unauthorized, or show 403 text
    const accessDeniedResources = page.getByText(/access denied/i)
      .or(page.getByText(/forbidden/i))
      .or(page.getByText(/not authorized/i))
      .or(page.getByText(/you do not have permission/i))
      .or(page.getByText(/403/i))
      .or(page.getByText(/unauthorized/i));

    // Also check if we were redirected away from /system/resources
    const currentUrl = page.url();
    const wasRedirected = !currentUrl.includes('/system/resources');
    const hasAccessDeniedMessage = await accessDeniedResources.first().isVisible().catch(() => false);

    // Either we see an access denied message OR we were redirected away
    expect(wasRedirected || hasAccessDeniedMessage).toBeTruthy();

    // Visual Checkpoint 2: Access denied for /system/resources
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-resources-access-denied.png`,
      fullPage: true,
    });

    // ── Step 6: Navigate directly to /system/access-groups (should be denied) ──
    await page.goto('/system/access-groups');

    // Wait for the page to settle
    await page.waitForTimeout(2000);

    // Check for access denied indicators
    const accessDeniedGroups = page.getByText(/access denied/i)
      .or(page.getByText(/forbidden/i))
      .or(page.getByText(/not authorized/i))
      .or(page.getByText(/you do not have permission/i))
      .or(page.getByText(/403/i))
      .or(page.getByText(/unauthorized/i));

    const currentUrl2 = page.url();
    const wasRedirected2 = !currentUrl2.includes('/system/access-groups');
    const hasAccessDeniedMessage2 = await accessDeniedGroups.first().isVisible().catch(() => false);

    // Either we see an access denied message OR we were redirected away
    expect(wasRedirected2 || hasAccessDeniedMessage2).toBeTruthy();

    // Visual Checkpoint 3: Access denied for /system/access-groups
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-access-groups-access-denied.png`,
      fullPage: true,
    });
  });
});
