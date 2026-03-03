import { test, expect, type Page } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E6/journey-11';

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

  // Access groups create endpoint — return 409 CONFLICT for duplicate code
  await page.route('**/api/v1/system/access-groups', async (route) => {
    const method = route.request().method();
    if (method === 'POST') {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: {
            code: 'DUPLICATE_CODE',
            message: 'An access group with this code already exists',
          },
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

test.describe('Journey 11: Access Group Create - Duplicate Code Error', () => {
  test('Submit form with existing code, expect 409 inline error on Code field', async ({
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

    // ─── Step 1: Navigate to /system/access-groups/new ───
    await page.evaluate(() => {
      window.history.pushState({}, '', '/system/access-groups/new');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    // Wait for the create form page heading
    await expect(
      page.getByRole('heading', { name: 'Create Access Group' }),
    ).toBeVisible({ timeout: 10_000 });

    // Verify breadcrumbs
    const breadcrumbNav = page.locator('nav[aria-label="breadcrumb"]');
    await expect(breadcrumbNav.getByText('System').first()).toBeVisible();
    await expect(breadcrumbNav.getByText('Access Groups').first()).toBeVisible();

    // Verify form fields
    const codeInput = page.getByLabel('Code');
    const nameInput = page.getByLabel('Name');
    await expect(codeInput).toBeVisible();
    await expect(nameInput).toBeVisible();

    // Verify Create and Cancel buttons
    const createButton = page.getByRole('button', { name: 'Create' });
    const cancelButton = page.getByRole('button', { name: 'Cancel' });
    await expect(createButton).toBeVisible();
    await expect(cancelButton).toBeVisible();

    // Visual checkpoint 1: Create form loaded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-create-form-loaded.png`,
      fullPage: true,
    });

    // ─── Step 2: Fill form with existing code ───
    await codeInput.fill('FULL_ACCESS');
    await nameInput.fill('Full Access Duplicate');

    // Verify code value (should remain uppercase — input already uppercase)
    await expect(codeInput).toHaveValue('FULL_ACCESS');
    await expect(nameInput).toHaveValue('Full Access Duplicate');

    // Visual checkpoint 2: Form filled with duplicate code
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-form-filled-duplicate-code.png`,
      fullPage: true,
    });

    // ─── Step 3: Click Create button — expect 409 inline error ───
    await createButton.click();

    // Wait for the inline error to appear on the Code field
    // Use data-slot="form-message" to target the visible error (not the sr-only aria-live region)
    const codeError = page.locator('p[data-slot="form-message"]', {
      hasText: 'An access group with this code already exists',
    });
    await expect(codeError).toBeVisible({ timeout: 10_000 });

    // Verify we are still on the create page (no navigation occurred)
    await expect(
      page.getByRole('heading', { name: 'Create Access Group' }),
    ).toBeVisible();

    // Verify no success toast appeared
    await expect(
      page.getByText('Access group created successfully'),
    ).not.toBeVisible();

    // Verify form fields retain their values
    await expect(codeInput).toHaveValue('FULL_ACCESS');
    await expect(nameInput).toHaveValue('Full Access Duplicate');

    // Visual checkpoint 3: Inline error on Code field after 409
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-duplicate-code-inline-error.png`,
      fullPage: true,
    });
  });
});
