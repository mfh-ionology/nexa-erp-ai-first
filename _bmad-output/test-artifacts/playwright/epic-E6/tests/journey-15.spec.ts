import { test, expect, type Page, type Route } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E6/journey-15';

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

const MOCK_USERS = [
  {
    id: 'usr-001',
    firstName: 'Admin',
    lastName: 'Demo',
    email: 'admin@nexa-test.com',
    role: 'ADMIN',
    accessGroupCount: 2,
    isActive: true,
    lastLoginAt: '2026-02-20T10:30:00.000Z',
  },
  {
    id: 'usr-002',
    firstName: 'Sarah',
    lastName: 'Jones',
    email: 'sarah.jones@nexa-test.com',
    role: 'STAFF',
    accessGroupCount: 1,
    isActive: true,
    lastLoginAt: '2026-02-19T14:00:00.000Z',
  },
  {
    id: 'usr-003',
    firstName: 'Mike',
    lastName: 'Wilson',
    email: 'mike.wilson@nexa-test.com',
    role: 'VIEWER',
    accessGroupCount: 1,
    isActive: false,
    lastLoginAt: null,
  },
];

const MOCK_USER_DETAIL = {
  id: 'usr-001',
  firstName: 'Admin',
  lastName: 'Demo',
  email: 'admin@nexa-test.com',
  role: 'ADMIN',
  isActive: true,
  lastLoginAt: '2026-02-20T10:30:00.000Z',
  accessGroupCount: 2,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-02-20T10:30:00.000Z',
};

const MOCK_USER_ACCESS_GROUPS = [
  {
    id: 'ag-001',
    code: 'FULL_ACCESS',
    name: 'Full Access',
    description: 'System default full access group',
    isSystem: true,
    assignedBy: 'System',
    assignedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ag-002',
    code: 'ADMIN',
    name: 'Administrators',
    description: 'Admin group with full system access',
    isSystem: true,
    assignedBy: 'System',
    assignedAt: '2026-01-01T00:00:00.000Z',
  },
];

