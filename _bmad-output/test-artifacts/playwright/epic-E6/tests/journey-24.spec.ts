import { test, expect, type Page } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E6/journey-24';

// --- Mock data ---

const MOCK_LOGIN_RESPONSE = {
  success: true,
  data: {
    accessToken: 'mock-admin-access-token-jwt',
    refreshToken: 'mock-admin-refresh-token-jwt',
    expiresIn: 3600,
    user: {
      id: 'usr-admin',
      email: 'admin@nexa-test.com',
      firstName: 'Admin',
      lastName: 'User',
      role: 'SUPER_ADMIN',
      enabledModules: [
        'system', 'finance', 'ar', 'ap', 'sales',
        'purchasing', 'inventory', 'crm', 'hr',
        'manufacturing', 'reporting',
      ],
      tenantId: 'tenant-001',
      tenantName: 'Demo Company',
      mfaEnabled: false,
    },
    requiresMfa: false,
  },
};

const ALL_MODULES = [
  'system', 'finance', 'ar', 'ap', 'sales',
  'purchasing', 'inventory', 'crm', 'hr',
  'manufacturing', 'reporting',
];

function buildFullPermissions() {
  const permissions: Record<
    string,
    { canAccess: boolean; canNew: boolean; canView: boolean; canEdit: boolean; canDelete: boolean }
  > = {};
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
    userId: 'usr-admin',
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

const MOCK_ACCESS_GROUPS_LIST = {
  success: true,
  data: [
    {
      id: 'ag-superadmin',
      code: 'SUPER_ADMIN',
      name: 'Super Administrators',
      description: 'Full system access',
      isSystem: true,
      isActive: true,
      userCount: 2,
      createdAt: '2026-01-15T10:00:00Z',
    },
    {
      id: 'ag-sales',
      code: 'SALES_TEAM',
      name: 'Sales Team',
      description: 'Access to sales and CRM modules',
      isSystem: false,
      isActive: true,
      userCount: 5,
      createdAt: '2026-01-20T14:30:00Z',
    },
    {
      id: 'ag-readonly',
      code: 'READ_ONLY',
      name: 'Read Only',
      description: 'View-only access across all modules',
      isSystem: true,
      isActive: true,
      userCount: 3,
      createdAt: '2026-01-15T10:00:00Z',
    },
  ],
  meta: { total: 3, hasMore: false },
};

const MOCK_SALES_TEAM_DETAIL = {
  success: true,
  data: {
    id: 'ag-sales',
    code: 'SALES_TEAM',
    name: 'Sales Team',
    description: 'Access to sales and CRM modules',
    isSystem: false,
    isActive: true,
    userCount: 5,
    companyId: 'comp-001',
    createdAt: '2026-01-20T14:30:00Z',
    updatedAt: '2026-02-10T09:00:00Z',
    createdBy: 'usr-admin',
    updatedBy: 'usr-admin',
    permissions: [
      {
        resourceCode: 'SALES_QUOTES',
        resourceName: 'Quotes',
        resourceModule: 'sales',
        resourceType: 'PAGE',
        canAccess: true,
        canNew: true,
        canView: true,
        canEdit: true,
        canDelete: false,
      },
      {
        resourceCode: 'CRM_LEADS',
        resourceName: 'Leads',
        resourceModule: 'crm',
        resourceType: 'PAGE',
        canAccess: true,
        canNew: true,
        canView: true,
        canEdit: true,
        canDelete: false,
      },
    ],
    fieldOverrides: [],
  },
};

/** Set up all API mocks. */
async function mockApis(page: Page) {
  // Login endpoint
  await page.route('**/api/v1/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_LOGIN_RESPONSE),
    });
  });

  // Permissions endpoint
  await page.route('**/api/v1/system/my-permissions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_PERMISSIONS_RESPONSE),
    });
  });

  // Companies endpoint
  await page.route('**/api/v1/system/companies', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_COMPANIES_RESPONSE),
    });
  });

  // Access group detail endpoint (Sales Team) — registered before list so it gets higher LIFO priority
  await page.route('**/api/v1/system/access-groups/ag-sales**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_SALES_TEAM_DETAIL),
    });
  });

  // Access groups list endpoint (glob includes ** suffix to match query strings)
  await page.route('**/api/v1/system/access-groups**', async (route) => {
    const url = route.request().url();
    // If the URL has a specific ID path segment, let it fall through to the detail handler
    if (/\/access-groups\/[a-zA-Z0-9-]+/.test(url)) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_ACCESS_GROUPS_LIST),
    });
  });

  // Catch-all for other API routes
  await page.route('**/api/v1/**', async (route) => {
    const url = route.request().url();
    if (
      url.includes('/auth/login') ||
      url.includes('/system/my-permissions') ||
      url.includes('/system/companies') ||
      url.includes('/system/access-groups')
    ) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [], meta: { total: 0, hasMore: false } }),
    });
  });
}

