import { test, expect, type Page } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E6/journey-5';

// --- Mock API responses ---

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
      tenantName: 'Nexa Ltd',
      mfaEnabled: false,
    },
    requiresMfa: false,
  },
};

const MOCK_COMPANIES_RESPONSE = {
  success: true,
  data: [
    {
      id: 'comp-001',
      name: 'Nexa Ltd',
      slug: 'nexa-ltd',
      baseCurrencyCode: 'GBP',
      isDefault: true,
    },
    {
      id: 'comp-002',
      name: 'Acme Corp',
      slug: 'acme-corp',
      baseCurrencyCode: 'USD',
      isDefault: false,
    },
  ],
};

/** Permissions for the initial company (comp-001 = Nexa Ltd). */
const MOCK_PERMISSIONS_COMP1 = {
  success: true,
  data: {
    userId: 'usr-001',
    companyId: 'comp-001',
    role: 'ADMIN',
    isSuperAdmin: false,
    accessGroups: [{ id: 'ag-001', code: 'ADMIN', name: 'Administrators' }],
    permissions: {
      system: { canAccess: true, canNew: true, canView: true, canEdit: true, canDelete: true },
      finance: { canAccess: true, canNew: true, canView: true, canEdit: true, canDelete: true },
      sales: { canAccess: true, canNew: true, canView: true, canEdit: true, canDelete: true },
    },
    fieldOverrides: {},
    enabledModules: ['system', 'finance', 'sales'],
  },
};

/** Permissions for the second company (comp-002 = Acme Corp). */
const MOCK_PERMISSIONS_COMP2 = {
  success: true,
  data: {
    userId: 'usr-001',
    companyId: 'comp-002',
    role: 'ADMIN',
    isSuperAdmin: false,
    accessGroups: [{ id: 'ag-002', code: 'ADMIN', name: 'Administrators' }],
    permissions: {
      system: { canAccess: true, canNew: true, canView: true, canEdit: true, canDelete: true },
      finance: { canAccess: true, canNew: true, canView: true, canEdit: true, canDelete: true },
      sales: { canAccess: true, canNew: true, canView: true, canEdit: true, canDelete: true },
    },
    fieldOverrides: {},
    enabledModules: ['system', 'finance', 'sales'],
  },
};

/**
 * Set up API mocks for the full company-switch flow.
 * Tracks the active company to return the correct permissions.
 */
async function mockApis(page: Page) {
  let activeCompanyId = 'comp-001';

  // Mock POST /api/v1/auth/login
  await page.route('**/api/v1/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_LOGIN_RESPONSE),
    });
  });

  // Mock GET /api/v1/system/companies
  await page.route('**/api/v1/system/companies', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_COMPANIES_RESPONSE),
    });
  });

  // Mock GET /api/v1/system/my-permissions — returns permissions for active company
  await page.route('**/api/v1/system/my-permissions', async (route) => {
    // Check X-Company-Id header to decide which permissions to return
    const companyHeader = route.request().headers()['x-company-id'];
    if (companyHeader === 'comp-002' || activeCompanyId === 'comp-002') {
      activeCompanyId = 'comp-002';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PERMISSIONS_COMP2),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PERMISSIONS_COMP1),
      });
    }
  });
}

test.describe('Journey 5: Switch Company Context', () => {
  test('complete company switch flow — login, open dropdown, switch company, verify context update', async ({
    page,
  }) => {
    // Set up API mocks before navigation
    await mockApis(page);

    // ─── Login first (prerequisite for authenticated pages) ───
    await page.goto('/');
    await page.waitForURL('**/login', { timeout: 10_000 });

    await page.getByPlaceholder('you@company.co.uk').fill('admin@nexa-test.com');
    await page.getByPlaceholder('Enter your password').fill('TestPassword123!');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for authenticated dashboard to load
    await expect(page.getByPlaceholder('you@company.co.uk')).not.toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByRole('heading', { name: /Dashboard/i }),
    ).toBeVisible({ timeout: 10_000 });

    // ─── Step 1: Verify dashboard with company switcher ───
    // The company switcher should show the current company (Nexa Ltd)
    const companySwitcherTrigger = page.getByLabel('Switch Company');
    await expect(companySwitcherTrigger).toBeVisible({ timeout: 10_000 });

    // Verify current company name is displayed
    await expect(companySwitcherTrigger.getByText('Nexa Ltd')).toBeVisible();

    // Visual checkpoint 1: Dashboard with company switcher
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-dashboard-with-company-switcher.png`,
      fullPage: true,
    });

    // ─── Step 2: Click company switcher to open dropdown ───
    await companySwitcherTrigger.click();

    // Wait for the dropdown menu to appear
    const dropdownMenu = page.locator('[role="menu"]');
    await expect(dropdownMenu).toBeVisible({ timeout: 5_000 });

    // Verify both companies are listed
    const nexaItem = dropdownMenu.getByText('Nexa Ltd');
    const acmeItem = dropdownMenu.getByText('Acme Corp');
    await expect(nexaItem).toBeVisible();
    await expect(acmeItem).toBeVisible();

    // Verify current company (Nexa Ltd) has a checkmark
    const currentCompanyCheck = dropdownMenu.locator(
      'svg[aria-label="Current company"]',
    );
    await expect(currentCompanyCheck).toBeVisible();

    // Visual checkpoint 2: Company dropdown open
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-company-dropdown-open.png`,
      fullPage: true,
    });

    // ─── Step 3: Click Acme Corp to switch company ───
    const acmeMenuItem = dropdownMenu
      .locator('[role="menuitem"]')
      .filter({ hasText: 'Acme Corp' });
    await acmeMenuItem.click();

    // Wait for the toast notification confirming the switch
    const successToast = page.getByText('Switched to Acme Corp');
    await expect(successToast).toBeVisible({ timeout: 10_000 });

    // Verify company switcher now shows Acme Corp
    await expect(companySwitcherTrigger.getByText('Acme Corp')).toBeVisible({
      timeout: 5_000,
    });

    // Dropdown should be closed
    await expect(dropdownMenu).not.toBeVisible();

    // Visual checkpoint 3: Company switched — new context
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-company-switched.png`,
      fullPage: true,
    });
  });
});
