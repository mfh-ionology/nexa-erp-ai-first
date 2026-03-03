import { test, expect, type Page } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E6/journey-2';

// --- Mock API responses ---

/** Login response when MFA is required — no tokens provided. */
const MOCK_LOGIN_MFA_REQUIRED = {
  success: true,
  data: {
    requiresMfa: true,
    accessToken: '',
    refreshToken: '',
    expiresIn: 0,
    user: {
      id: '',
      email: '',
      firstName: '',
      lastName: '',
      role: 'STAFF',
      enabledModules: [],
      tenantId: '',
      tenantName: '',
      mfaEnabled: true,
    },
  },
};

/** MFA verify response — full tokens and user returned. */
const MOCK_MFA_VERIFY_RESPONSE = {
  success: true,
  data: {
    accessToken: 'mock-access-token-mfa-jwt',
    refreshToken: 'mock-refresh-token-mfa-jwt',
    expiresIn: 3600,
    user: {
      id: 'usr-002',
      email: 'mfa-user@nexa-test.com',
      firstName: 'MFA',
      lastName: 'User',
      role: 'ADMIN',
      enabledModules: ['system', 'finance', 'sales'],
      tenantId: 'tenant-001',
      tenantName: 'Demo Company',
      mfaEnabled: true,
    },
    requiresMfa: false,
  },
};

const MOCK_PERMISSIONS_RESPONSE = {
  success: true,
  data: {
    userId: 'usr-002',
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

/** Set up API mocks for the MFA login flow. */
async function mockMfaLoginApi(page: Page) {
  // Mock POST /api/v1/auth/login — returns requiresMfa: true
  await page.route('**/api/v1/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_LOGIN_MFA_REQUIRED),
    });
  });

  // Mock POST /api/v1/auth/mfa/verify — returns full tokens + user
  await page.route('**/api/v1/auth/mfa/verify', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_MFA_VERIFY_RESPONSE),
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

test.describe('Journey 2: Login with MFA Challenge', () => {
  test('complete MFA login flow — login, MFA step appears, enter code, verify, reach dashboard', async ({
    page,
  }) => {
    // Set up API mocks before any navigation
    await mockMfaLoginApi(page);

    // ─── Step 1: Navigate to /login ───
    await page.goto('/login');
    await page.waitForURL('**/login', { timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);

    // Verify login page elements are visible
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

    // Visual checkpoint 1: Login page loaded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-login-page.png`,
      fullPage: true,
    });

    // ─── Step 2: Fill email and password for MFA user ───
    await page
      .getByPlaceholder('you@company.co.uk')
      .fill('mfa-user@nexa-test.com');
    await page
      .getByPlaceholder('Enter your password')
      .fill('TestPassword123!');

    // Verify fields are populated
    await expect(
      page.getByPlaceholder('you@company.co.uk'),
    ).toHaveValue('mfa-user@nexa-test.com');
    await expect(
      page.getByPlaceholder('Enter your password'),
    ).toHaveValue('TestPassword123!');

    // ─── Step 3: Click "Sign In" — MFA step should appear ───
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for MFA step to appear — heading changes to "Two-Factor Authentication"
    await expect(
      page.getByText('Two-Factor Authentication'),
    ).toBeVisible({ timeout: 10_000 });

    // Verify MFA step elements
    await expect(
      page.getByText('Enter the 6-digit code from your authenticator app'),
    ).toBeVisible();
    await expect(
      page.getByPlaceholder('000000'),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Verify' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Verify' }),
    ).toBeEnabled();
    await expect(
      page.getByRole('button', { name: 'Back to sign in' }),
    ).toBeVisible();

    // Login form elements should no longer be visible
    await expect(
      page.getByPlaceholder('you@company.co.uk'),
    ).not.toBeVisible();
    await expect(
      page.getByPlaceholder('Enter your password'),
    ).not.toBeVisible();

    // Visual checkpoint 2: MFA verification step visible
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-mfa-step-visible.png`,
      fullPage: true,
    });

    // ─── Step 4: Fill MFA code ───
    await page.getByPlaceholder('000000').fill('123456');

    // Verify the code was entered
    await expect(page.getByPlaceholder('000000')).toHaveValue('123456');

    // ─── Step 5: Click "Verify" — should redirect to authenticated dashboard ───
    await page.getByRole('button', { name: 'Verify' }).click();

    // Wait for the MFA form to disappear
    await expect(
      page.getByText('Two-Factor Authentication'),
    ).not.toBeVisible({ timeout: 15_000 });

    // Verify dashboard content is loaded
    await expect(
      page.getByRole('heading', { name: /Dashboard/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Visual checkpoint 3: Authenticated dashboard loaded after MFA
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-dashboard-after-mfa.png`,
      fullPage: true,
    });

    // Verify user avatar is present (authenticated state)
    const avatar = page.locator('[data-slot="avatar"]').first();
    await expect(avatar).toBeVisible({ timeout: 5_000 });
  });
});
