import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E2b/journey-13';

test.describe('Journey #13: Verify Most-Permissive-Wins Permission Resolution', () => {
  test('Sales user with SALES_STAFF + QA_TESTER can access Users page via QA_TESTER permissions', async ({
    page,
  }) => {
    // ── Step 1: Navigate to /login ──
    await page.goto('/login');
    await expect(page.getByLabel('Email')).toBeVisible({ timeout: 10000 });

    // ── Step 2: Fill login form with sales user credentials ──
    // Sales user has SALES_STAFF (limited) + QA_TESTER (canAccess+canView on users.list/detail)
    await page.getByLabel('Email').fill('sales@nexa-test.co.uk');
    await page.getByLabel('Password').fill('Sales123!');

    // ── Step 3: Click Sign In button ──
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for dashboard to load after login
    await page.waitForURL('**/dashboard**', { timeout: 15000 });

    // Wait for sidebar to be fully rendered (permissions loaded via GET /system/my-permissions)
    const sidebar = page.locator('nav, [role="navigation"], aside, [data-testid="sidebar"]');
    await expect(sidebar.first()).toBeVisible({ timeout: 10000 });

    // Allow time for permission-driven sidebar to render
    await page.waitForTimeout(1000);

    // ── Step 4: Verify "Users" link is visible in sidebar ──
    // QA_TESTER grants canAccess on system.users.list; most-permissive-wins should resolve true
    const sidebarContent = sidebar.first();
    await expect(sidebarContent.getByText('Users')).toBeVisible({ timeout: 5000 });

    // Visual Checkpoint 1: Sales user dashboard after login — "Users" visible in sidebar
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-sales-dashboard-after-login.png`,
      fullPage: true,
    });

    // ── Step 5: Click "Users" sidebar link ──
    await sidebarContent.getByText('Users').click();

    // Wait for the Users page to load — should NOT get a 403
    await page.waitForTimeout(2000);

    // Verify we are on the users page (not access denied)
    const accessDenied = page.getByText(/access denied/i)
      .or(page.getByText(/forbidden/i))
      .or(page.getByText(/not authorized/i))
      .or(page.getByText(/you do not have permission/i))
      .or(page.getByText(/403/i));

    const isAccessDenied = await accessDenied.first().isVisible().catch(() => false);
    expect(isAccessDenied).toBeFalsy();

    // Verify the user list page actually loaded — look for page title or table
    const usersPageIndicator = page.getByRole('heading', { name: /users/i })
      .or(page.getByText(/user management/i))
      .or(page.locator('table'));

    await expect(usersPageIndicator.first()).toBeVisible({ timeout: 5000 });

    // Visual Checkpoint 2: Users list page accessible via most-permissive-wins
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-users-list-accessible.png`,
      fullPage: true,
    });

    // ── Step 6: Verify [+ New User] button is HIDDEN ──
    // QA_TESTER only grants canAccess + canView, NOT canNew
    // SALES_STAFF also doesn't grant canNew on system.users.list
    // So the "New User" button should not be visible
    const newUserButton = page.getByRole('button', { name: /new user/i })
      .or(page.getByRole('link', { name: /new user/i }))
      .or(page.getByText(/\+ new user/i));

    await expect(newUserButton.first()).toBeHidden({ timeout: 5000 });

    // Visual Checkpoint 3: No "New User" button visible
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-no-new-user-button.png`,
      fullPage: true,
    });
  });
});
