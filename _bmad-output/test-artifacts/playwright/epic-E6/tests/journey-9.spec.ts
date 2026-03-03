import { test, expect, type Page, type Route } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E6/journey-9';

// --- Mock data ---

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

// Full set of mock resources covering multiple modules and types
const ALL_RESOURCES = [
  { id: 'res-001', code: 'SYS_USERS', name: 'Users', module: 'system', type: 'PAGE', parentCode: null, sortOrder: 100, icon: null, description: 'User management page', isActive: true },
  { id: 'res-002', code: 'SYS_COMPANIES', name: 'Companies', module: 'system', type: 'PAGE', parentCode: null, sortOrder: 200, icon: null, description: 'Company management page', isActive: true },
  { id: 'res-003', code: 'SYS_RESOURCES', name: 'Resource Registry', module: 'system', type: 'PAGE', parentCode: null, sortOrder: 300, icon: null, description: 'Resource registry page', isActive: true },
  { id: 'res-004', code: 'SYS_ACCESS_GROUPS', name: 'Access Groups', module: 'system', type: 'PAGE', parentCode: null, sortOrder: 400, icon: null, description: 'Access group management', isActive: true },
  { id: 'res-005', code: 'SYS_AUDIT_LOG', name: 'Audit Log', module: 'system', type: 'REPORT', parentCode: null, sortOrder: 500, icon: null, description: 'System audit log', isActive: true },
  { id: 'res-006', code: 'FIN_JOURNAL_ENTRY', name: 'Journal Entry', module: 'finance', type: 'PAGE', parentCode: null, sortOrder: 100, icon: null, description: 'Journal entry page', isActive: true },
  { id: 'res-007', code: 'FIN_CHART_OF_ACCOUNTS', name: 'Chart of Accounts', module: 'finance', type: 'PAGE', parentCode: null, sortOrder: 200, icon: null, description: 'Chart of accounts page', isActive: true },
  { id: 'res-008', code: 'FIN_JOURNAL_REPORT', name: 'Journal Report', module: 'finance', type: 'REPORT', parentCode: null, sortOrder: 300, icon: null, description: 'Journal entries report', isActive: true },
  { id: 'res-009', code: 'FIN_GL_SETTINGS', name: 'GL Settings', module: 'finance', type: 'SETTING', parentCode: null, sortOrder: 400, icon: null, description: 'General ledger settings', isActive: true },
  { id: 'res-010', code: 'FIN_PERIOD_CLOSE', name: 'Period Close', module: 'finance', type: 'MAINTENANCE', parentCode: null, sortOrder: 500, icon: null, description: 'Fiscal period close', isActive: true },
  { id: 'res-011', code: 'SALES_ORDERS', name: 'Sales Orders', module: 'sales', type: 'PAGE', parentCode: null, sortOrder: 100, icon: null, description: 'Sales order management', isActive: true },
  { id: 'res-012', code: 'SALES_REPORT', name: 'Sales Report', module: 'sales', type: 'REPORT', parentCode: null, sortOrder: 200, icon: null, description: 'Sales summary report', isActive: true },
];

/** Filter resources matching query params (simulates server-side filtering). */
function filterResources(params: URLSearchParams) {
  let result = [...ALL_RESOURCES];
  const moduleFilter = params.get('module');
  const typeFilter = params.get('type');
  const searchFilter = params.get('search');

  if (moduleFilter) {
    result = result.filter((r) => r.module === moduleFilter);
  }
  if (typeFilter) {
    result = result.filter((r) => r.type === typeFilter);
  }
  if (searchFilter) {
    const term = searchFilter.toLowerCase();
    result = result.filter(
      (r) =>
        r.code.toLowerCase().includes(term) ||
        r.name.toLowerCase().includes(term) ||
        (r.description ?? '').toLowerCase().includes(term),
    );
  }
  return result;
}

/** Set up all API mocks. */
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

  await page.route('**/api/v1/system/resources*', async (route: Route) => {
    const url = new URL(route.request().url());
    const filtered = filterResources(url.searchParams);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: filtered,
        meta: { hasMore: false },
      }),
    });
  });
}