/** Log in and wait for dashboard. */
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

/** Navigate via client-side routing (preserves SPA state). */
async function navigateClientSide(page: Page, path: string) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await page.waitForTimeout(1_500);
}

test.describe('Journey 24: ActionBar Status-Driven Actions Demo', () => {
  test('ActionBar shows status-driven overflow actions and confirmation dialog for destructive action', async ({
    page,
  }) => {
    // Set up all API mocks
    await mockApis(page);

    // Login first
    await performLogin(page);

    // ─── Step 1: Navigate to /system/access-groups ───
    await navigateClientSide(page, '/system/access-groups');

    // Verify the access group list page loaded
    await expect(page.locator('main#main-content')).toBeVisible({ timeout: 5_000 });

    // Wait for the table to render with data
    // Look for the custom "Sales Team" row to confirm data loaded
    await expect(page.getByText('Sales Team')).toBeVisible({ timeout: 5_000 });

    // Visual checkpoint 1: Access Group List Page
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-access-group-list.png`,
      fullPage: true,
    });

    // ─── Step 2: Click on the custom (non-system) "Sales Team" access group ───
    // Click the row containing "Sales Team"
    const salesTeamRow = page.getByRole('row', { name: /Sales Team/i });
    await salesTeamRow.click();

    // Wait for detail page to load — verify the heading shows the group name
    await expect(page.getByRole('heading', { name: /Sales Team/i })).toBeVisible({
      timeout: 10_000,
    });

    // Verify Save button is present and disabled (no changes yet)
    const saveButton = page.getByRole('button', { name: /Save/i });
    await expect(saveButton).toBeVisible();
    await expect(saveButton).toBeDisabled();

    // Verify overflow menu trigger (three-dots) is present
    const overflowTrigger = page.getByRole('button', { name: /More actions/i });
    await expect(overflowTrigger).toBeVisible();

    // Verify this is NOT a system group (no system banner alert)
    // System groups show an info banner with role="alert" — it should be absent for custom groups
    await expect(page.getByRole('alert')).not.toBeVisible();

    // Visual checkpoint 2: Detail page with action bar
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-detail-page-action-bar.png`,
      fullPage: true,
    });

    // ─── Step 3: Click the overflow menu trigger (three dots) ───
    await overflowTrigger.click();

    // Verify the overflow menu is open with the Deactivate option
    const deactivateItem = page.getByRole('menuitem', { name: /Deactivate/i });
    await expect(deactivateItem).toBeVisible({ timeout: 3_000 });

    // Verify the Deactivate option is enabled (not disabled) for custom groups
    await expect(deactivateItem).not.toHaveAttribute('data-disabled');

    // Visual checkpoint 3: Overflow menu open
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-overflow-menu-open.png`,
      fullPage: true,
    });

    // ─── Step 4: Click "Deactivate" in the overflow menu ───
    await deactivateItem.click();

    // Verify the confirmation dialog opens
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 3_000 });

    // Verify dialog title
    await expect(dialog.getByText(/Deactivate Access Group/i)).toBeVisible();

    // Verify dialog description mentions the group name
    await expect(dialog.getByText(/Sales Team/i)).toBeVisible();

    // Verify Cancel button (ghost variant) is present
    const cancelButton = dialog.getByRole('button', { name: /Cancel/i });
    await expect(cancelButton).toBeVisible();

    // Verify Deactivate confirm button (destructive variant) is present
    const confirmButton = dialog.getByRole('button', { name: /Deactivate/i });
    await expect(confirmButton).toBeVisible();

    // Visual checkpoint 4: Deactivation confirmation dialog
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-deactivate-confirmation-dialog.png`,
      fullPage: true,
    });

    // ─── Step 5: Click Cancel to dismiss the dialog ───
    await cancelButton.click();

    // Verify dialog is closed
    await expect(dialog).not.toBeVisible({ timeout: 3_000 });

    // Verify we're still on the detail page (not redirected)
    await expect(page.getByRole('heading', { name: /Sales Team/i })).toBeVisible();

    // Verify Save button is still disabled (no changes were made)
    await expect(saveButton).toBeDisabled();

    // Verify overflow trigger is still present
    await expect(overflowTrigger).toBeVisible();

    // Visual checkpoint 5: Dialog dismissed, back to normal state
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-dialog-dismissed.png`,
      fullPage: true,
    });
  });
});
