import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E3/journey-1';

test.describe('j01 — Admin Login and Navigate to Audit Log', () => {
  test('Admin user logs in and navigates to the Audit Log page', async ({ page }) => {
    // ── Step 1: Navigate to /login ──────────────────────────────────────
    await page.goto('/login');

    // Verify login form elements are present
    const emailInput = page.getByLabel(/email/i).or(page.getByPlaceholder(/email/i));
    const passwordInput = page.getByLabel(/password/i).or(page.getByPlaceholder(/password/i));
    const signInButton = page.getByRole('button', { name: /sign in/i });

    await expect(emailInput).toBeVisible({ timeout: 15000 });
    await expect(passwordInput).toBeVisible();
    await expect(signInButton).toBeVisible();

    // Checkpoint 1: Login page loaded
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-1-login-page.png` });

    // ── Step 2: Fill login form ─────────────────────────────────────────
    await emailInput.fill('admin@nexa-test.co.uk');
    await passwordInput.fill('Admin123!');

    // ── Step 3: Click Sign In ───────────────────────────────────────────
    await signInButton.click();

    // Wait for navigation away from login page (dashboard or home)
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 15000,
    });

    // Verify the app shell / dashboard loaded
    const sidebar = page.getByRole('navigation').or(page.locator('[data-testid="sidebar"]')).or(page.locator('nav, aside'));
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // Checkpoint 2: Dashboard after login
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-3-dashboard-after-login.png` });

    // ── Step 4: Click Audit Log link in sidebar ─────────────────────────
    const auditLogLink = page.getByRole('link', { name: /audit log/i })
      .or(page.getByText(/audit log/i));
    await expect(auditLogLink).toBeVisible({ timeout: 10000 });
    await auditLogLink.click();

    // Wait for audit log page to load
    await page.waitForURL(/audit-log/i, { timeout: 10000 });

    // Checkpoint 3: Audit Log page
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-4-audit-log-page.png` });

    // ── Step 5: Verify audit log table has data ─────────────────────────
    // Look for a data table with audit records
    const table = page.getByRole('table').or(page.locator('table, [data-testid="audit-log-table"]'));
    await expect(table).toBeVisible({ timeout: 10000 });

    // Verify table has at least one data row (from the login event)
    const dataRows = page.locator('table tbody tr, [data-testid="audit-log-table"] [data-testid="audit-row"]');
    await expect(dataRows.first()).toBeVisible({ timeout: 10000 });
    const rowCount = await dataRows.count();
    expect(rowCount).toBeGreaterThan(0);

    // Verify expected column headers exist
    const headerRow = page.locator('table thead, [role="columnheader"]');
    const headerTexts = ['Timestamp', 'Entity Type', 'Entity ID', 'Action', 'User'];
    for (const header of headerTexts) {
      await expect(
        page.getByRole('columnheader', { name: new RegExp(header, 'i') })
          .or(page.getByText(new RegExp(header, 'i')).first())
      ).toBeVisible();
    }
  });
});
