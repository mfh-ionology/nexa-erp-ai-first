import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E3/journey-20';

test.describe('Journey 20: Dead Letter Queue Rejects Unauthenticated Requests', () => {
  test('unauthenticated user is redirected to login or shown 401 when accessing DLQ', async ({
    page,
  }) => {
    // Step 1: Navigate directly to /system/dead-letter-queue without logging in
    await page.goto('/system/dead-letter-queue');

    // Wait for redirect or error page to settle
    await page.waitForLoadState('networkidle');

    // Visual checkpoint: capture what the user sees
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-unauthenticated-dlq-redirect.png`,
      fullPage: true,
    });

    // Verify: either redirected to login page OR shown 401/unauthorized message
    const currentUrl = page.url();
    const pageContent = await page.textContent('body');

    const isRedirectedToLogin = currentUrl.includes('/login');
    const shows401Message =
      pageContent?.toLowerCase().includes('unauthorized') ||
      pageContent?.toLowerCase().includes('401') ||
      pageContent?.includes('Sign In') ||
      pageContent?.includes('sign in') ||
      pageContent?.includes('Log In') ||
      pageContent?.includes('log in');

    // At least one of these conditions must be true
    expect(
      isRedirectedToLogin || shows401Message,
      `Expected redirect to /login or 401 message. Got URL: ${currentUrl}`,
    ).toBeTruthy();

    // Verify DLQ data is NOT visible — no DLQ-specific content should be on screen
    const dlqIndicators = [
      'Dead Letter Queue',
      'Event Name',
      'Retry Count',
      'Reprocess',
      'dead-letter',
    ];

    // If redirected to login, DLQ content should definitely not be present
    if (isRedirectedToLogin) {
      for (const indicator of dlqIndicators) {
        // These DLQ-specific elements should not be visible on the login page
        // (Note: "Dead Letter Queue" might appear as a nav item label in some UIs,
        // but the actual DLQ table/data should not be visible)
        const dlqTable = page.locator('table').filter({ hasText: indicator });
        await expect(dlqTable).toHaveCount(0);
      }

      // Verify login form is present
      const emailField =
        page.getByLabel('Email') ||
        page.getByPlaceholder('Email') ||
        page.getByPlaceholder('email');
      const passwordField =
        page.getByLabel('Password') ||
        page.getByPlaceholder('Password') ||
        page.getByPlaceholder('password');

      // At least the login form elements should be visible
      const hasEmailField = await emailField.isVisible().catch(() => false);
      const hasPasswordField = await passwordField.isVisible().catch(() => false);
      const hasSignInButton = await page
        .getByRole('button', { name: /sign in/i })
        .isVisible()
        .catch(() => false);

      expect(
        hasEmailField || hasPasswordField || hasSignInButton,
        'Login page should show email/password fields or sign in button',
      ).toBeTruthy();
    }
  });
});
