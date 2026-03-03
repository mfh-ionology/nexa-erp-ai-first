import { test, expect, type Page } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E6/journey-19';

// --- Mock API responses for a STAFF-role user (non-ADMIN) ---

const MOCK_STAFF_LOGIN_RESPONSE = {
  success: true,
  data: {
    accessToken: 'mock-staff-access-token-jwt',
    refreshToken: 'mock-staff-refresh-token-jwt',
    expiresIn: 3600,
    user: {
      id: 'usr-staff-001',
      email: 'staff-user@nexa-test.com',
      firstName: 'Staff',
      lastName: 'User',
      role: 'STAFF',
      enabledModules: ['system'],
      tenantId: 'tenant-001',
      tenantName: 'Demo Company',
      mfaEnabled: false,
    },
    requiresMfa: false,
  },
};

const MOCK_STAFF_PERMISSIONS_RESPONSE = {
  success: true,
  data: {
    userId: 'usr-staff-001',
    companyId: 'comp-001',
    role: 'STAFF',
    isSuperAdmin: false,
    accessGroups: [{ id: 'ag-staff-001', code: 'STAFF', name: 'Staff' }],
    permissions: {
      system: {
        canAccess: true,
        canNew: false,
        canView: true,
        canEdit: false,
        canDelete: false,
      },
    },
    fieldOverrides: {},
    enabledModules: ['system'],
  },
};

/** Set up API mocks for staff login flow (login + permissions endpoints). */
async function mockStaffLoginApi(page: Page) {
  await page.route('**/api/v1/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_STAFF_LOGIN_RESPONSE),
    });
  });

  await page.route('**/api/v1/system/my-permissions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_STAFF_PERMISSIONS_RESPONSE),
    });
  });
}

/** Log in as the STAFF user and wait for the dashboard. */
async function loginAsStaffUser(page: Page) {
  await mockStaffLoginApi(page);

  await page.goto('/login');
  await expect(page.getByText('Welcome back')).toBeVisible();

  await page
    .getByPlaceholder('you@company.co.uk')
    .fill('staff-user@nexa-test.com');
  await page
    .getByPlaceholder('Enter your password')
    .fill('TestPassword123!');

  await page.getByRole('button', { name: 'Sign In' }).click();

  // Wait for login form to disappear
  await expect(
    page.getByPlaceholder('you@company.co.uk'),
  ).not.toBeVisible({ timeout: 15_000 });

  // Wait for dashboard to be visible
  await expect(
    page.getByRole('heading', { name: /Dashboard/i }),
  ).toBeVisible({ timeout: 10_000 });
}

/**
 * Navigate to a path via client-side routing (preserves SPA state).
 * Uses the History API pushState + popstate event to trigger TanStack Router's
 * internal listener without causing a full page reload.
 */
async function navigateClientSide(page: Page, path: string) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  // Allow time for TanStack Router to process the route change
  await page.waitForTimeout(1_000);
}

test.describe('Journey 19: Non-Admin User Blocked from RBAC Admin Pages', () => {
  test('STAFF user is redirected to 403 when accessing admin-only pages', async ({
    page,
  }) => {
    // ─── Steps 1-3: Login as STAFF user ───
    await loginAsStaffUser(page);

    // Visual checkpoint 1: Staff user dashboard
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-staff-dashboard.png`,
      fullPage: true,
    });

    // ─── Step 4: Navigate to /system/resources — expect 403 ───
    await navigateClientSide(page, '/system/resources');

    // The beforeLoad guard should redirect to /403
    await page.waitForURL('**/403', { timeout: 10_000 });
    await expect(page).toHaveURL(/\/403/);

    // Verify 403 page content
    await expect(page.getByText('403').first()).toBeVisible();
    await expect(
      page.getByText('You do not have permission to access this page'),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /Back to Home/i }),
    ).toBeVisible();

    // Visual checkpoint 2: 403 on /system/resources
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-resources-403.png`,
      fullPage: true,
    });

    // ─── Step 5: Navigate to /system/access-groups — expect 403 ───
    await navigateClientSide(page, '/system/access-groups');

    // The beforeLoad guard should redirect to /403
    await page.waitForURL('**/403', { timeout: 10_000 });
    await expect(page).toHaveURL(/\/403/);

    // Verify 403 page content
    await expect(page.getByText('403').first()).toBeVisible();
    await expect(
      page.getByText('You do not have permission to access this page'),
    ).toBeVisible();

    // Visual checkpoint 3: 403 on /system/access-groups
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-access-groups-403.png`,
      fullPage: true,
    });

    // ─── Step 6: Navigate to /system/users — expect 403 ───
    await navigateClientSide(page, '/system/users');

    // The beforeLoad guard should redirect to /403
    await page.waitForURL('**/403', { timeout: 10_000 });
    await expect(page).toHaveURL(/\/403/);

    // Verify 403 page content
    await expect(page.getByText('403').first()).toBeVisible();
    await expect(
      page.getByText('You do not have permission to access this page'),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /Back to Home/i }),
    ).toBeVisible();

    // Visual checkpoint 4: 403 on /system/users
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-users-403.png`,
      fullPage: true,
    });
  });
});
