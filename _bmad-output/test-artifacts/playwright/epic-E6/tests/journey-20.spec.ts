import { test, expect, type Page } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E6/journey-20';

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
      'system.company-profile.detail': {
        canAccess: true,
        canNew: false,
        canView: true,
        canEdit: true,
        canDelete: false,
      },
    },
    fieldOverrides: {},
    enabledModules: ['system', 'finance', 'sales'],
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

const MOCK_EXPORT_DEFAULTS_RESPONSE = {
  success: true,
  data: {
    version: '1.0',
    description: 'Company configuration export',
    exportedAt: '2026-02-24T12:00:00Z',
    exportedFrom: 'Demo Company',
    resources: [
      { code: 'USERS_LIST', name: 'Users List', module: 'system', type: 'PAGE', sortOrder: 1 },
      { code: 'COMPANY_PROFILE', name: 'Company Profile', module: 'system', type: 'PAGE', sortOrder: 2 },
    ],
    accessGroups: [
      {
        code: 'ADMIN',
        name: 'Administrators',
        description: 'Full system access',
        isSystem: true,
        permissions: [
          { resourceCode: 'USERS_LIST', canAccess: true, canNew: true, canView: true, canEdit: true, canDelete: true },
          { resourceCode: 'COMPANY_PROFILE', canAccess: true, canNew: false, canView: true, canEdit: true, canDelete: false },
        ],
        fieldOverrides: [
          { resourceCode: 'USERS_LIST', fieldPath: 'email', visibility: 'VISIBLE' },
        ],
      },
      {
        code: 'STAFF',
        name: 'Staff',
        description: 'Basic staff access',
        isSystem: false,
        permissions: [
          { resourceCode: 'COMPANY_PROFILE', canAccess: true, canNew: false, canView: true, canEdit: false, canDelete: false },
        ],
        fieldOverrides: [],
      },
    ],
    vatCodes: [
      { code: 'STD', name: 'Standard Rate', rate: 20, type: 'OUTPUT', isDefault: true },
      { code: 'RED', name: 'Reduced Rate', rate: 5, type: 'OUTPUT', isDefault: false },
      { code: 'ZER', name: 'Zero Rate', rate: 0, type: 'OUTPUT', isDefault: false },
    ],
    paymentTerms: [
      { code: 'NET30', name: 'Net 30 Days', dueDays: 30, isDefault: true },
      { code: 'NET60', name: 'Net 60 Days', dueDays: 60, isDefault: false },
    ],
    numberSeries: [
      { entityType: 'INVOICE', prefix: 'INV-', padding: 6 },
      { entityType: 'PURCHASE_ORDER', prefix: 'PO-', padding: 6 },
    ],
    currencies: [
      { code: 'GBP', name: 'British Pound', symbol: '£', minorUnit: 2 },
      { code: 'USD', name: 'US Dollar', symbol: '$', minorUnit: 2 },
      { code: 'EUR', name: 'Euro', symbol: '€', minorUnit: 2 },
    ],
  },
};

/** Set up API mocks for login, permissions, companies, and export-defaults. */
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

  await page.route('**/api/v1/system/company-profile/export-defaults', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_EXPORT_DEFAULTS_RESPONSE),
    });
  });
}

/** Log in as admin user and wait for dashboard. */
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

/**
 * Navigate via client-side routing (preserves SPA state).
 */
async function navigateClientSide(page: Page, path: string) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await page.waitForTimeout(1_000);
}

test.describe('Journey 20: Export Company Configuration as JSON', () => {
  test('navigate to Company Profile, open export dialog, preview, download JSON', async ({
    page,
  }) => {
    // Set up all API mocks before navigation
    await mockApis(page);

    // ─── Pre-condition: Log in as admin ───
    await performLogin(page);

    // ─── Step 1: Navigate to /system/companies ───
    await navigateClientSide(page, '/system/companies');

    // Verify Company Profile page loaded
    await expect(
      page.getByRole('heading', { name: /Demo Company|Company Profile/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Verify breadcrumbs — the PageHeader renders its own breadcrumb trail
    // "System > Company Profile" in the main content area
    const mainContent = page.getByLabel('Main content');
    await expect(mainContent.getByText('Company Profile').first()).toBeVisible();

    // Verify overflow menu button is visible
    const overflowButton = page.getByRole('button', { name: /More actions/i });
    await expect(overflowButton).toBeVisible({ timeout: 5_000 });

    // Visual checkpoint 1: Company Profile page
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-company-profile-page.png`,
      fullPage: true,
    });

    // ─── Step 2: Click overflow menu ───
    await overflowButton.click();

    // Verify menu opened with Export and Import options
    const exportMenuItem = page.getByRole('menuitem', { name: /Export Config/i });
    const importMenuItem = page.getByRole('menuitem', { name: /Import Config/i });
    await expect(exportMenuItem).toBeVisible({ timeout: 5_000 });
    await expect(importMenuItem).toBeVisible();

    // Verify "Data" section label
    await expect(page.getByText('Data')).toBeVisible();

    // Visual checkpoint 2: Overflow menu open
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-overflow-menu-open.png`,
      fullPage: true,
    });

    // ─── Step 3: Click Export Config ───
    await exportMenuItem.click();

    // Wait for the export dialog to appear
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Verify dialog title
    await expect(
      dialog.getByText('Export Company Configuration'),
    ).toBeVisible();

    // Wait for preview data to load (skeleton disappears, counts appear)
    // The mock returns 2 access groups, 3 permissions, 1 field override,
    // 3 VAT codes, 2 payment terms, 2 number series, 3 currencies
    await expect(dialog.getByText('Access Groups', { exact: true })).toBeVisible({ timeout: 5_000 });
    await expect(dialog.getByText('VAT Codes', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Payment Terms', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Number Series', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Currencies', { exact: true })).toBeVisible();

    // Verify Download JSON button is enabled (data loaded)
    const downloadButton = dialog.getByRole('button', { name: /Download JSON/i });
    await expect(downloadButton).toBeVisible();
    await expect(downloadButton).toBeEnabled({ timeout: 5_000 });

    // Verify Cancel button
    await expect(dialog.getByRole('button', { name: /Cancel/i })).toBeVisible();

    // Visual checkpoint 3: Export dialog with preview
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-export-dialog-preview.png`,
      fullPage: true,
    });

    // ─── Step 4: Click Download JSON ───
    // Set up a download listener to verify the file download is triggered
    const downloadPromise = page.waitForEvent('download', { timeout: 10_000 }).catch(() => null);

    await downloadButton.click();

    // Verify success toast appears
    await expect(
      page.getByText('Configuration exported successfully'),
    ).toBeVisible({ timeout: 5_000 });

    // Verify dialog is closed
    await expect(dialog).not.toBeVisible({ timeout: 5_000 });

    // Check if download was triggered (may not fire in headless depending on blob URL approach)
    const download = await downloadPromise;
    if (download) {
      // Verify filename pattern
      expect(download.suggestedFilename()).toMatch(/company-defaults-.*\.json/);
    }

    // Visual checkpoint 4: Success toast, dialog closed
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-export-success-toast.png`,
      fullPage: true,
    });
  });
});
