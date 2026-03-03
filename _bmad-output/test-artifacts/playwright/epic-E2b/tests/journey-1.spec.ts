import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E2b/journey-1';

test.describe('Journey #1: Admin Login and Permission-Driven Sidebar', () => {
  test('Admin with FULL_ACCESS sees all System module sidebar items after login', async ({
    page,
  }) => {
    // ── Step 1: Navigate to login page ──
    await page.goto('/login');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();

    // Visual checkpoint 1: Login page loaded
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-1-login-page.png` });

    // ── Step 2: Fill login form with admin credentials ──
    await page.getByLabel('Email').fill('admin@nexa-test.co.uk');
    await page.getByLabel('Password').fill('Admin123!');

    // ── Step 3: Click Sign In — expect redirect to dashboard ──
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for navigation away from login page
    await expect(page).not.toHaveURL(/\/login/);

    // Visual checkpoint 2: Dashboard after login
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-dashboard-after-login.png`,
    });

    // ── Step 4: Verify sidebar System section contains expected links ──
    const sidebar = page.getByRole('navigation');
    await expect(sidebar.getByText('Users')).toBeVisible();
    await expect(sidebar.getByText('Company Profile')).toBeVisible();
    await expect(sidebar.getByText('Resource Registry')).toBeVisible();
    await expect(sidebar.getByText('Access Groups')).toBeVisible();

    // ── Step 5: Confirm all four System module sidebar items are visible ──
    const expectedItems = [
      'Users',
      'Company Profile',
      'Resource Registry',
      'Access Groups',
    ];

    for (const item of expectedItems) {
      await expect(sidebar.getByText(item)).toBeVisible();
    }

    // Visual checkpoint 3: Sidebar items verified
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-sidebar-system-items.png`,
    });
  });
});
