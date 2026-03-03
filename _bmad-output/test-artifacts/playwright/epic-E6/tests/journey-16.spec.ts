import { test, expect, type Page, type Route } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E6/journey-16';

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
    code: 'ADMIN',
    name: 'Administrators',
    description: 'Admin group with full system access',
    isSystem: true,
    isActive: true,
    userCount: 2,
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

const MOCK_CUSTOM_GROUP_DETAIL = {
  id: 'ag-003',
  code: 'SALES_REP',
  name: 'Sales Representative',
  description: 'Custom access for sales reps',
  isSystem: false,
  isActive: true,
  userCount: 2,
  companyId: 'comp-001',
  createdAt: '2026-02-01T00:00:00.000Z',
  updatedAt: '2026-02-01T00:00:00.000Z',
  createdBy: 'usr-001',
  updatedBy: 'usr-001',
  permissions: [
    {
      resourceCode: 'SYS_DASHBOARD',
      resourceName: 'Dashboard',
      resourceModule: 'System',
      resourceType: 'PAGE',
      canAccess: true,
      canNew: false,
      canView: true,
      canEdit: false,
      canDelete: false,
    },
    {
      resourceCode: 'SAL_ORDERS',
      resourceName: 'Sales Orders',
      resourceModule: 'Sales',
      resourceType: 'PAGE',
      canAccess: true,
      canNew: true,
      canView: true,
      canEdit: true,
      canDelete: false,
    },
  ],
  fieldOverrides: [],
};

const MOCK_RESOURCES = [
  {
    id: 'res-001',
    code: 'SYS_DASHBOARD',
    name: 'Dashboard',
    module: 'System',
    type: 'PAGE',
    parentCode: null,
    sortOrder: 1,
    icon: null,
    description: null,
    isActive: true,
  },
  {
    id: 'res-002',
    code: 'FIN_JOURNAL_ENTRIES',
    name: 'Journal Entries',
    module: 'Finance',
    type: 'PAGE',
    parentCode: null,
    sortOrder: 1,
    icon: null,
    description: null,
    isActive: true,
  },
  {
    id: 'res-003',
    code: 'SAL_ORDERS',
    name: 'Sales Orders',
    module: 'Sales',
    type: 'PAGE',
    parentCode: null,
    sortOrder: 1,
    icon: null,
    description: null,
    isActive: true,
  },
  {
    id: 'res-004',
    code: 'SAL_INVOICES',
    name: 'Sales Invoices',
    module: 'Sales',
    type: 'PAGE',
    parentCode: null,
    sortOrder: 2,
    icon: null,
    description: null,
    isActive: true,
  },
  {
    id: 'res-005',
    code: 'INV_ITEMS',
    name: 'Items',
    module: 'Inventory',
    type: 'PAGE',
    parentCode: null,
    sortOrder: 1,
    icon: null,
    description: null,
    isActive: true,
  },
];

/** Mutable copy of the access group detail — updated on field override PUT. */
let currentGroupDetail = { ...MOCK_CUSTOM_GROUP_DETAIL };

/** Set up all API mocks. */
async function mockApis(page: Page) {
  // Reset mutable state
  currentGroupDetail = {
    ...MOCK_CUSTOM_GROUP_DETAIL,
    fieldOverrides: [],
  };

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

  // Access groups list (with query params)
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

  // Access group detail (ag-003 — the custom group we'll test with)
  await page.route('**/api/v1/system/access-groups/ag-003', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: currentGroupDetail,
        }),
      });
    } else {
      await route.continue();
    }
  });

  // Field overrides PUT endpoint
  await page.route(
    '**/api/v1/system/access-groups/ag-003/field-overrides',
    async (route: Route) => {
      if (route.request().method() === 'PUT') {
        const body = route.request().postDataJSON() as {
          fieldOverrides: Array<{
            resourceCode: string;
            fieldPath: string;
            visibility: string;
          }>;
        };

        // Update mutable state with the saved overrides
        currentGroupDetail = {
          ...currentGroupDetail,
          fieldOverrides: body.fieldOverrides.map((fo) => ({
            resourceCode: fo.resourceCode,
            resourceName:
              MOCK_RESOURCES.find((r) => r.code === fo.resourceCode)?.name ??
              fo.resourceCode,
            fieldPath: fo.fieldPath,
            visibility: fo.visibility as 'VISIBLE' | 'READ_ONLY' | 'HIDDEN',
          })),
        };

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              accessGroupId: 'ag-003',
              overrideCount: body.fieldOverrides.length,
              fieldOverrides: currentGroupDetail.fieldOverrides,
            },
          }),
        });
      } else {
        await route.continue();
      }
    },
  );

  // Resources list (with query params)
  await page.route('**/api/v1/system/resources?*', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: MOCK_RESOURCES,
          meta: { hasMore: false },
        }),
      });
    } else {
      await route.continue();
    }
  });

  // Resources list (no query params)
  await page.route('**/api/v1/system/resources', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: MOCK_RESOURCES,
          meta: { hasMore: false },
        }),
      });
    } else {
      await route.continue();
    }
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

