import { test, expect, type Page } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E6/journey-22';

// --- Mock API responses for SUPER_ADMIN ---

const MOCK_LOGIN_RESPONSE = {
  success: true,
  data: {
    accessToken: 'mock-superadmin-access-token-jwt',
    refreshToken: 'mock-superadmin-refresh-token-jwt',
    expiresIn: 3600,
    user: {
      id: 'usr-superadmin',
      email: 'superadmin@nexa-test.com',
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      enabledModules: [
        'system',
        'finance',
        'ar',
        'ap',
        'sales',
        'purchasing',
        'inventory',
        'crm',
        'hr',
        'manufacturing',
        'reporting',
      ],
      tenantId: 'tenant-001',
      tenantName: 'Demo Company',
      mfaEnabled: false,
    },
    requiresMfa: false,
  },
};

const ALL_MODULES = [
  'system',
  'finance',
  'ar',
  'ap',
  'sales',
  'purchasing',
  'inventory',
  'crm',
  'hr',
  'manufacturing',
  'reporting',
];

/** Build full permissions object with canAccess for every module. */
function buildFullPermissions() {
  const permissions: Record<string, { canAccess: boolean; canNew: boolean; canView: boolean; canEdit: boolean; canDelete: boolean }> = {};
  for (const mod of ALL_MODULES) {
    permissions[mod] = {
      canAccess: true,
      canNew: true,
      canView: true,
      canEdit: true,
      canDelete: true,
    };
  }
  return permissions;
}

const MOCK_PERMISSIONS_RESPONSE = {
  success: true,
  data: {
    userId: 'usr-superadmin',
    companyId: 'comp-001',
    role: 'SUPER_ADMIN',
    isSuperAdmin: true,
    accessGroups: [{ id: 'ag-superadmin', code: 'SUPER_ADMIN', name: 'Super Administrators' }],
    permissions: buildFullPermissions(),
    fieldOverrides: {},
    enabledModules: ALL_MODULES,
  },
};

const MOCK_COMPANIES_RESPONSE = {
  success: true,
  data: [
    {
      id: 'comp-001',
      name: 'Demo Company',
      slug: 'demo-company',
      baseCurrencyCode: 'GBP',
      isDefault: true,
    },
  ],
};

/** Set up API mocks for SUPER_ADMIN login and permissions. */
async function mockApis(page: Page) {
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

  await page.route('**/api/v1/system/companies', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_COMPANIES_RESPONSE),
    });
  });

  // Catch-all for any other API routes that pages may call on load
  await page.route('**/api/v1/**', async (route) => {
    // Only fulfill if not already handled above
    const url = route.request().url();
    if (
      url.includes('/auth/login') ||
      url.includes('/system/my-permissions') ||
      url.includes('/system/companies')
    ) {
      // Let the specific handlers above handle these
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    });
  });
}

/** Log in as SUPER_ADMIN and wait for dashboard. */
async function performLogin(page: Page) {
  await page.goto('/');
  await page.waitForURL('**/login', { timeout: 10_000 });

  await page.getByPlaceholder('you@company.co.uk').fill('superadmin@nexa-test.com');
  await page.getByPlaceholder('Enter your password').fill('TestPassword123!');
  await page.getByRole('button', { name: 'Sign In' }).click();

  // Wait for login form to disappear
  await expect(page.getByPlaceholder('you@company.co.uk')).not.toBeVisible({
    timeout: 15_000,
  });

  // Wait for dashboard to load
  await expect(
    page.getByRole('heading', { name: /Dashboard/i }),
  ).toBeVisible({ timeout: 10_000 });
}

/** Navigate via client-side routing (preserves SPA state). */
async function navigateClientSide(page: Page, path: string) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await page.waitForTimeout(1_000);
}

// All 11 module group labels as they appear in the sidebar
const MODULE_GROUP_LABELS = [
  'System',
  'Finance',
  'Accounts Receivable',
  'Accounts Payable',
  'Sales',
  'Purchasing',
  'Inventory',
  'CRM',
  'HR & Payroll',
  'Manufacturing',
  'Reporting',
];

test.describe('Journey 22: SUPER_ADMIN Sees All Modules and Routes', () => {
  test('SUPER_ADMIN bypasses all permission checks and sees all modules', async ({
    page,
  }) => {
    // Set up all API mocks before navigation
    await mockApis(page);

    // ─── Steps 1-3: Login as SUPER_ADMIN ───
    await performLogin(page);

    // Verify all 11 module groups are visible in the sidebar
    const sidebar = page.locator('nav[aria-label="Navigation"]');
    await expect(sidebar).toBeVisible({ timeout: 5_000 });

    for (const label of MODULE_GROUP_LABELS) {
      await expect(
        sidebar.getByRole('button', { name: label }),
      ).toBeVisible({ timeout: 5_000 });
    }

    // Visual checkpoint 1: Dashboard with full sidebar showing all modules
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-superadmin-dashboard-full-sidebar.png`,
      fullPage: true,
    });

    // ─── Step 4: Navigate to /finance/journals ───
    await navigateClientSide(page, '/finance/journals');

    // Verify route loaded normally (no 403 redirect)
    await expect(page).not.toHaveURL(/\/403/);
    // The URL should still be /finance/journals
    await expect(page).toHaveURL(/\/finance\/journals/);

    // Visual checkpoint 2: Finance Journals page loaded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-finance-journals-no-403.png`,
      fullPage: true,
    });

    // ─── Step 5: Navigate to /system/resources ───
    await navigateClientSide(page, '/system/resources');

    // Verify Resource Registry page loaded (no 403)
    await expect(page).not.toHaveURL(/\/403/);
    await expect(page).toHaveURL(/\/system\/resources/);

    // Visual checkpoint 3: System Resources page
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-system-resources-page.png`,
      fullPage: true,
    });

    // ─── Step 6: Navigate to /system/access-groups ───
    await navigateClientSide(page, '/system/access-groups');

    // Verify Access Groups page loaded (no 403)
    await expect(page).not.toHaveURL(/\/403/);
    await expect(page).toHaveURL(/\/system\/access-groups/);

    // Visual checkpoint 4: Access Groups page
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-access-groups-page.png`,
      fullPage: true,
    });
  });
});
