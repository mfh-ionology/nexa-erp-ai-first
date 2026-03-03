import { test, expect, type Page } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E6/journey-18';

// --- Mock API responses for a user WITHOUT finance module access ---

const MOCK_LOGIN_RESPONSE = {
  success: true,
  data: {
    accessToken: 'mock-access-token-no-finance',
    refreshToken: 'mock-refresh-token-no-finance',
    expiresIn: 3600,
    user: {
      id: 'usr-nofinance-001',
      email: 'sales-only@nexa-test.com',
      firstName: 'Sales',
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

// Permissions: system + sales only — NO finance
const MOCK_PERMISSIONS_RESPONSE = {
  success: true,
  data: {
    userId: 'usr-nofinance-001',
    companyId: 'comp-001',
    role: 'STAFF',
    isSuperAdmin: false,
    accessGroups: [{ id: 'ag-003', code: 'SALES_STAFF', name: 'Sales Staff' }],
    permissions: {
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
    },
    fieldOverrides: {},
    enabledModules: ['system', 'sales'],
  },
};

/** Set up API mocks for a user without finance module access. */
async function mockNoFinanceUserLoginApi(page: Page) {
  await page.route('**/api/v1/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_LOGIN_RESPONSE),
    });
  });

  await page.route('**/api/v1/system/my-permissions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_PERMISSIONS_RESPONSE),
    });
  });
}

/** Log in as the no-finance user and wait for the dashboard. */
async function loginAsNoFinanceUser(page: Page) {
  await mockNoFinanceUserLoginApi(page);

  await page.goto('/login');
  await expect(page.getByText('Welcome back')).toBeVisible();

  await page
    .getByPlaceholder('you@company.co.uk')
    .fill('sales-only@nexa-test.com');
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

test.describe('Journey 18: Route Guard — 403 Access Denied Page', () => {
  test('user without finance access sees 403 when navigating to /finance, then returns home', async ({
    page,
  }) => {
    // ── Pre-condition: Log in as a user WITHOUT finance module access ──
    await loginAsNoFinanceUser(page);

    // ── Step 1: Navigate to /finance via client-side routing ──
    // NOTE: The test plan specifies /finance/journals, but that route does not
    // exist in the router (falls to 404). The module guard lives on /finance.
    // We test /finance to verify the route guard. The /finance/journals gap is
    // documented as a missing feature.
    await navigateClientSide(page, '/finance');

    // The beforeLoad guard should redirect to /403
    await page.waitForURL('**/403', { timeout: 10_000 });
    await expect(page).toHaveURL(/\/403/);

    // Verify 403 page content
    await expect(page.getByText('403').first()).toBeVisible();

    // Check for the access denied message
    await expect(
      page.getByText('You do not have permission to access this page'),
    ).toBeVisible();

    // Check for the description
    await expect(
      page.getByText(/don't have permission.*administrator/i),
    ).toBeVisible();

    // Verify "Contact your administrator" message
    await expect(
      page.getByText('Contact your administrator'),
    ).toBeVisible();

    // Verify "Back to Home" link is present
    const backToHomeLink = page.getByRole('link', { name: /Back to Home/i });
    await expect(backToHomeLink).toBeVisible();

    // Visual checkpoint 1: 403 Access Denied page
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-403-access-denied.png`,
      fullPage: true,
    });

    // ── Step 2: Click "Back to Home" — expect navigation to dashboard ──
    await backToHomeLink.click();

    // Wait for navigation away from /403
    await expect(page).not.toHaveURL(/\/403/, { timeout: 10_000 });

    // Verify dashboard content loads
    await expect(
      page.getByRole('heading', { name: /Dashboard/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Visual checkpoint 2: Dashboard after returning from 403
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-back-to-dashboard.png`,
      fullPage: true,
    });
  });
});
