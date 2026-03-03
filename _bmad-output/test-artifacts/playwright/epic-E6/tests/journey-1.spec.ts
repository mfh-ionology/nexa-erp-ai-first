import { test, expect, type Page } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E6/journey-1';

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

/** Set up API mocks for the login flow (login + permissions endpoints). */
async function mockLoginApi(page: Page) {
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
}

test.describe('Journey 1: Login with Email and Password', () => {
  test('complete login flow — navigate, fill credentials, sign in, verify dashboard', async ({
    page,
  }) => {
    // Set up API mocks before any navigation
    await mockLoginApi(page);

    // ─── Step 1: Navigate to "/" — expect redirect to /login ───
    await page.goto('/');
    await page.waitForURL('**/login', { timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);

    // Verify login page elements
    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(
      page.getByPlaceholder('you@company.co.uk'),
    ).toBeVisible();
    await expect(
      page.getByPlaceholder('Enter your password'),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Sign In' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Sign In' }),
    ).toBeEnabled();

    // Visual checkpoint 1: Login page loaded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-login-page.png`,
      fullPage: true,
    });

    // ─── Step 2: Fill email and password ───
    await page
      .getByPlaceholder('you@company.co.uk')
      .fill('admin@nexa-test.com');
    await page
      .getByPlaceholder('Enter your password')
      .fill('TestPassword123!');

    // Verify fields are populated
    await expect(
      page.getByPlaceholder('you@company.co.uk'),
    ).toHaveValue('admin@nexa-test.com');
    await expect(
      page.getByPlaceholder('Enter your password'),
    ).toHaveValue('TestPassword123!');

    // ─── Step 3: Click "Sign In" — expect redirect to dashboard ───
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for the login page to disappear (login form no longer visible)
    await expect(page.getByPlaceholder('you@company.co.uk')).not.toBeVisible({
      timeout: 15_000,
    });

    // Verify dashboard content is loaded
    await expect(
      page.getByRole('heading', { name: /Dashboard/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Visual checkpoint 2: Dashboard loaded after login
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-dashboard-loaded.png`,
      fullPage: true,
    });

    // ─── Step 4: Verify user avatar in header ───
    const avatar = page.locator('[data-slot="avatar"]').first();
    await expect(avatar).toBeVisible({ timeout: 5_000 });

    // Verify avatar has initials (fallback text)
    const avatarFallback = page
      .locator('[data-slot="avatar-fallback"]')
      .first();
    await expect(avatarFallback).toBeVisible();
    // Initials should be non-empty (e.g. "AD" for Admin Demo)
    await expect(avatarFallback).not.toHaveText('');

    // Visual checkpoint 3: User avatar verified
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-user-avatar-verified.png`,
      fullPage: true,
    });
  });
});
