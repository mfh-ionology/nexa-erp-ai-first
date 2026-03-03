import { test, expect, type Page } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E6/journey-17';

// --- Mock API responses for a limited-access user ---

const MOCK_LOGIN_RESPONSE = {
  success: true,
  data: {
    accessToken: 'mock-access-token-limited',
    refreshToken: 'mock-refresh-token-limited',
    expiresIn: 3600,
    user: {
      id: 'usr-limited-001',
      email: 'limited-user@nexa-test.com',
      firstName: 'Limited',
      lastName: 'User',
      role: 'STAFF',
      enabledModules: ['system', 'sales'],
      tenantId: 'tenant-001',
      tenantName: 'Demo Company',
      mfaEnabled: false,
    },
    requiresMfa: false,
  },
};

// Permissions response: only system and sales enabled, no finance
const MOCK_PERMISSIONS_RESPONSE = {
  success: true,
  data: {
    userId: 'usr-limited-001',
    companyId: 'comp-001',
    role: 'STAFF',
    isSuperAdmin: false,
    accessGroups: [{ id: 'ag-002', code: 'SALES_STAFF', name: 'Sales Staff' }],
    permissions: {
      'system.users.list': {
        canAccess: true,
        canNew: false,
        canView: true,
        canEdit: false,
        canDelete: false,
      },
      'system.myPermissions': {
        canAccess: true,
        canNew: false,
        canView: true,
        canEdit: false,
        canDelete: false,
      },
      'sales.quotes.list': {
        canAccess: true,
        canNew: true,
        canView: true,
        canEdit: true,
        canDelete: false,
      },
      'sales.orders.list': {
        canAccess: true,
        canNew: true,
        canView: true,
        canEdit: true,
        canDelete: false,
      },
      'sales.deliveryNotes.list': {
        canAccess: true,
        canNew: false,
        canView: true,
        canEdit: false,
        canDelete: false,
      },
    },
    fieldOverrides: {},
    enabledModules: ['system', 'sales'],
  },
};

/** Set up API mocks for the limited-user login flow. */
async function mockLimitedUserLoginApi(page: Page) {
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

test.describe('Journey 17: Permission-Driven Sidebar Filtering', () => {
  test('sidebar only shows modules the limited user has canAccess for', async ({
    page,
  }) => {
    // Set up API mocks before any navigation
    await mockLimitedUserLoginApi(page);

    // ── Step 1: Navigate to /login ──────────────────────────────────
    await page.goto('/login');
    await expect(page.getByText('Welcome back')).toBeVisible();

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-login-page.png`,
      fullPage: true,
    });

    // ── Step 2: Fill login form with limited-access user credentials ─
    await page
      .getByPlaceholder('you@company.co.uk')
      .fill('limited-user@nexa-test.com');
    await page
      .getByPlaceholder('Enter your password')
      .fill('TestPassword123!');

    // ── Step 3: Click Sign In — expect dashboard with filtered sidebar
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for login page to disappear
    await expect(
      page.getByPlaceholder('you@company.co.uk'),
    ).not.toBeVisible({ timeout: 15_000 });

    // Wait for the sidebar navigation to be visible
    const sidebar = page.getByRole('navigation', { name: /navigation/i });
    await expect(sidebar).toBeVisible({ timeout: 15_000 });

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-filtered-sidebar-after-login.png`,
      fullPage: true,
    });

    // ── Step 4: Verify Finance module group is NOT in the sidebar ────
    // The Finance group should not appear at all for this limited user
    // (enabledModules only has 'system' and 'sales')
    const financeGroup = sidebar.getByText('Finance', { exact: true });
    await expect(financeGroup).not.toBeVisible();

    // Also verify other restricted modules are absent
    await expect(
      sidebar.getByText('Accounts Receivable', { exact: true }),
    ).not.toBeVisible();
    await expect(
      sidebar.getByText('Manufacturing', { exact: true }),
    ).not.toBeVisible();
    await expect(
      sidebar.getByText('HR & Payroll', { exact: true }),
    ).not.toBeVisible();

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-finance-absent-verification.png`,
      fullPage: true,
    });

    // ── Step 5: Verify Sales module group IS in the sidebar ─────────
    const salesGroup = sidebar.getByText('Sales', { exact: true });
    await expect(salesGroup).toBeVisible();

    // Also verify System module is present (always enabled for this user)
    const systemGroup = sidebar.getByText('System', { exact: true });
    await expect(systemGroup).toBeVisible();

    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-sales-present-verification.png`,
      fullPage: true,
    });
  });
});
