import { test, expect, type Page, type Route } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E6/journey-12';

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
      enabledModules: ['system', 'finance', 'sales', 'purchasing', 'inventory'],
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
    enabledModules: ['system', 'finance', 'sales', 'purchasing', 'inventory'],
  },
};

const MOCK_ACCESS_GROUPS = [
  {
    id: 'ag-001',
    code: 'FULL_ACCESS',
    name: 'Full Access',
    description: 'System default full access group',
    isSystem: true,
    isActive: true,
    userCount: 3,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ag-002',
    code: 'READ_ONLY',
    name: 'Read Only',
    description: 'View-only access',
    isSystem: true,
    isActive: true,
    userCount: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ag-003',
    code: 'TEST_SALES_REP',
    name: 'Test Sales Representative',
    description: 'Access group for sales representatives',
    isSystem: false,
    isActive: true,
    userCount: 0,
    createdAt: '2026-02-24T12:00:00.000Z',
    updatedAt: '2026-02-24T12:00:00.000Z',
  },
];

// The test access group (created in j10) — starts with no permissions
const TEST_ACCESS_GROUP_DETAIL = {
  id: 'ag-003',
  code: 'TEST_SALES_REP',
  name: 'Test Sales Representative',
  description: 'Access group for sales representatives',
  isSystem: false,
  isActive: true,
  userCount: 0,
  companyId: 'comp-001',
  permissions: [],
  fieldOverrides: [],
  createdAt: '2026-02-24T12:00:00.000Z',
  updatedAt: '2026-02-24T12:00:00.000Z',
  createdBy: 'usr-001',
  updatedBy: 'usr-001',
};

// Resources that form the permission matrix — multiple modules including Sales
const ALL_RESOURCES = [
  // System module
  { id: 'res-001', code: 'SYS_USERS', name: 'Users', module: 'System', type: 'PAGE', parentCode: null, sortOrder: 100, icon: null, description: 'User management page', isActive: true },
  { id: 'res-002', code: 'SYS_COMPANIES', name: 'Companies', module: 'System', type: 'PAGE', parentCode: null, sortOrder: 200, icon: null, description: 'Company management page', isActive: true },
  { id: 'res-003', code: 'SYS_ACCESS_GROUPS', name: 'Access Groups', module: 'System', type: 'PAGE', parentCode: null, sortOrder: 300, icon: null, description: 'Access group management', isActive: true },
  // Finance module
  { id: 'res-010', code: 'FIN_JOURNAL_ENTRIES', name: 'Journal Entries', module: 'Finance', type: 'PAGE', parentCode: null, sortOrder: 100, icon: null, description: 'Journal entries', isActive: true },
  { id: 'res-011', code: 'FIN_CHART_OF_ACCOUNTS', name: 'Chart of Accounts', module: 'Finance', type: 'PAGE', parentCode: null, sortOrder: 200, icon: null, description: 'Chart of accounts', isActive: true },
  // Sales module — the focus of this journey
  { id: 'res-020', code: 'SALES_QUOTES', name: 'Quotes', module: 'Sales', type: 'PAGE', parentCode: null, sortOrder: 100, icon: null, description: 'Sales quotes', isActive: true },
  { id: 'res-021', code: 'SALES_ORDERS', name: 'Sales Orders', module: 'Sales', type: 'PAGE', parentCode: null, sortOrder: 200, icon: null, description: 'Sales orders', isActive: true },
  { id: 'res-022', code: 'SALES_DELIVERY_NOTES', name: 'Delivery Notes', module: 'Sales', type: 'PAGE', parentCode: null, sortOrder: 300, icon: null, description: 'Delivery notes', isActive: true },
];

