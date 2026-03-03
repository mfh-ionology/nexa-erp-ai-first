import { test, expect, type Page } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E6/journey-25';

// --- Mock API: reject login with AUTH_INVALID_CREDENTIALS ---

const MOCK_LOGIN_INVALID_RESPONSE = {
  success: false,
  error: {
    code: 'AUTH_INVALID_CREDENTIALS',
    message: 'Invalid email or password',
  },
};

/** Mock the login endpoint to return a 401 for invalid credentials. */
async function mockLoginApiReject(page: Page) {
  await page.route('**/api/v1/auth/login', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_LOGIN_INVALID_RESPONSE),
    });
  });
}

test.describe('Journey 25: Login Form Validation and Error Handling', () => {
  test('validation errors on empty submit, then auth error on invalid credentials', async ({
    page,
  }) => {
    // ─── Step 1: Navigate to /login ───
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);

    // Verify login page loaded
    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(
      page.getByPlaceholder('you@company.co.uk'),
    ).toBeVisible();
    await expect(
      page.getByPlaceholder('Enter your password'),
    ).toBeVisible();

    // ─── Step 2: Click "Sign In" without filling any fields ───
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait briefly for validation to fire
    await page.waitForTimeout(500);

    // Expect inline validation errors for email and password
    // FormMessage uses data-slot="form-message" with React.useId()-based IDs
    const formMessages = page.locator('[data-slot="form-message"]');
    await expect(formMessages.first()).toBeVisible({ timeout: 5_000 });

    // Both email and password fields should show validation messages
    await expect(formMessages).toHaveCount(2);

    // Verify the specific Zod validation messages are shown (use data-slot to avoid sr-only dupes)
    const emailMsg = page.locator('[data-slot="form-message"]', { hasText: 'email must be at least 1 characters' });
    const passwordMsg = page.locator('[data-slot="form-message"]', { hasText: 'password must be at least 1 characters' });
    await expect(emailMsg).toBeVisible();
    await expect(passwordMsg).toBeVisible();

    // Sign In button should still be visible and enabled (no API call made)
    await expect(
      page.getByRole('button', { name: 'Sign In' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Sign In' }),
    ).toBeEnabled();

    // Visual checkpoint 1: Validation errors on empty submit
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-empty-form-validation-errors.png`,
      fullPage: true,
    });

    // ─── Step 3: Fill form with invalid credentials ───
    await page
      .getByPlaceholder('you@company.co.uk')
      .fill('wrong@example.com');
    await page
      .getByPlaceholder('Enter your password')
      .fill('WrongPassword');

    // Verify fields are populated
    await expect(
      page.getByPlaceholder('you@company.co.uk'),
    ).toHaveValue('wrong@example.com');
    await expect(
      page.getByPlaceholder('Enter your password'),
    ).toHaveValue('WrongPassword');

    // ─── Step 4: Click "Sign In" — expect auth error toast ───
    // Set up mock to reject login BEFORE clicking
    await mockLoginApiReject(page);

    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for the API call to complete and toast to appear
    // Sonner toasts typically use [data-sonner-toast] or role attributes
    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toBeVisible({ timeout: 10_000 });

    // Toast should contain the auth error message
    await expect(toast).toContainText('Invalid email or password');

    // Login form should still be visible for retry
    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(
      page.getByPlaceholder('you@company.co.uk'),
    ).toBeVisible();

    // Sign In button should return to enabled state
    await expect(
      page.getByRole('button', { name: 'Sign In' }),
    ).toBeEnabled({ timeout: 5_000 });

    // Visual checkpoint 2: Auth error toast on invalid credentials
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-auth-error-toast.png`,
      fullPage: true,
    });
  });
});
