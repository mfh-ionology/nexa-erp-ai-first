import { test, expect, type Page } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E6/journey-23';

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

  // Catch-all for any other API routes
  await page.route('**/api/v1/**', async (route) => {
    const url = route.request().url();
    if (
      url.includes('/auth/login') ||
      url.includes('/system/my-permissions') ||
      url.includes('/system/companies')
    ) {
      await route.fallback();
      return;
    }
    // Return empty data array for list pages (resources, access-groups)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [], meta: { total: 0, hasMore: false } }),
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
  await page.waitForTimeout(1_500);
}

test.describe('Journey 23: Breadcrumb Navigation and Skip Link', () => {
  test('Breadcrumb trail renders correctly and skip-to-content link works', async ({
    page,
  }) => {
    // Set up all API mocks before navigation
    await mockApis(page);

    // Login first
    await performLogin(page);

    // ─── Step 1: Navigate to /system/resources (client-side to preserve auth) ───
    await navigateClientSide(page, '/system/resources');

    // Verify page loaded by checking for a heading or page content
    await expect(page.locator('main#main-content')).toBeVisible({ timeout: 5_000 });

    // Check the page-level breadcrumbs (inside the page content area)
    // The PageHeader component renders breadcrumbs with aria-label="breadcrumb"
    const pageBreadcrumbNav = page.locator('nav[aria-label="breadcrumb"]');
    await expect(pageBreadcrumbNav).toBeVisible({ timeout: 5_000 });

    // Verify "System" link is in the page breadcrumbs
    const systemLink = pageBreadcrumbNav.getByRole('link', { name: 'System' });
    await expect(systemLink).toBeVisible();

    // Verify "Resource Registry" is the current page in breadcrumbs
    // Use data-slot="breadcrumb-page" to target the BreadcrumbPage component specifically
    // (TanStack Router Link also adds aria-current="page" on active links)
    const currentPageCrumb = pageBreadcrumbNav.locator('[data-slot="breadcrumb-page"]');
    await expect(currentPageCrumb).toBeVisible();
    await expect(currentPageCrumb).toHaveText(/Resource Registry/i);
    await expect(currentPageCrumb).toHaveAttribute('aria-current', 'page');

    // Verify separator is present (ChevronRight SVG rendered as separator)
    const separator = pageBreadcrumbNav.locator('[data-slot="breadcrumb-separator"]');
    await expect(separator).toBeVisible();

    // Also check the global breadcrumbs (from the app-layout Breadcrumbs component)
    // Uses aria-label="Breadcrumb" (capital B) vs page-level "breadcrumb" (lowercase)
    const globalBreadcrumbNav = page.locator('nav[aria-label="Breadcrumb"]');
    await expect(globalBreadcrumbNav).toBeVisible({ timeout: 5_000 });

    // Global breadcrumb shows "System" link and the last segment (from URL path)
    // Note: last segment uses fallback label since /system/resources isn't in nav config
    await expect(globalBreadcrumbNav.getByText('System')).toBeVisible();

    // Visual checkpoint 1: Resource Registry page with breadcrumbs
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-resource-registry-breadcrumbs.png`,
      fullPage: true,
    });

    // ─── Step 2: Click 'System' breadcrumb link ───
    // Click the "System" link in the page-level breadcrumbs to navigate to /system
    await systemLink.click();

    // Wait for navigation to /system
    await expect(page).toHaveURL(/\/system\b/, { timeout: 10_000 });

    // Visual checkpoint 2: System module root page
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-system-root-after-breadcrumb-click.png`,
      fullPage: true,
    });

    // ─── Step 3: Navigate to /system/access-groups (client-side) ───
    await navigateClientSide(page, '/system/access-groups');
    await expect(page.locator('main#main-content')).toBeVisible({ timeout: 5_000 });

    // ─── Step 4: Verify breadcrumbs show System > Access Groups ───
    const pageBreadcrumbNav2 = page.locator('nav[aria-label="breadcrumb"]');
    await expect(pageBreadcrumbNav2).toBeVisible({ timeout: 5_000 });

    // Verify "System" link exists
    const systemLink2 = pageBreadcrumbNav2.getByRole('link', { name: 'System' });
    await expect(systemLink2).toBeVisible();

    // Verify "Access Groups" is the current page
    const currentPageCrumb2 = pageBreadcrumbNav2.locator('[data-slot="breadcrumb-page"]');
    await expect(currentPageCrumb2).toBeVisible();
    await expect(currentPageCrumb2).toHaveText(/Access Groups/i);
    await expect(currentPageCrumb2).toHaveAttribute('aria-current', 'page');

    // Verify separator is present
    const separator2 = pageBreadcrumbNav2.locator('[data-slot="breadcrumb-separator"]');
    await expect(separator2).toBeVisible();

    // Visual checkpoint 3: Access Groups page with breadcrumbs
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-access-groups-breadcrumbs.png`,
      fullPage: true,
    });

    // ─── Step 5: Tab to focus 'Skip to content' link ───
    // The skip link is the first focusable element — it's sr-only until focused.
    // Press Tab from the beginning of the page to focus it.
    // First, move focus to the body/top of the page
    await page.keyboard.press('Tab');

    // Wait briefly for focus to settle
    await page.waitForTimeout(300);

    // The skip link should now be visible (it has focus:not-sr-only)
    const skipLink = page.getByRole('link', { name: /Skip to content/i });
    await expect(skipLink).toBeVisible({ timeout: 3_000 });

    // Verify the skip link points to #main-content
    await expect(skipLink).toHaveAttribute('href', '#main-content');

    // Visual checkpoint 4: Skip-to-content link visible on focus
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-skip-to-content-link-visible.png`,
      fullPage: true,
    });
  });
});