/** Set up all API mocks. */
async function mockApis(page: Page) {
  // Track saved permissions to return them on subsequent detail fetches
  let savedPermissions: Array<Record<string, unknown>> = [];

  // Auth login
  await page.route('**/api/v1/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_LOGIN_RESPONSE),
    });
  });

  // My permissions
  await page.route('**/api/v1/system/my-permissions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_PERMISSIONS_RESPONSE),
    });
  });

  // Access groups list endpoint
  await page.route('**/api/v1/system/access-groups?*', async (route: Route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: MOCK_ACCESS_GROUPS,
          meta: { hasMore: false },
        }),
      });
    } else {
      await route.continue();
    }
  });

  // Access groups list (no query params)
  await page.route('**/api/v1/system/access-groups', async (route: Route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: MOCK_ACCESS_GROUPS,
          meta: { hasMore: false },
        }),
      });
    } else {
      await route.continue();
    }
  });

  // Set permissions endpoint (PUT) — must be registered BEFORE the detail endpoint
  // so the more specific URL pattern matches first
  await page.route('**/api/v1/system/access-groups/ag-003/permissions', async (route: Route) => {
    const method = route.request().method();
    if (method === 'PUT') {
      // Capture the saved permissions from the request body
      const body = route.request().postDataJSON();
      if (Array.isArray(body)) {
        savedPermissions = body;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { message: 'Permissions updated' },
        }),
      });
    } else {
      await route.continue();
    }
  });

  // Access group detail endpoint for TEST_SALES_REP
  // Returns saved permissions after a PUT has been made
  await page.route('**/api/v1/system/access-groups/ag-003', async (route: Route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            ...TEST_ACCESS_GROUP_DETAIL,
            permissions: savedPermissions,
          },
        }),
      });
    } else {
      await route.continue();
    }
  });

  // Resources endpoint (for permission matrix)
  await page.route('**/api/v1/system/resources*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: ALL_RESOURCES,
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

test.describe('Journey 12: Configure Access Group Permission Matrix', () => {
  test('Navigate to access group, toggle permissions via matrix, save successfully', async ({
    page,
  }) => {
    // Set up API mocks
    await mockApis(page);

    // Pre-condition: log in
    await performLogin(page);

    // Hide TanStack Query and Router devtools overlays to prevent click interception
    await page.evaluate(() => {
      const queryDevtools = document.querySelector('.tsqd-parent-container');
      if (queryDevtools instanceof HTMLElement) queryDevtools.style.display = 'none';
    });
    // Hide TanStack Router devtools — remove all fixed-position containers with "TanStack" text
    await page.evaluate(() => {
      document.querySelectorAll('*').forEach((el) => {
        if (
          el instanceof HTMLElement &&
          el.textContent?.includes('TanStack Router') &&
          getComputedStyle(el).position === 'fixed'
        ) {
          el.remove();
        }
      });
    });

    // ─── Step 1: Navigate to /system/access-groups ───
    await page.evaluate(() => {
      window.history.pushState({}, '', '/system/access-groups');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    // Wait for the page title to appear
    await expect(
      page.getByRole('heading', { name: 'Access Groups' }),
    ).toBeVisible({ timeout: 10_000 });

    // Verify the test access group is in the list
    await expect(page.getByText('TEST_SALES_REP')).toBeVisible({ timeout: 5_000 });

    // ─── Step 2: Click on the TEST_SALES_REP row ───
    await page.getByText('TEST_SALES_REP').click();

    // Wait for the detail page to load — the group name should appear in the heading
    await expect(
      page.getByRole('heading', { name: 'Test Sales Representative' }),
    ).toBeVisible({ timeout: 10_000 });

    // ─── Step 3: Click/verify Permissions tab ───
    // Permissions is the default tab, but click it to follow the test plan
    const permissionsTab = page.getByRole('tab', { name: 'Permissions' });
    await expect(permissionsTab).toBeVisible();
    await permissionsTab.click();

    // Scope to the main content area to avoid sidebar conflicts
    const mainContent = page.getByLabel('Main content');

    // Wait for the permission matrix to load — verify module groups are present
    // Use the "Select All" checkboxes (unique to the permission matrix) to confirm modules loaded
    await expect(
      page.getByRole('checkbox', { name: /Select All Access.*Sales/i }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole('checkbox', { name: /Select All Access.*Finance/i }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole('checkbox', { name: /Select All Access.*System/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Verify the "Save Permissions" button exists
    const savePermissionsButton = page.getByRole('button', { name: 'Save Permissions' });
    await expect(savePermissionsButton).toBeVisible();
    // Save button should be disabled initially (no changes made)
    await expect(savePermissionsButton).toBeDisabled();

    // Visual checkpoint 1: Permission matrix loaded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-permission-matrix-loaded.png`,
      fullPage: true,
    });

    // ─── Step 4: Expand Sales module group ───
    // All modules are expanded by default. Collapse Sales first, then expand to test toggle.
    // Use the Sales module collapsible trigger — the text "Sales (3)" in the main content
    const salesModuleHeader = mainContent.locator('span.font-semibold', { hasText: 'Sales' });
    // Click to collapse Sales
    await salesModuleHeader.click();
    // Brief wait for collapse animation
    await page.waitForTimeout(300);

    // Verify Sales resources are hidden after collapse (use checkbox aria-label to avoid sidebar conflict)
    await expect(page.getByRole('checkbox', { name: 'Quotes Access' })).not.toBeVisible();

    // Now click again to expand Sales
    await salesModuleHeader.click();
    await page.waitForTimeout(300);

    // Verify Sales resources are visible after expansion — use aria-labeled checkboxes (unique to matrix)
    await expect(page.getByRole('checkbox', { name: 'Quotes Access' })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('checkbox', { name: 'Sales Orders Access' })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('checkbox', { name: 'Delivery Notes Access' })).toBeVisible({ timeout: 5_000 });

    // Visual checkpoint 2: Sales module expanded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-sales-module-expanded.png`,
      fullPage: true,
    });

    // ─── Step 5: Click "Select All canAccess" checkbox on Sales module header ───
    const selectAllAccessSales = page.getByRole('checkbox', {
      name: /Select All Access.*Sales/i,
    });
    await expect(selectAllAccessSales).toBeVisible();
    await selectAllAccessSales.click();

    // Verify all Sales resources now have Access checked
    const quotesAccess = page.getByRole('checkbox', { name: 'Quotes Access' });
    const salesOrdersAccess = page.getByRole('checkbox', { name: 'Sales Orders Access' });
    const deliveryNotesAccess = page.getByRole('checkbox', { name: 'Delivery Notes Access' });

    await expect(quotesAccess).toBeChecked();
    await expect(salesOrdersAccess).toBeChecked();
    await expect(deliveryNotesAccess).toBeChecked();

    // The Select All Access checkbox should now be fully checked (not indeterminate)
    await expect(selectAllAccessSales).toBeChecked();

    // Save button should now be enabled (changes made)
    await expect(savePermissionsButton).toBeEnabled();

    // Visual checkpoint 3: Select All Access applied to Sales
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-select-all-access-sales.png`,
      fullPage: true,
    });

    // ─── Step 6: Click canView checkbox for Sales Orders ───
    const salesOrdersView = page.getByRole('checkbox', { name: 'Sales Orders View' });
    await expect(salesOrdersView).toBeVisible();
    await salesOrdersView.click();
    await expect(salesOrdersView).toBeChecked();

    // ─── Step 7: Click canEdit checkbox for Sales Orders ───
    const salesOrdersEdit = page.getByRole('checkbox', { name: 'Sales Orders Edit' });
    await expect(salesOrdersEdit).toBeVisible();
    await salesOrdersEdit.click();
    await expect(salesOrdersEdit).toBeChecked();

    // ─── Step 8: Click Save Permissions ───
    // Re-hide TanStack Router devtools in case it was re-rendered after page interactions
    await page.evaluate(() => {
      document.querySelectorAll('*').forEach((el) => {
        if (
          el instanceof HTMLElement &&
          el.textContent?.includes('TanStack Router') &&
          getComputedStyle(el).position === 'fixed'
        ) {
          el.remove();
        }
      });
    });
    await expect(savePermissionsButton).toBeEnabled();
    await savePermissionsButton.click({ force: true });

    // Wait for the success toast
    await expect(
      page.getByText('Permissions saved successfully'),
    ).toBeVisible({ timeout: 10_000 });

    // Verify save button returns to disabled after successful save
    await expect(savePermissionsButton).toBeDisabled({ timeout: 5_000 });

    // Verify checkbox states are retained after save
    await expect(quotesAccess).toBeChecked();
    await expect(salesOrdersAccess).toBeChecked();
    await expect(deliveryNotesAccess).toBeChecked();
    await expect(salesOrdersView).toBeChecked();
    await expect(salesOrdersEdit).toBeChecked();

    // Visual checkpoint 4: Permissions saved successfully
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-8-permissions-saved-toast.png`,
      fullPage: true,
    });
  });
});
