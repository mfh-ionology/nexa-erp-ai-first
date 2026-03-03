import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E4/journey-7';

test.describe('Journey 7: User Creation Validation Shows Interpolated Field Names', () => {
  test('j07 — Submit empty Create User form and verify interpolated validation errors', async ({
    page,
  }) => {
    // Step 1: Navigate to /login
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Step 2: Fill login form with admin credentials
    const emailField = page.getByRole('textbox', { name: /email/i });
    const passwordField = page.locator('input[type="password"]');

    // Try getByLabel as fallback if getByRole doesn't find the email field
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

    // Verify form fields are visible — at least email and password
    const formVisible = page.getByLabel(/email/i)
      .or(page.getByPlaceholder(/email/i))
      .or(page.getByRole('textbox', { name: /email/i }));
    await expect(formVisible.first()).toBeVisible({ timeout: 10000 });

    // Step 6: Click Save button without filling any fields
    const saveButton = page.getByRole('button', { name: /save|create|submit/i });
    await saveButton.click();

    // Wait for validation errors to appear
    await page.waitForTimeout(1000);

    // Visual Checkpoint 2: Validation errors after empty submit
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-validation-errors.png`,
      fullPage: true,
    });

    // Step 7: Verify no raw {{field}} interpolation template in validation errors
    const pageContent = await page.textContent('body');
    expect(pageContent).not.toContain('{{field}}');

    // Step 8: Verify no raw namespace prefix 'validation:' in error messages
    expect(pageContent).not.toContain('validation:');

    // Additional check: no raw 'common:' prefix visible either
    expect(pageContent).not.toContain('common:');

    // Step 9: Check for top-level error banner (if present)
    // This is a soft check — the banner may or may not be present
    const errorBanner = page.locator('[role="alert"]').filter({
      hasText: /please correct|fix the errors|validation/i,
    });
    const bannerCount = await errorBanner.count();
    if (bannerCount > 0) {
      const bannerText = await errorBanner.first().textContent();
      // If a banner exists, it should contain a translated message
      expect(bannerText).not.toContain('errors:');
      expect(bannerText).not.toContain('{{');
    }

    // Verify at least one validation error is visible on the page
    // Check for common error indicator patterns
    const errorElements = page.locator(
      '[role="alert"], [class*="error"], [class*="Error"], [aria-invalid="true"], [class*="invalid"]'
    );
    const errorCount = await errorElements.count();
    expect(errorCount).toBeGreaterThan(0);
  });
});
