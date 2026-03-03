import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E4/journey-13';

test.describe('J13 — Permission Denied Shows Translated FORBIDDEN Error', () => {
  test('viewer user sees translated permission denied error when attempting restricted action', async ({
    page,
  }) => {
    // Step 1: Navigate to /login
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);

    // Step 2: Fill login form with limited user (VIEWER) credentials
    const emailField =
      page.getByLabel(/email/i).or(page.getByPlaceholder(/email/i));
    const passwordField =
      page.getByLabel(/password/i).or(page.getByPlaceholder(/password/i));

    await emailField.fill('viewer@nexa-test.co.uk');
    await passwordField.fill('View123!');

    // Step 3: Click Sign In button — login should succeed for viewer user
    const signInButton = page
      .getByRole('button', { name: /sign in|log in|submit/i })
      .first();
    await signInButton.click();

    // Wait for navigation away from login page
    await page.waitForURL(/^(?!.*\/login).*$/, { timeout: 15000 });

    // Visual Checkpoint 1: Viewer dashboard after login
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-viewer-dashboard-after-login.png`,
      fullPage: true,
    });

    // Step 4: Navigate to /system/users
    await page.goto('/system/users');
    await page.waitForLoadState('networkidle');

    // Step 5: Attempt a restricted action — try Create button first, fall back to direct nav
    const createButton = page
      .getByRole('button', { name: /create|add|new/i })
      .or(page.getByRole('link', { name: /create|add|new/i }));

    // Check if Create button is visible for viewer
    const createVisible = await createButton.first().isVisible().catch(() => false);

    if (createVisible) {
      // Click the Create button — should trigger permission denied
      await createButton.first().click();
      await page.waitForTimeout(2000);
    } else {
      // Create button is hidden for VIEWER — navigate directly to /system/users/new
      await page.goto('/system/users/new');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    }

    // Visual Checkpoint 2: Permission denied error
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-permission-denied-error.png`,
      fullPage: true,
    });

    // Step 6: Verify translated error message is visible
    // The error should say "You do not have permission to perform this action" from errors.json FORBIDDEN
    const pageContent = await page.textContent('body');

    // Check for the translated FORBIDDEN error message
    // It could appear as a toast, alert, inline error, or as part of a permission denied page
    const permissionDeniedVisible = await page
      .getByText(/you do not have permission|permission denied|forbidden|access denied|not authorized/i)
      .first()
      .isVisible()
      .catch(() => false);

    // If the error text is on the page, assert it's the right translated message
    if (permissionDeniedVisible) {
      await expect(
        page.getByText(/you do not have permission to perform this action/i).first()
      ).toBeVisible({ timeout: 5000 });
    } else {
      // Check if the page content contains the permission error text
      expect(
        pageContent?.toLowerCase()
      ).toMatch(
        /you do not have permission|permission denied|forbidden|access denied|not authorized/i
      );
    }

    // Step 7: Verify raw translation key "errors:FORBIDDEN" is NOT visible
    expect(pageContent).not.toContain('errors:FORBIDDEN');
    expect(pageContent).not.toContain('errors.FORBIDDEN');
    expect(pageContent).not.toContain('FORBIDDEN');

    // Also verify no other raw i18n namespace prefixes leaked
    expect(pageContent).not.toContain('errors:');
    expect(pageContent).not.toContain('common:');
    expect(pageContent).not.toContain('validation:');

    // Visual Checkpoint 3: Final state — no raw keys
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-7-no-raw-keys-final.png`,
      fullPage: true,
    });
  });
});
