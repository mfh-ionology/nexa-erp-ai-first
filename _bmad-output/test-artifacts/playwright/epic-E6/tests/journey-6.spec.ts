import { test, expect, type Page } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E6/journey-6';

// --- Mock API responses matching the API envelope format ---

const MOCK_LOGIN_RESPONSE = {
  success: true,
  data: {
    accessToken: 'mock-access-token-jwt',
    refreshToken: 'mock-refresh-token-jwt',
    expiresIn: 3600,
    user: {
      id: 'usr-001',
      email: 'admin@nexa-test.com',
      firstName: 'Admin',
      lastName: 'Demo',
      role: 'ADMIN',
      enabledModules: ['system', 'finance', 'sales'],
      tenantId: 'tenant-001',
      tenantName: 'Demo Company',
      mfaEnabled: false,
    },
    requiresMfa: false,
  },
};

const MOCK_PERMISSIONS_RESPONSE = {
  success: true,
  data: {
    userId: 'usr-001',
    companyId: 'comp-001',
    role: 'ADMIN',
    isSuperAdmin: false,
    accessGroups: [{ id: 'ag-001', code: 'ADMIN', name: 'Administrators' }],
    permissions: {
      system: {
        canAccess: true,
        canNew: true,
        canView: true,
        canEdit: true,
        canDelete: true,
      },
      finance: {
        canAccess: true,
        canNew: true,
        canView: true,
        canEdit: true,
        canDelete: true,
      },
      sales: {
        canAccess: true,
        canNew: true,
        canView: true,
        canEdit: true,
        canDelete: true,
      },
    },
    fieldOverrides: {},
    enabledModules: ['system', 'finance', 'sales'],
  },
};

const MOCK_LOGOUT_RESPONSE = {
  success: true,
  data: null,
};

/** Set up API mocks for login, permissions, and logout. */
async function mockApis(page: Page) {
  // Mock POST /api/v1/auth/login
  await page.route('**/api/v1/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_LOGIN_RESPONSE),
    });
  });

  // Mock GET /api/v1/system/my-permissions
  await page.route('**/api/v1/system/my-permissions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_PERMISSIONS_RESPONSE),
    });
  });

  // Mock POST /api/v1/auth/logout
  await page.route('**/api/v1/auth/logout', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_LOGOUT_RESPONSE),
    });
  });
}

/** Log in by going through the login form (reuses the pattern from journey-1). */
async function performLogin(page: Page) {
  await page.goto('/');
  await page.waitForURL('**/login', { timeout: 10_000 });

  await page.getByPlaceholder('you@company.co.uk').fill('admin@nexa-test.com');
  await page.getByPlaceholder('Enter your password').fill('TestPassword123!');
  await page.getByRole('button', { name: 'Sign In' }).click();

  // Wait for login to complete — login form disappears
  await expect(page.getByPlaceholder('you@company.co.uk')).not.toBeVisible({
    timeout: 15_000,
  });

  // Wait for dashboard to load
  await expect(
    page.getByRole('heading', { name: /Dashboard/i }),
  ).toBeVisible({ timeout: 10_000 });
}

test.describe('Journey 6: User Menu and Sign Out', () => {
  test('open user menu, verify contents, sign out — redirected to login', async ({
    page,
  }) => {
    // Set up all API mocks before navigation
    await mockApis(page);

    // ─── Pre-condition: Log in and reach the authenticated dashboard ───
    await performLogin(page);

    // Verify user avatar is visible in header
    const avatarTrigger = page.getByLabel('User menu');
    await expect(avatarTrigger).toBeVisible({ timeout: 5_000 });

    // Visual checkpoint 1: Authenticated dashboard with avatar visible
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-authenticated-dashboard.png`,
      fullPage: true,
    });

    // ─── Step 2: Click user avatar to open dropdown menu ───
    await avatarTrigger.click();

    // Wait for dropdown menu to appear
    const dropdown = page.getByRole('menu');
    await expect(dropdown).toBeVisible({ timeout: 5_000 });

    // Verify user info in the dropdown
    await expect(dropdown.getByText('Admin Demo')).toBeVisible();
    // Role and email line (ADMIN · admin@nexa-test.com)
    await expect(
      dropdown.getByText('ADMIN · admin@nexa-test.com'),
    ).toBeVisible();

    // Verify menu items
    await expect(dropdown.getByText('My Profile')).toBeVisible();
    await expect(dropdown.getByText('Preferences')).toBeVisible();
    await expect(dropdown.getByText('Sign Out')).toBeVisible();

    // Visual checkpoint 2: User dropdown menu open
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-user-menu-open.png`,
      fullPage: true,
    });

    // ─── Step 3: Click "Sign Out" ───
    await dropdown.getByText('Sign Out').click();

    // Wait for redirect to /login
    await page.waitForURL('**/login', { timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);

    // Verify login page is displayed
    await expect(page.getByText('Welcome back')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByPlaceholder('you@company.co.uk')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();

    // Verify app shell is gone — no sidebar, no user avatar
    await expect(page.getByLabel('User menu')).not.toBeVisible();

    // Visual checkpoint 3: Back on login page after sign out
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-signed-out-login-page.png`,
      fullPage: true,
    });
  });
});
