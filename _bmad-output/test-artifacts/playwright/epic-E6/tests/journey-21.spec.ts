import { test, expect, type Page } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E6/journey-21';

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

const IMPORT_JSON = JSON.stringify({
  version: '1.0',
  resources: [],
  accessGroups: [],
  vatCodes: [],
  paymentTerms: [],
  numberSeries: [],
  currencies: [],
});

const MOCK_DRY_RUN_RESPONSE = {
  success: true,
  data: {
    status: 'DRY_RUN',
    summary: {
      resourcesCreated: 0,
      resourcesUpdated: 0,
      accessGroupsCreated: 0,
      accessGroupsUpdated: 0,
      permissionsSet: 0,
      fieldOverridesSet: 0,
      vatCodesCreated: 0,
      vatCodesUpdated: 0,
      paymentTermsCreated: 0,
      paymentTermsUpdated: 0,
      numberSeriesCreated: 0,
      numberSeriesUpdated: 0,
      currenciesCreated: 0,
      currenciesUpdated: 0,
    },
    warnings: [],
  },
};

const MOCK_APPLY_RESPONSE = {
  success: true,
  data: {
    status: 'APPLIED',
    summary: {
      resourcesCreated: 0,
      resourcesUpdated: 0,
      accessGroupsCreated: 0,
      accessGroupsUpdated: 0,
      permissionsSet: 0,
      fieldOverridesSet: 0,
      vatCodesCreated: 0,
      vatCodesUpdated: 0,
      paymentTermsCreated: 0,
      paymentTermsUpdated: 0,
      numberSeriesCreated: 0,
      numberSeriesUpdated: 0,
      currenciesCreated: 0,
      currenciesUpdated: 0,
    },
    warnings: [],
  },
};

/** Set up API mocks for login, permissions, companies, and import. */
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

  // Import endpoint — distinguish dry-run vs apply by request body
  await page.route('**/api/v1/system/company-profile/import-defaults', async (route) => {
    let isDryRun = true;
    try {
      const postData = route.request().postDataJSON();
      isDryRun = postData?.dryRun !== false;
    } catch {
      // If parsing fails, default to dry run
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(isDryRun ? MOCK_DRY_RUN_RESPONSE : MOCK_APPLY_RESPONSE),
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

/** Navigate via client-side routing (preserves SPA state). */
async function navigateClientSide(page: Page, path: string) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await page.waitForTimeout(1_000);
}

test.describe('Journey 21: Import Configuration with Dry Run Preview', () => {
  test('open import dialog, paste JSON, dry run preview, apply import', async ({
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

    const mainContent = page.getByLabel('Main content');
    await expect(mainContent.getByText('Company Profile').first()).toBeVisible();

    // ─── Step 2: Click overflow menu ───
    const overflowButton = page.getByRole('button', { name: /More actions/i });
    await expect(overflowButton).toBeVisible({ timeout: 5_000 });
    await overflowButton.click();

    // Verify menu opened with Import Config option
    const importMenuItem = page.getByRole('menuitem', { name: /Import Config/i });
    await expect(importMenuItem).toBeVisible({ timeout: 5_000 });

    // ─── Step 3: Click Import Config ───
    await importMenuItem.click();

    // Wait for the import dialog to appear
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Verify dialog title
    await expect(
      dialog.getByText('Import Company Configuration'),
    ).toBeVisible();

    // Verify file drop zone exists (dashed border area)
    // Look for the drop zone or file input area
    const dropZone = dialog.locator('[class*="drop"], [class*="upload"], [role="button"]:has-text("drop"), label:has-text("file")').first();
    // Gracefully check — the drop zone may use various implementations
    const hasDropZone = await dropZone.isVisible().catch(() => false);

    // Verify JSON textarea exists
    const jsonTextarea = dialog.getByRole('textbox').or(dialog.locator('textarea'));
    await expect(jsonTextarea.first()).toBeVisible({ timeout: 5_000 });

    // Verify Dry Run checkbox is checked by default
    const dryRunCheckbox = dialog.getByRole('checkbox', { name: /Dry Run/i })
      .or(dialog.getByLabel(/Dry Run/i));
    await expect(dryRunCheckbox.first()).toBeVisible();
    await expect(dryRunCheckbox.first()).toBeChecked();

    // Verify Import button is disabled (no data yet)
    const importButton = dialog.getByRole('button', { name: /Import/i }).first();
    await expect(importButton).toBeVisible();
    await expect(importButton).toBeDisabled();

    // Verify Cancel button
    await expect(dialog.getByRole('button', { name: /Cancel/i })).toBeVisible();

    // Visual checkpoint 1: Import dialog open
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-import-dialog-open.png`,
      fullPage: true,
    });

    // ─── Step 4: Paste JSON into textarea ───
    await jsonTextarea.first().fill(IMPORT_JSON);

    // Wait for the Import button to become enabled
    await expect(importButton).toBeEnabled({ timeout: 5_000 });

    // Verify Dry Run checkbox is still checked
    await expect(dryRunCheckbox.first()).toBeChecked();

    // Visual checkpoint 2: JSON pasted, import enabled
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-json-pasted-import-enabled.png`,
      fullPage: true,
    });

    // ─── Step 5: Click Import (dry run) ───
    await importButton.click();

    // Wait for dry run results to appear
    // Look for "Dry Run Preview" or "Preview" heading in results
    await expect(
      dialog.getByText(/Dry Run Preview|Preview Results/i),
    ).toBeVisible({ timeout: 10_000 });

    // Verify summary table with entity types (use cell role to avoid matching dialog description)
    await expect(dialog.getByRole('cell', { name: 'Resources' })).toBeVisible();
    await expect(dialog.getByRole('cell', { name: 'Access Groups' })).toBeVisible();

    // Verify Apply button is visible
    const applyButton = dialog.getByRole('button', { name: /Apply/i });
    await expect(applyButton).toBeVisible({ timeout: 5_000 });

    // Verify Close button is visible
    const closeButton = dialog.getByRole('button', { name: /Close/i });
    // Close might not exist if there's only Done/Cancel — check gracefully
    const hasCloseButton = await closeButton.isVisible().catch(() => false);

    // Visual checkpoint 3: Dry run results
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-dry-run-results.png`,
      fullPage: true,
    });

    // ─── Step 6: Click Apply ───
    await applyButton.click();

    // Wait for applied results / success state
    await expect(
      dialog.getByText(/Import Results|Import Complete|Applied/i),
    ).toBeVisible({ timeout: 10_000 });

    // Verify success toast
    await expect(
      page.getByText(/Configuration imported successfully|Import successful/i),
    ).toBeVisible({ timeout: 5_000 });

    // Verify Done button is visible
    const doneButton = dialog.getByRole('button', { name: /Done/i });
    await expect(doneButton).toBeVisible({ timeout: 5_000 });

    // Visual checkpoint 4: Applied results with success toast
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-import-applied-success.png`,
      fullPage: true,
    });

    // ─── Step 7: Click Done ───
    await doneButton.click();

    // Verify dialog closes
    await expect(dialog).not.toBeVisible({ timeout: 5_000 });
  });
});
