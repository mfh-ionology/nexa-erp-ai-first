import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '_bmad-output/test-artifacts/screenshots/epic-E2b/journey-16';

test.describe('J16 — Verify My Permissions Endpoint Data', () => {
  test('Admin sees correct permissions data on My Permissions page', async ({
    page,
  }) => {
    // ── Step 1: Navigate to login page ──────────────────────────────
    await page.goto('/login');
    await expect(
      page.getByRole('heading', { name: /sign in|log in|login/i }),
    ).toBeVisible();

    // ── Step 2: Fill login form with admin credentials ──────────────
    await page.getByLabel(/email/i).fill('admin@nexa-test.co.uk');
    await page.getByLabel(/password/i).fill('Admin123!');

    // ── Step 3: Click Sign In ───────────────────────────────────────
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for dashboard / app shell to load
    await page.waitForURL(/\/(dashboard)?$/);

    // ── Step 4: Navigate to /system/my-permissions ──────────────────
    await page.goto('/system/my-permissions');

    // Wait for the page to load — look for heading or key content
    // The page may render as a permissions view, developer panel, or JSON display
    await page.waitForLoadState('networkidle');

    // Verify the page loaded (not a 404 or error)
    const pageContent = page.locator('main, [role="main"], .content, body');
    await expect(pageContent).toBeVisible();

    // 📸 Checkpoint 1: My Permissions page loaded for admin
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-my-permissions-page-admin.png`,
      fullPage: true,
    });

    // ── Step 5: Verify key permission data is displayed ─────────────
    // The page should display role, access group, and enabled module information
    // These may be in a structured view or raw JSON display

    // Verify ADMIN role is displayed
    await expect(page.getByText('ADMIN')).toBeVisible();

    // Verify FULL_ACCESS access group is displayed
    await expect(page.getByText('FULL_ACCESS')).toBeVisible();

    // Verify 'system' module is listed in enabled modules
    await expect(page.getByText('system')).toBeVisible();
  });
});
