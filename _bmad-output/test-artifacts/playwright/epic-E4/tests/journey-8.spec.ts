import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E4/journey-8';

test.describe('Journey 8: Duplicate Email Error Uses Translated Message', () => {
  test('j08 — Create user with existing email and verify translated DUPLICATE_EMAIL error', async ({
    page,
  }) => {
    // Step 1: Navigate to /login
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Step 2: Fill login form with admin credentials
    const emailField = page.getByRole('textbox', { name: /email/i });
    const passwordField = page.locator('input[type="password"]');

    const emailInput = (await emailField.count()) > 0
      ? emailField
      : page.getByLabel(/email/i);

    await emailInput.fill('admin@nexa-test.co.uk');
    await passwordField.fill('Admin123!');

    // Step 3: Click Sign In button
    const signInButton = page.getByRole('button', { name: /sign in|log in|submit|login/i });
    await signInButton.click();

    // Wait for login to succeed — we should leave /login
    await page.waitForURL(/^(?!.*\/login).*$/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // Step 4: Navigate to /system/users
    await page.goto('/system/users');
    await page.waitForLoadState('networkidle');

    // Verify user list page loaded
    await expect(
      page.getByRole('heading', { name: /users/i }).or(page.locator('h1, h2').filter({ hasText: /users/i }))
    ).toBeVisible({ timeout: 10000 });

    // Step 5: Click Create button
    const createButton = page.getByRole('button', { name: /create|add|new/i })
      .or(page.getByRole('link', { name: /create|add|new/i }));
    await createButton.click();

    // Wait for create user form to appear
    await page.waitForLoadState('networkidle');

    // Visual Checkpoint 1: Create User form opened
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-create-user-form.png`,
      fullPage: true,
    });

    // Verify form fields are visible
    const formEmailField = page.getByLabel(/email/i)
      .or(page.getByPlaceholder(/email/i))
      .or(page.getByRole('textbox', { name: /email/i }));
    await expect(formEmailField.first()).toBeVisible({ timeout: 10000 });

    // Step 6: Fill Create User form with existing email address
    // Find and fill email field
    const createEmailInput = page.getByLabel(/email/i)
      .or(page.getByPlaceholder(/email/i))
      .or(page.getByRole('textbox', { name: /email/i }));
    await createEmailInput.first().fill('admin@nexa-test.co.uk');

    // Fill firstName field
    const firstNameInput = page.getByLabel(/first\s*name/i)
      .or(page.getByPlaceholder(/first\s*name/i))
      .or(page.getByRole('textbox', { name: /first\s*name/i }));
    if ((await firstNameInput.count()) > 0) {
      await firstNameInput.first().fill('Duplicate');
    }

    // Fill lastName field
    const lastNameInput = page.getByLabel(/last\s*name/i)
      .or(page.getByPlaceholder(/last\s*name/i))
      .or(page.getByRole('textbox', { name: /last\s*name/i }));
    if ((await lastNameInput.count()) > 0) {
      await lastNameInput.first().fill('User');
    }

    // Fill password field on the create form (not the login password field)
    const createPasswordField = page.locator('input[type="password"]');
    if ((await createPasswordField.count()) > 0) {
      await createPasswordField.first().fill('DuplicatePass123!');
    }

    // Step 7: Click Save button to submit the form
    const saveButton = page.getByRole('button', { name: /save|create|submit/i });
    await saveButton.click();

    // Wait for server response and error to appear
    await page.waitForTimeout(2000);

    // Visual Checkpoint 2: Duplicate email error displayed
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-7-duplicate-email-error.png`,
      fullPage: true,
    });

    // Step 8: Verify the translated duplicate email error message
    const pageContent = await page.textContent('body');

    // Check for the translated error message from errors.json DUPLICATE_EMAIL
    const hasTranslatedError = pageContent?.includes('A user with this email already exists')
      || pageContent?.includes('already exists')
      || pageContent?.includes('duplicate')
      || pageContent?.toLowerCase()?.includes('email already');

    expect(
      hasTranslatedError,
      'Expected translated duplicate email error message to be visible on the page'
    ).toBeTruthy();

    // Verify no raw i18n key is exposed
    expect(pageContent).not.toContain('errors:DUPLICATE_EMAIL');
    expect(pageContent).not.toContain('DUPLICATE_EMAIL');

    // Verify no raw i18n namespace prefixes are visible
    expect(pageContent).not.toContain('errors:');
    expect(pageContent).not.toContain('{{');
  });
});
