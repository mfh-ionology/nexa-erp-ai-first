import { test, expect, type Page, type Route } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E6/journey-14';

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
    code: 'SALES_REP',
    name: 'Sales Representative',
    description: 'Custom access for sales reps',
    isSystem: false,
    isActive: true,
    userCount: 2,
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
  },
];

const FULL_ACCESS_GROUP_DETAIL = {
  id: 'ag-001',
  code: 'FULL_ACCESS',
  name: 'Full Access',
  description: 'System default full access group',
  isSystem: true,
  isActive: true,
  userCount: 3,
  companyId: 'comp-001',
  permissions: [
    {
      id: 'perm-001',
      resourceCode: 'SYS_USERS',
      canAccess: true,
      canNew: true,
      canView: true,
      canEdit: true,
      canDelete: true,
    },
    {
      id: 'perm-002',
      resourceCode: 'SYS_COMPANIES',
      canAccess: true,
      canNew: true,
      canView: true,
      canEdit: true,
      canDelete: true,
    },
    {
      id: 'perm-003',
      resourceCode: 'SYS_ACCESS_GROUPS',
      canAccess: true,
      canNew: true,
      canView: true,
      canEdit: true,
      canDelete: true,
    },
  ],
  fieldOverrides: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  createdBy: 'usr-001',
  updatedBy: 'usr-001',
};

const ALL_RESOURCES = [
  { id: 'res-001', code: 'SYS_USERS', name: 'Users', module: 'System', type: 'PAGE', parentCode: null, sortOrder: 100, icon: null, description: 'User management page', isActive: true },
  { id: 'res-002', code: 'SYS_COMPANIES', name: 'Companies', module: 'System', type: 'PAGE', parentCode: null, sortOrder: 200, icon: null, description: 'Company management page', isActive: true },
  { id: 'res-003', code: 'SYS_ACCESS_GROUPS', name: 'Access Groups', module: 'System', type: 'PAGE', parentCode: null, sortOrder: 300, icon: null, description: 'Access group management', isActive: true },
];

/** Set up all API mocks. */
async function mockApis(page: Page) {
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
    if (route.request().method() === 'GET') {
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
    if (route.request().method() === 'GET') {
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

  // FULL_ACCESS detail endpoint
  await page.route('**/api/v1/system/access-groups/ag-001', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: FULL_ACCESS_GROUP_DETAIL,
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

test.describe('Journey 14: System Access Group Protection Rules', () => {
  test('Verify system access groups show protection banner and have Deactivate disabled', async ({
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

    // Verify system groups are in the list with System badges
    await expect(page.getByText('FULL_ACCESS')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('READ_ONLY')).toBeVisible({ timeout: 5_000 });

    // Verify "System" badges are present for system groups
    // The list renders a Badge with text "System" for isSystem rows
    const systemBadges = page.getByText('System', { exact: true });
    await expect(systemBadges.first()).toBeVisible({ timeout: 5_000 });

    // Visual checkpoint 1: Access Group list with system badges
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-access-group-list-system-badges.png`,
      fullPage: true,
    });

    // ─── Step 2: Click on the FULL_ACCESS system group row ───
    await page.getByText('FULL_ACCESS').click();

    // Wait for the detail page to load
    await expect(
      page.getByRole('heading', { name: 'Full Access' }),
    ).toBeVisible({ timeout: 10_000 });

    // Verify the system protection banner is displayed
    const systemBanner = page.getByRole('alert');
    await expect(systemBanner).toBeVisible({ timeout: 5_000 });
    await expect(systemBanner).toContainText(
      'This is a system access group',
    );
    await expect(systemBanner).toContainText(
      'cannot be deactivated',
    );

    // Verify the Code field is read-only/disabled
    const codeInput = page.getByLabel('Code');
    await expect(codeInput).toBeVisible();
    await expect(codeInput).toBeDisabled();
    await expect(codeInput).toHaveValue('FULL_ACCESS');

    // Visual checkpoint 2: System group detail with protection banner
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-system-group-detail-banner.png`,
      fullPage: true,
    });

    // ─── Step 3: Click overflow menu (more actions) button ───
    // Re-hide devtools in case they re-rendered after navigation
    await hideDevtools(page);

    const moreActionsButton = page.getByRole('button', { name: 'More actions' });
    await expect(moreActionsButton).toBeVisible({ timeout: 5_000 });
    await moreActionsButton.click();

    // Wait for the dropdown menu to appear
    const deactivateMenuItem = page.getByRole('menuitem', { name: 'Deactivate' });
    await expect(deactivateMenuItem).toBeVisible({ timeout: 5_000 });

    // Verify the Deactivate option is DISABLED for system groups
    // In Radix UI DropdownMenu, disabled items have data-disabled attribute
    await expect(deactivateMenuItem).toHaveAttribute('data-disabled', { timeout: 5_000 });

    // Visual checkpoint 3: Overflow menu with Deactivate disabled
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-overflow-menu-deactivate-disabled.png`,
      fullPage: true,
    });
  });
});