/** Log in via the login form. */
async function performLogin(page: Page) {
  await page.goto('/');
  await page.waitForURL('**/login', { timeout: 10_000 });

  await page.getByPlaceholder('you@company.co.uk').fill('admin@nexa-test.com');
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

test.describe('Journey 9: Browse Resource Registry with Filters', () => {
  test('Navigate to Resource Registry, apply module/type filters and search, verify read-only', async ({
    page,
  }) => {
    // Set up API mocks
    await mockApis(page);

    // Pre-condition: log in
    await performLogin(page);

    // Hide TanStack Query devtools overlay
    await page.evaluate(() => {
      const devtools = document.querySelector('.tsqd-parent-container');
      if (devtools instanceof HTMLElement) devtools.style.display = 'none';
    });

    // ─── Step 1: Navigate to /system/resources ───
    // Cannot use page.goto() here — it does a full page reload which loses
    // the in-memory zustand auth state (no persist middleware).
    // Use history.pushState + popstate event to trigger TanStack Router's
    // client-side navigation while preserving the in-memory store.
    await page.evaluate(() => {
      window.history.pushState({}, '', '/system/resources');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    // Wait for the page title to appear
    await expect(
      page.getByRole('heading', { name: 'Resource Registry' }),
    ).toBeVisible({ timeout: 10_000 });

    // Verify breadcrumbs (aria-label is lowercase "breadcrumb" from shadcn/ui)
    const breadcrumbNav = page.locator('nav[aria-label="breadcrumb"]');
    await expect(breadcrumbNav.getByText('System').first()).toBeVisible();
    await expect(breadcrumbNav.getByText('Resource Registry').first()).toBeVisible();

    // Verify table columns are present (header cells)
    await expect(page.getByRole('columnheader', { name: 'Code' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Module' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Type' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Sort Order' })).toBeVisible();

    // Verify table has data rows (12 mock resources)
    const tableRows = page.locator('table tbody tr');
    await expect(tableRows).toHaveCount(12, { timeout: 5_000 });

    // Verify filter dropdowns visible
    const moduleFilterTrigger = page.locator('[aria-label="Module"]');
    await expect(moduleFilterTrigger).toBeVisible();
    const typeFilterTrigger = page.locator('[aria-label="Type"]');
    await expect(typeFilterTrigger).toBeVisible();

    // Verify search input visible (use textbox role to avoid ambiguity with header search)
    const searchInput = page.getByRole('textbox', { name: 'Search' });
    await expect(searchInput).toBeVisible();

    // Visual checkpoint 1: Resource Registry page loaded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-resource-registry-loaded.png`,
      fullPage: true,
    });

    // ─── Step 2: Verify [+ New] button does NOT exist (read-only) ───
    const newButton = page.getByRole('button', { name: /New/i });
    // The entity list template renders [+ New] only when canCreate=true.
    // canCreate is false for resources, so the button should not exist.
    await expect(newButton).not.toBeVisible();

    // ─── Step 3: Click Module filter dropdown ───
    await moduleFilterTrigger.click();

    // Wait for the dropdown content to appear
    const moduleDropdown = page.locator('[role="listbox"]');
    await expect(moduleDropdown).toBeVisible({ timeout: 3_000 });

    // Verify expected module options
    await expect(moduleDropdown.getByText('All Modules')).toBeVisible();
    await expect(moduleDropdown.getByText('System')).toBeVisible();
    await expect(moduleDropdown.getByText('Finance')).toBeVisible();
    await expect(moduleDropdown.getByText('Accounts Receivable')).toBeVisible();
    await expect(moduleDropdown.getByText('Accounts Payable')).toBeVisible();
    await expect(moduleDropdown.getByText('Sales')).toBeVisible();
    await expect(moduleDropdown.getByText('Purchasing')).toBeVisible();
    await expect(moduleDropdown.getByText('Inventory')).toBeVisible();
    await expect(moduleDropdown.getByText('CRM')).toBeVisible();
    await expect(moduleDropdown.getByText('HR & Payroll')).toBeVisible();
    await expect(moduleDropdown.getByText('Manufacturing')).toBeVisible();
    await expect(moduleDropdown.getByText('Reporting')).toBeVisible();

    // Visual checkpoint 2: Module dropdown open
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-module-dropdown-open.png`,
      fullPage: true,
    });

    // ─── Step 4: Select "Finance" from module dropdown ───
    await moduleDropdown.getByText('Finance').click();

    // Wait for the table to refresh with filtered data
    // Finance module has 5 resources in our mock data
    await expect(tableRows).toHaveCount(5, { timeout: 5_000 });

    // Verify all visible rows show "Finance" in the module column
    const moduleCells = page.locator('table tbody tr td:nth-child(3)');
    const count = await moduleCells.count();
    for (let i = 0; i < count; i++) {
      await expect(moduleCells.nth(i)).toHaveText('Finance');
    }

    // Visual checkpoint 3: Filtered by Finance module
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-filtered-finance-module.png`,
      fullPage: true,
    });

    // ─── Step 5: Click Type filter dropdown ───
    await typeFilterTrigger.click();

    const typeDropdown = page.locator('[role="listbox"]');
    await expect(typeDropdown).toBeVisible({ timeout: 3_000 });

    // Verify expected type options
    await expect(typeDropdown.getByText('All Types')).toBeVisible();
    await expect(typeDropdown.getByText('Page')).toBeVisible();
    await expect(typeDropdown.getByText('Report')).toBeVisible();
    await expect(typeDropdown.getByText('Setting')).toBeVisible();
    await expect(typeDropdown.getByText('Maintenance')).toBeVisible();

    // ─── Step 6: Select "Page" from type dropdown ───
    await typeDropdown.getByText('Page').click();

    // Finance + PAGE = 2 resources: Journal Entry and Chart of Accounts
    await expect(tableRows).toHaveCount(2, { timeout: 5_000 });

    // Verify all rows have type "Page" (rendered as badge)
    const typeCells = page.locator('table tbody tr td:nth-child(4)');
    const typeCount = await typeCells.count();
    for (let i = 0; i < typeCount; i++) {
      await expect(typeCells.nth(i)).toHaveText('Page');
    }

    // Visual checkpoint 4: Filtered by Finance + PAGE
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-filtered-finance-page.png`,
      fullPage: true,
    });

    // ─── Step 7: Type "journal" in search input ───
    await searchInput.fill('journal');

    // Wait for debounce (300ms) + network request
    // After search, only "Journal Entry" should match (FIN_JOURNAL_ENTRY, finance, PAGE)
    await expect(tableRows).toHaveCount(1, { timeout: 5_000 });

    // Verify the search input has "journal"
    await expect(searchInput).toHaveValue('journal');

    // Verify the remaining row is the journal entry
    await expect(page.locator('table tbody tr').first()).toContainText('Journal Entry');

    // Visual checkpoint 5: Search results for "journal"
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-7-search-journal.png`,
      fullPage: true,
    });

    // ─── Step 8: Click first row — nothing should happen (read-only) ───
    const firstRow = page.locator('table tbody tr').first();
    const currentUrl = page.url();
    await firstRow.click();

    // Small wait to ensure no navigation occurs
    await page.waitForTimeout(500);

    // URL should remain unchanged — no row click navigation
    expect(page.url()).toBe(currentUrl);
  });
});
