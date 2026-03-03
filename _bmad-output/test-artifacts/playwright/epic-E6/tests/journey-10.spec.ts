import { test, expect, type Page, type Route } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E6/journey-10';

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
    code: 'FINANCE_TEAM',
    name: 'Finance Team',
    description: 'Finance department access',
    isSystem: false,
    isActive: true,
    userCount: 5,
    createdAt: '2026-01-15T10:00:00.000Z',
    updatedAt: '2026-01-15T10:00:00.000Z',
  },
];

const CREATED_ACCESS_GROUP = {
  id: 'ag-new-001',
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

const ALL_RESOURCES = [
  { id: 'res-001', code: 'SYS_USERS', name: 'Users', module: 'system', type: 'PAGE', parentCode: null, sortOrder: 100, icon: null, description: 'User management page', isActive: true },
  { id: 'res-002', code: 'SYS_COMPANIES', name: 'Companies', module: 'system', type: 'PAGE', parentCode: null, sortOrder: 200, icon: null, description: 'Company management page', isActive: true },
  { id: 'res-003', code: 'SYS_RESOURCES', name: 'Resource Registry', module: 'system', type: 'PAGE', parentCode: null, sortOrder: 300, icon: null, description: 'Resource registry page', isActive: true },
  { id: 'res-004', code: 'SYS_ACCESS_GROUPS', name: 'Access Groups', module: 'system', type: 'PAGE', parentCode: null, sortOrder: 400, icon: null, description: 'Access group management', isActive: true },
];

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

  // Access groups create endpoint (POST without query params)
  await page.route('**/api/v1/system/access-groups', async (route: Route) => {
    const method = route.request().method();
    if (method === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: CREATED_ACCESS_GROUP,
        }),
      });
    } else if (method === 'GET') {
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

  // Access group detail endpoint (for the newly created group)
  await page.route('**/api/v1/system/access-groups/ag-new-001', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: CREATED_ACCESS_GROUP,
      }),
    });
  });

  // Resources endpoint (for permission matrix on detail page)
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

test.describe('Journey 10: Create a New Access Group', () => {
  test('Navigate to access groups list, create new group, verify redirect to detail', async ({
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

    // ─── Step 1: Navigate to /system/access-groups ───
    await page.evaluate(() => {
      window.history.pushState({}, '', '/system/access-groups');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    // Wait for the page title to appear
    await expect(
      page.getByRole('heading', { name: 'Access Groups' }),
    ).toBeVisible({ timeout: 10_000 });

    // Verify breadcrumbs
    const breadcrumbNav = page.locator('nav[aria-label="breadcrumb"]');
    await expect(breadcrumbNav.getByText('System').first()).toBeVisible();
    await expect(breadcrumbNav.getByText('Access Groups').first()).toBeVisible();

    // Verify table columns are present
    await expect(page.getByRole('columnheader', { name: 'Code' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'System' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Users' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Created' })).toBeVisible();

    // Verify data rows are present (3 mock access groups)
    const tableRows = page.locator('table tbody tr');
    await expect(tableRows).toHaveCount(3, { timeout: 5_000 });

    // Verify [+ New] button is visible (it's a <button>, not a link)
    const newButton = page.getByRole('button', { name: /New/i });
    await expect(newButton).toBeVisible();

    // Visual checkpoint 1: Access Group List Page
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-access-group-list-page.png`,
      fullPage: true,
    });

    // ─── Step 2: Click [+ New] button ───
    await newButton.click();

    // Wait for the create form page
    await expect(
      page.getByRole('heading', { name: 'Create Access Group' }),
    ).toBeVisible({ timeout: 10_000 });

    // Verify breadcrumbs on create page
    await expect(breadcrumbNav.getByText('System').first()).toBeVisible();
    await expect(breadcrumbNav.getByText('Access Groups').first()).toBeVisible();

    // Verify form fields
    const codeInput = page.getByLabel('Code');
    const nameInput = page.getByLabel('Name');
    const descriptionInput = page.getByLabel('Description');

    await expect(codeInput).toBeVisible();
    await expect(nameInput).toBeVisible();
    await expect(descriptionInput).toBeVisible();

    // Verify placeholders
    await expect(codeInput).toHaveAttribute('placeholder', 'e.g., SALES_MGR');
    await expect(nameInput).toHaveAttribute('placeholder', 'e.g., Sales Manager');

    // Verify Create and Cancel buttons
    const createButton = page.getByRole('button', { name: 'Create' });
    const cancelButton = page.getByRole('button', { name: 'Cancel' });
    await expect(createButton).toBeVisible();
    await expect(cancelButton).toBeVisible();

    // Visual checkpoint 2: Create Access Group form
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-create-form-loaded.png`,
      fullPage: true,
    });

    // ─── Step 3: Fill form fields ───
    // Type lowercase — code should auto-uppercase
    await codeInput.fill('test_sales_rep');
    await nameInput.fill('Test Sales Representative');
    await descriptionInput.fill('Access group for sales representatives');

    // Verify code was auto-uppercased
    await expect(codeInput).toHaveValue('TEST_SALES_REP');
    await expect(nameInput).toHaveValue('Test Sales Representative');
    await expect(descriptionInput).toHaveValue('Access group for sales representatives');

    // Visual checkpoint 3: Form filled
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-form-filled.png`,
      fullPage: true,
    });

    // ─── Step 4: Click Create button ───
    await createButton.click();

    // Wait for success toast
    await expect(
      page.getByText('Access group created successfully'),
    ).toBeVisible({ timeout: 10_000 });

    // Wait for navigation to detail page
    await page.waitForURL('**/system/access-groups/ag-new-001', { timeout: 10_000 });

    // Verify we're on the detail page with the correct data
    // Code should be displayed as read-only
    const detailCodeInput = page.locator('input[value="TEST_SALES_REP"]');
    await expect(detailCodeInput).toBeVisible({ timeout: 5_000 });
    await expect(detailCodeInput).toBeDisabled();

    // Name should be displayed
    await expect(page.locator('input[value="Test Sales Representative"]')).toBeVisible({ timeout: 5_000 });

    // Verify tabs are visible
    await expect(page.getByRole('tab', { name: 'Permissions' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Field Overrides' })).toBeVisible();

    // Visual checkpoint 4: Success toast and detail page
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-success-toast-and-detail.png`,
      fullPage: true,
    });
  });
});