test.describe('Journey 16: Configure Field Overrides on Access Group', () => {
  test('Select resource, add field override, set visibility to Hidden, and save', async ({
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

    // Wait for access group list page to load
    await expect(
      page.getByRole('heading', { name: 'Access Groups' }),
    ).toBeVisible({ timeout: 10_000 });

    // Verify table shows access groups
    const table = page.getByRole('table');
    await expect(table).toBeVisible({ timeout: 5_000 });

    // Verify our custom group "Sales Representative" is in the list
    await expect(page.getByText('Sales Representative')).toBeVisible({ timeout: 5_000 });

    // ─── Step 2: Click on a custom (non-system) access group row ───
    // Re-hide devtools in case they re-rendered
    await hideDevtools(page);

    // Click the "Sales Representative" row
    await page.getByText('Sales Representative').first().click();

    // Wait for the access group detail page to load
    await expect(
      page.getByRole('heading', { name: 'Sales Representative' }),
    ).toBeVisible({ timeout: 10_000 });

    // Verify detail page elements: Code field shows SALES_REP in disabled input
    await expect(page.locator('input[value="SALES_REP"]')).toBeVisible({ timeout: 5_000 });

    // ─── Step 3: Click "Field Overrides" tab ───
    // Re-hide devtools after navigation
    await hideDevtools(page);

    const fieldOverridesTab = page.getByRole('tab', { name: 'Field Overrides' });
    await expect(fieldOverridesTab).toBeVisible({ timeout: 5_000 });
    await fieldOverridesTab.click();

    // Wait for the Field Overrides panel to be active
    await expect(fieldOverridesTab).toHaveAttribute('data-state', 'active', { timeout: 3_000 });

    // Verify resource selector combobox is visible (scope to main content to avoid global search combobox)
    const mainContent = page.getByRole('main', { name: 'Main content' });
    const resourceCombobox = mainContent.getByRole('combobox');
    await expect(resourceCombobox).toBeVisible({ timeout: 5_000 });

    // Verify empty state message
    await expect(
      page.getByText('Select a resource to configure field visibility overrides'),
    ).toBeVisible({ timeout: 5_000 });

    // Visual checkpoint 1: Field Overrides tab empty state
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-field-overrides-empty-state.png`,
      fullPage: true,
    });

    // ─── Step 4: Click resource selector combobox ───
    await resourceCombobox.click();

    // Wait for the popover to appear with search input
    const resourceSearch = page.getByPlaceholder('Search resources…');
    await expect(resourceSearch).toBeVisible({ timeout: 5_000 });

    // Verify resources are shown grouped by module in the combobox listbox
    // Use getByRole('option') to scope to combobox items only
    await expect(page.getByRole('option', { name: /Sales Orders/ })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('option', { name: /Journal Entries/ })).toBeVisible({ timeout: 5_000 });

    // Visual checkpoint 2: Resource combobox open
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-resource-combobox-open.png`,
      fullPage: true,
    });

    // ─── Step 5: Select a resource (Sales Orders) ───
    // Click on "Sales Orders" in the dropdown
    await page.getByRole('option', { name: /Sales Orders/ }).click();

    // Wait for the popover to close
    await expect(resourceSearch).not.toBeVisible({ timeout: 3_000 });

    // Verify the combobox now shows "Sales Orders" as selected
    await expect(resourceCombobox).toContainText('Sales Orders');

    // Verify empty overrides message for this resource
    await expect(
      page.getByText('No field overrides configured for this resource'),
    ).toBeVisible({ timeout: 5_000 });

    // Verify "Add Field Override" button is visible
    const addOverrideButton = page.getByRole('button', { name: 'Add Field Override' });
    await expect(addOverrideButton).toBeVisible({ timeout: 5_000 });

    // Visual checkpoint 3: Resource selected, empty overrides
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-resource-selected-empty-overrides.png`,
      fullPage: true,
    });

    // ─── Step 6: Click "Add Field Override" button ───
    await addOverrideButton.click();

    // Wait for the override table to appear with a new row
    const overrideTable = page.getByRole('table');
    await expect(overrideTable).toBeVisible({ timeout: 5_000 });

    // Verify new row has an empty field path input with placeholder
    const fieldPathInput = page.getByPlaceholder('e.g., costPrice');
    await expect(fieldPathInput).toBeVisible({ timeout: 5_000 });

    // Verify the default visibility is "Visible" — scope to the table to avoid matching tab text
    const overrideTableArea = mainContent.locator('[data-slot="table"]');
    await expect(overrideTableArea.getByText('Visible')).toBeVisible({ timeout: 3_000 });

    // Visual checkpoint 4: New override row
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-new-override-row.png`,
      fullPage: true,
    });

    // ─── Step 7: Fill in field path "costPrice" ───
    await fieldPathInput.fill('costPrice');

    // Verify the value was entered
    await expect(fieldPathInput).toHaveValue('costPrice');

    // ─── Step 8: Click the Visibility dropdown ───
    // The visibility select trigger is inside the table row
    // There should be two combobox/select elements: the resource selector and the visibility select
    // The visibility select shows "Visible" text
    const visibilityTrigger = page.locator('[data-slot="select-trigger"]').last();
    await expect(visibilityTrigger).toBeVisible({ timeout: 3_000 });
    await visibilityTrigger.click();

    // Wait for select dropdown to appear
    await page.waitForTimeout(300);

    // Verify dropdown options: Visible, Read Only, Hidden
    await expect(page.getByRole('option', { name: 'Visible' })).toBeVisible({ timeout: 3_000 });
    await expect(page.getByRole('option', { name: 'Read Only' })).toBeVisible({ timeout: 3_000 });
    await expect(page.getByRole('option', { name: 'Hidden' })).toBeVisible({ timeout: 3_000 });

    // ─── Step 9: Select "Hidden" ───
    await page.getByRole('option', { name: 'Hidden' }).click();

    // Wait for the dropdown to close
    await page.waitForTimeout(300);

    // Verify the visibility now shows "Hidden"
    await expect(visibilityTrigger).toContainText('Hidden');

    // Verify the "Save Field Overrides" button is now enabled
    const saveButton = page.getByRole('button', { name: 'Save Field Overrides' });
    await expect(saveButton).toBeVisible({ timeout: 5_000 });
    await expect(saveButton).toBeEnabled({ timeout: 3_000 });

    // Visual checkpoint 5: costPrice = Hidden
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-9-visibility-hidden.png`,
      fullPage: true,
    });

    // ─── Step 10: Click "Save Field Overrides" ───
    await saveButton.click();

    // Wait for the success toast
    const successToast = page.getByText('Field overrides saved successfully');
    await expect(successToast).toBeVisible({ timeout: 10_000 });

    // Save button should return to disabled state
    await expect(saveButton).toBeDisabled({ timeout: 5_000 });

    // Override row should still be present with costPrice = Hidden
    await expect(fieldPathInput).toHaveValue('costPrice');
    await expect(visibilityTrigger).toContainText('Hidden');

    // Visual checkpoint 6: Save success
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-10-save-success.png`,
      fullPage: true,
    });
  });
});