const MOCK_ALL_ACCESS_GROUPS = [
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
    code: 'VIEW_ONLY',
    name: 'View Only',
    description: 'Read-only access to all resources',
    isSystem: false,
    isActive: true,
    userCount: 1,
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
  },
  {
    id: 'ag-004',
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

/** Track mutable state of user's access groups for mock responses. */
let currentUserAccessGroups = [...MOCK_USER_ACCESS_GROUPS];

/** Set up all API mocks. */
async function mockApis(page: Page) {
  // Reset mutable state
  currentUserAccessGroups = [...MOCK_USER_ACCESS_GROUPS];

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

  // Users list (with query params for search/pagination)
  await page.route('**/api/v1/system/users?*', async (route: Route) => {
    if (route.request().method() === 'GET') {
      const url = new URL(route.request().url());
      const search = url.searchParams.get('search')?.toLowerCase() ?? '';
      const filtered = search
        ? MOCK_USERS.filter(
            (u) =>
              `${u.firstName} ${u.lastName}`.toLowerCase().includes(search) ||
              u.email.toLowerCase().includes(search),
          )
        : MOCK_USERS;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: filtered,
          meta: { hasMore: false },
        }),
      });
    } else {
      await route.continue();
    }
  });

  // Users list (no query params)
  await page.route('**/api/v1/system/users', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: MOCK_USERS,
          meta: { hasMore: false },
        }),
      });
    } else {
      await route.continue();
    }
  });

  // User detail
  await page.route('**/api/v1/system/users/usr-001', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: MOCK_USER_DETAIL,
        }),
      });
    } else {
      await route.continue();
    }
  });

  // User access groups (GET and PUT)
  await page.route(
    '**/api/v1/system/users/usr-001/access-groups',
    async (route: Route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: currentUserAccessGroups,
          }),
        });
      } else if (route.request().method() === 'PUT') {
        // Parse the request body to update our mutable state
        const body = route.request().postDataJSON() as {
          accessGroupIds: string[];
        };
        currentUserAccessGroups = body.accessGroupIds.map((id) => {
          // Try to find in current groups first
          const existing = currentUserAccessGroups.find((g) => g.id === id);
          if (existing) return existing;
          // Otherwise construct from all access groups
          const groupDef = MOCK_ALL_ACCESS_GROUPS.find((g) => g.id === id);
          return {
            id,
            code: groupDef?.code ?? id,
            name: groupDef?.name ?? id,
            description: groupDef?.description ?? '',
            isSystem: groupDef?.isSystem ?? false,
            assignedBy: 'Admin Demo',
            assignedAt: new Date().toISOString(),
          };
        });
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { count: currentUserAccessGroups.length },
          }),
        });
      } else {
        await route.continue();
      }
    },
  );

  // All access groups list (for combobox) — with query params
  await page.route(
    '**/api/v1/system/access-groups?*',
    async (route: Route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: MOCK_ALL_ACCESS_GROUPS,
            meta: { hasMore: false },
          }),
        });
      } else {
        await route.continue();
      }
    },
  );

  // All access groups list (for combobox) — no query params
  await page.route('**/api/v1/system/access-groups', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: MOCK_ALL_ACCESS_GROUPS,
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

test.describe('Journey 15: User List and Access Group Assignment', () => {
  test('View users, navigate to user detail, assign and remove access groups', async ({
    page,
  }) => {
    // Set up API mocks
    await mockApis(page);

    // Pre-condition: log in
    await performLogin(page);

    // Hide devtools overlays
    await hideDevtools(page);

    // ─── Step 1: Navigate to /system/users ───
    await page.evaluate(() => {
      window.history.pushState({}, '', '/system/users');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    // Wait for the "Users" page title
    await expect(
      page.getByRole('heading', { name: 'Users' }),
    ).toBeVisible({ timeout: 10_000 });

    // Verify table is visible with expected columns
    const table = page.getByRole('table');
    await expect(table).toBeVisible({ timeout: 5_000 });

    // Verify breadcrumb navigation (two nav elements exist: outer shell + inner breadcrumb)
    const breadcrumb = page.getByRole('navigation', { name: /breadcrumb/i }).first();
    await expect(breadcrumb).toBeVisible({ timeout: 5_000 });

    // Verify no "+ New" button (users created via auth)
    await expect(
      page.getByRole('button', { name: /new|create/i }),
    ).not.toBeVisible({ timeout: 2_000 });

    // Verify user rows are showing
    await expect(page.getByText('admin@nexa-test.com')).toBeVisible({ timeout: 5_000 });

    // Visual checkpoint 1: User list page
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-user-list-page.png`,
      fullPage: true,
    });

    // ─── Step 2: Search for "admin" ───
    const searchInput = page.getByRole('textbox', { name: /search/i });
    await expect(searchInput).toBeVisible({ timeout: 5_000 });
    await searchInput.fill('admin');

    // Wait for debounce (300ms) + network + render
    await page.waitForTimeout(500);

    // Verify the search filtered results — admin user should be visible
    await expect(page.getByText('admin@nexa-test.com')).toBeVisible({ timeout: 5_000 });

    // Non-matching users should not be visible after filtering
    // Sarah Jones doesn't match "admin"
    await expect(page.getByText('sarah.jones@nexa-test.com')).not.toBeVisible({
      timeout: 3_000,
    });

    // Visual checkpoint 2: Search filtered
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-search-filtered.png`,
      fullPage: true,
    });

    // ─── Step 3: Click first user row ───
    // Click on the "Admin Demo" text in the table row
    await page.getByText('Admin Demo').first().click();

    // Wait for the user detail page to load — heading should show user name
    await expect(
      page.getByRole('heading', { name: 'Admin Demo' }),
    ).toBeVisible({ timeout: 10_000 });

    // Verify the profile card is visible
    await expect(page.getByText('User Profile')).toBeVisible({ timeout: 5_000 });

    // Verify email field
    await expect(page.getByText('admin@nexa-test.com')).toBeVisible({ timeout: 5_000 });

    // Verify role badge (use exact match to avoid matching "Admin Demo", "admin@...", "Administrators")
    await expect(page.getByText('Admin', { exact: true })).toBeVisible({ timeout: 5_000 });

    // Verify Access Groups panel is visible
    await expect(page.getByText('Access Groups').first()).toBeVisible({
      timeout: 5_000,
    });

    // Verify assigned access group tags are visible
    await expect(page.getByText('Full Access')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Administrators')).toBeVisible({ timeout: 5_000 });

    // Verify Save button is disabled (no changes yet)
    const saveButton = page.getByRole('button', { name: 'Save Access Groups' });
    await expect(saveButton).toBeVisible({ timeout: 5_000 });
    await expect(saveButton).toBeDisabled();

    // Visual checkpoint 3: User detail page
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-user-detail-page.png`,
      fullPage: true,
    });

    // ─── Step 4: Click "Add Access Group" combobox trigger ───
    // Re-hide devtools in case they re-rendered after navigation
    await hideDevtools(page);

    const addGroupButton = page.getByRole('combobox', { name: 'Add Access Group' });
    await expect(addGroupButton).toBeVisible({ timeout: 5_000 });
    await addGroupButton.click();

    // Wait for the popover to appear with the command search input
    const comboboxSearch = page.getByPlaceholder('Search access groups…');
    await expect(comboboxSearch).toBeVisible({ timeout: 5_000 });

    // Verify available groups are shown (excluding already-assigned ones)
    // ag-001 (Full Access) and ag-002 (Administrators) are already assigned
    // So we should see View Only and Sales Representative
    await expect(page.getByText('View Only')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Sales Representative')).toBeVisible({ timeout: 5_000 });

    // Visual checkpoint 4: Combobox open
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-combobox-open.png`,
      fullPage: true,
    });

    // ─── Step 5: Search for "VIEW" in combobox ───
    await comboboxSearch.fill('VIEW');

    // Wait briefly for client-side filtering
    await page.waitForTimeout(200);

    // VIEW_ONLY / "View Only" should still be visible
    await expect(page.getByText('View Only')).toBeVisible({ timeout: 3_000 });

    // Sales Representative should be filtered out
    await expect(page.getByText('Sales Representative')).not.toBeVisible({
      timeout: 2_000,
    });

    // ─── Step 6: Select "View Only" from the combobox ───
    await page.getByText('View Only').click();

    // Wait for the popover to close and the tag to appear
    await page.waitForTimeout(300);

    // Verify "View Only" tag now appears in the assignment panel
    // The group list uses role="list" with aria-label="Access Groups"
    const groupList = page.getByRole('list', { name: 'Access Groups' });
    await expect(groupList.getByText('View Only')).toBeVisible({ timeout: 5_000 });

    // Verify Save button is now enabled (dirty state)
    await expect(saveButton).toBeEnabled({ timeout: 3_000 });

    // Visual checkpoint 5: VIEW_ONLY tag added
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-view-only-tag-added.png`,
      fullPage: true,
    });

    // ─── Step 7: Click "Save Access Groups" ───
    await saveButton.click();

    // Wait for the success toast to appear
    const successToast = page.getByText('Access groups updated successfully');
    await expect(successToast).toBeVisible({ timeout: 10_000 });

    // Save button should return to disabled state after successful save
    await expect(saveButton).toBeDisabled({ timeout: 5_000 });

    // All group tags should still be present
    await expect(groupList.getByText('Full Access')).toBeVisible({ timeout: 3_000 });
    await expect(groupList.getByText('Administrators')).toBeVisible({ timeout: 3_000 });
    await expect(groupList.getByText('View Only')).toBeVisible({ timeout: 3_000 });

    // Visual checkpoint 6: Save success toast
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-7-save-success-toast.png`,
      fullPage: true,
    });

    // ─── Step 8: Remove VIEW_ONLY tag ───
    // Click the X (remove) button on the View Only tag
    const removeViewOnly = page.getByRole('button', { name: /Remove View Only/i });
    await expect(removeViewOnly).toBeVisible({ timeout: 5_000 });
    await removeViewOnly.click();

    // Wait for the tag to be removed
    await page.waitForTimeout(200);

    // "View Only" should no longer be in the group list
    await expect(groupList.getByText('View Only')).not.toBeVisible({ timeout: 3_000 });

    // Other groups should still be present
    await expect(groupList.getByText('Full Access')).toBeVisible({ timeout: 3_000 });
    await expect(groupList.getByText('Administrators')).toBeVisible({ timeout: 3_000 });

    // Save button should be enabled again (unsaved changes)
    await expect(saveButton).toBeEnabled({ timeout: 3_000 });

    // Visual checkpoint 7: VIEW_ONLY tag removed
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-8-view-only-removed.png`,
      fullPage: true,
    });

    // ─── Step 9: Save again without VIEW_ONLY ───
    await saveButton.click();

    // Wait for success toast again (use .first() as prior toast may still be visible)
    await expect(
      page.getByText('Access groups updated successfully').first(),
    ).toBeVisible({ timeout: 10_000 });

    // Save button disabled again
    await expect(saveButton).toBeDisabled({ timeout: 5_000 });
  });
});
