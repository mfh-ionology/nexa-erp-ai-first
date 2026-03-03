import { test, expect, type Page, type Route } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E6/journey-13';

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
    },
    fieldOverrides: {},
    enabledModules: ['system', 'finance', 'sales', 'purchasing', 'inventory'],
  },
};

// Initial list includes the custom group TEST_SALES_REP
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

// After deactivation, the list should no longer include TEST_SALES_REP
const MOCK_ACCESS_GROUPS_AFTER_DEACTIVATE = MOCK_ACCESS_GROUPS.filter(
  (g) => g.id !== 'ag-003',
);

// Detail for the TEST_SALES_REP custom group
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

// Resources for the permission matrix
const ALL_RESOURCES = [
  { id: 'res-001', code: 'SYS_USERS', name: 'Users', module: 'System', type: 'PAGE', parentCode: null, sortOrder: 100, icon: null, description: 'User management page', isActive: true },
  { id: 'res-002', code: 'SYS_COMPANIES', name: 'Companies', module: 'System', type: 'PAGE', parentCode: null, sortOrder: 200, icon: null, description: 'Company management page', isActive: true },
  { id: 'res-003', code: 'SYS_ACCESS_GROUPS', name: 'Access Groups', module: 'System', type: 'PAGE', parentCode: null, sortOrder: 300, icon: null, description: 'Access group management', isActive: true },
];

/** Set up all API mocks. */
async function mockApis(page: Page) {
  let deactivated = false;

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

  // Access groups list endpoint (with query params)
  await page.route('**/api/v1/system/access-groups?*', async (route: Route) => {
    const method = route.request().method();
    if (method === 'GET') {
      const data = deactivated
        ? MOCK_ACCESS_GROUPS_AFTER_DEACTIVATE
        : MOCK_ACCESS_GROUPS;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data,
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
      const data = deactivated
        ? MOCK_ACCESS_GROUPS_AFTER_DEACTIVATE
        : MOCK_ACCESS_GROUPS;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data,
          meta: { hasMore: false },
        }),
      });
    } else {
      await route.continue();
    }
  });

  // DELETE endpoint for deactivating the access group (soft-delete)
  await page.route('**/api/v1/system/access-groups/ag-003', async (route: Route) => {
    const method = route.request().method();
    if (method === 'DELETE') {
      deactivated = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { message: 'Access group deactivated' },
        }),
      });
    } else if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: TEST_ACCESS_GROUP_DETAIL,
        }),
      });
    } else {
      await route.continue();
    }
  });

  // Resources endpoint (for permission matrix — in case detail page loads it)
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

/** Hide TanStack devtools overlays to prevent click interception. */
async function hideDevtools(page: Page) {
  await page.evaluate(() => {
    const queryDevtools = document.querySelector('.tsqd-parent-container');
    if (queryDevtools instanceof HTMLElement) queryDevtools.style.display = 'none';
  });
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
}

test.describe('Journey 13: Deactivate a Custom Access Group', () => {
  test('Navigate to custom access group, deactivate via overflow menu with confirmation', async ({
    page,
  }) => {
    // Set up API mocks
    await mockApis(page);

    // Pre-condition: log in
    await performLogin(page);

    // Hide devtools overlays
    await hideDevtools(page);

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

    // Visual checkpoint 1: Detail page loaded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-access-group-detail-loaded.png`,
      fullPage: true,
    });

    // ─── Step 3: Click overflow menu (more actions) button ───
    // Re-hide devtools in case they re-rendered after navigation
    await hideDevtools(page);

    const moreActionsButton = page.getByRole('button', { name: 'More actions' });
    await expect(moreActionsButton).toBeVisible({ timeout: 5_000 });
    await moreActionsButton.click();

    // Wait for the dropdown menu to appear with the Deactivate option
    const deactivateMenuItem = page.getByRole('menuitem', { name: 'Deactivate' });
    await expect(deactivateMenuItem).toBeVisible({ timeout: 5_000 });

    // Verify the Deactivate option is enabled (not disabled) for custom groups
    await expect(deactivateMenuItem).toBeEnabled();

    // Visual checkpoint 2: Overflow menu with Deactivate option
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-overflow-menu-deactivate-visible.png`,
      fullPage: true,
    });

    // ─── Step 4: Click Deactivate in the overflow menu ───
    await deactivateMenuItem.click();

    // Wait for the confirmation dialog to appear
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Verify dialog title
    await expect(
      dialog.getByText('Deactivate Access Group'),
    ).toBeVisible();

    // Verify dialog body mentions the group name and consequences
    await expect(
      dialog.getByText(/Deactivate.*Test Sales Representative/i),
    ).toBeVisible();
    await expect(
      dialog.getByText(/Users assigned to this group will lose its permissions/i),
    ).toBeVisible();

    // Verify Cancel and Deactivate buttons are present
    const cancelButton = dialog.getByRole('button', { name: 'Cancel' });
    const confirmDeactivateButton = dialog.getByRole('button', { name: 'Deactivate' });
    await expect(cancelButton).toBeVisible();
    await expect(confirmDeactivateButton).toBeVisible();

    // Visual checkpoint 3: Confirmation dialog
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-deactivate-confirmation-dialog.png`,
      fullPage: true,
    });

    // ─── Step 5: Click Deactivate button in confirmation dialog ───
    await confirmDeactivateButton.click();

    // Wait for the success toast
    await expect(
      page.getByText('Access group deactivated'),
    ).toBeVisible({ timeout: 10_000 });

    // Verify redirected back to the access groups list
    await expect(
      page.getByRole('heading', { name: 'Access Groups' }),
    ).toBeVisible({ timeout: 10_000 });

    // Verify the deactivated group is no longer in the list
    await expect(page.getByText('TEST_SALES_REP')).not.toBeVisible({ timeout: 5_000 });

    // Visual checkpoint 4: Success toast and updated list
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-deactivated-success-toast.png`,
      fullPage: true,
    });
  });
});
