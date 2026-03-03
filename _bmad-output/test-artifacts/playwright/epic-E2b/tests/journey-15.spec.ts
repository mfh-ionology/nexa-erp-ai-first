import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '_bmad-output/test-artifacts/screenshots/epic-E2b/journey-15';

test.describe('J15 — SUPER_ADMIN Bypasses All Permission Checks', () => {
  test('SUPER_ADMIN has full access to all pages and all fields visible', async ({
    page,
  }) => {
    // ── Step 1: Navigate to login page ──────────────────────────────
    await page.goto('/login');
    await expect(
      page.getByRole('heading', { name: /sign in|log in|login/i }),
    ).toBeVisible();

    // ── Step 2: Fill login form with SUPER_ADMIN credentials ────────
    await page.getByLabel(/email/i).fill('superadmin@nexa-test.co.uk');
    await page.getByLabel(/password/i).fill('Super123!');

    // ── Step 3: Click Sign In — expect full sidebar ─────────────────
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for dashboard / app shell to load
    await page.waitForURL(/\/(dashboard)?$/);

    // SUPER_ADMIN bypass: sidebar should show ALL System module items
    const sidebar = page.getByRole('navigation');
    await expect(sidebar.getByText('Users')).toBeVisible();
    await expect(sidebar.getByText('Company Profile')).toBeVisible();
    await expect(sidebar.getByText('Resource Registry')).toBeVisible();
    await expect(sidebar.getByText('Access Groups')).toBeVisible();

    // 📸 Checkpoint 1: Dashboard with full sidebar
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-super-admin-dashboard-full-sidebar.png`,
      fullPage: true,
    });

    // ── Step 4: Navigate to Resource Registry — should be accessible ─
    await page.goto('/system/resources');
    await expect(
      page.getByRole('heading', { name: /resource registry/i }),
    ).toBeVisible();
    // Verify the page loaded (not 403 / access denied)
    await expect(page.getByText(/access denied|forbidden/i)).not.toBeVisible();

    // ── Step 5: Navigate to Access Groups — should be accessible ────
    await page.goto('/system/access-groups');
    await expect(
      page.getByRole('heading', { name: /access groups/i }),
    ).toBeVisible();
    await expect(page.getByText(/access denied|forbidden/i)).not.toBeVisible();

    // ── Step 6: Navigate to Company Profile — ALL fields visible ────
    await page.goto('/system/company-profile');
    await expect(
      page.getByRole('heading', { name: /company profile/i }),
    ).toBeVisible();

    // SUPER_ADMIN skips field filtering: vatNumber must be visible and editable
    const vatField = page.getByLabel(/vat number/i);
    await expect(vatField).toBeVisible();
    await expect(vatField).toBeEditable();

    // registrationNumber must be visible and editable (no READ_ONLY override for SUPER_ADMIN)
    const regField = page.getByLabel(/registration number/i);
    await expect(regField).toBeVisible();
    await expect(regField).toBeEditable();

    // 📸 Checkpoint 2: Company profile with all fields visible
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-company-profile-all-fields-visible.png`,
      fullPage: true,
    });
  });
});
