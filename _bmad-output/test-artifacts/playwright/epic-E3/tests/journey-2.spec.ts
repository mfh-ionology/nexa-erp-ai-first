import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E3/journey-2';

test.describe('j02 — Trigger Events and Verify Audit Records Created', () => {
  test('Perform actions that emit events, then verify audit records appear in audit log', async ({ page }) => {
    // ── Step 1: Navigate to /login ──────────────────────────────────────
    await page.goto('/login');

    const emailInput = page.getByLabel(/email/i).or(page.getByPlaceholder(/email/i));
    const passwordInput = page.getByLabel(/password/i).or(page.getByPlaceholder(/password/i));
    const signInButton = page.getByRole('button', { name: /sign in/i });

    await expect(emailInput).toBeVisible({ timeout: 15000 });
    await expect(passwordInput).toBeVisible();
    await expect(signInButton).toBeVisible();

    // ── Step 2: Fill login form ─────────────────────────────────────────
    await emailInput.fill('admin@nexa-test.co.uk');
    await passwordInput.fill('Admin123!');

    // ── Step 3: Click Sign In (emits user.login event → audit record) ──
    await signInButton.click();

    // Wait for navigation away from login page
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 15000,
    });

    // Verify the app shell loaded
    const sidebar = page.getByRole('navigation').or(page.locator('[data-testid="sidebar"]')).or(page.locator('nav, aside'));
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // ── Step 4: Click Access Groups link in sidebar ─────────────────────
    const accessGroupsLink = page.getByRole('link', { name: /access groups/i })
      .or(page.getByText(/access groups/i));
    await expect(accessGroupsLink).toBeVisible({ timeout: 10000 });
    await accessGroupsLink.click();

    // Wait for access groups page to load
    await page.waitForURL(/access-groups/i, { timeout: 10000 });

    // ── Step 5: Click Create Access Group button ────────────────────────
    const createButton = page.getByRole('button', { name: /create|new access group/i })
      .or(page.getByRole('link', { name: /create|new access group/i }));
    await expect(createButton).toBeVisible({ timeout: 10000 });
    await createButton.click();

    // Wait for the create form/page to appear
    await page.waitForTimeout(1000);

    // ── Step 6: Fill Create Access Group form ───────────────────────────
    const codeField = page.getByLabel(/code/i).or(page.getByPlaceholder(/code/i));
    const nameField = page.getByLabel(/^name$/i).or(page.getByPlaceholder(/name/i));
    const descField = page.getByLabel(/description/i).or(page.getByPlaceholder(/description/i));

    await expect(codeField).toBeVisible({ timeout: 5000 });
    await codeField.fill('AUDIT_TEST_GROUP');
    await nameField.fill('Audit Test Group');
    await descField.fill('Group created to verify audit trail');

    // ── Step 7: Click Save / Create button ──────────────────────────────
    const saveButton = page.getByRole('button', { name: /save|create/i });
    await expect(saveButton).toBeVisible();
    await saveButton.click();

    // Wait for the success feedback (toast, redirect, or confirmation)
    const successIndicator = page.getByText(/success|created|saved/i).first();
    await expect(successIndicator).toBeVisible({ timeout: 10000 });

    // Checkpoint 1: Access group created successfully
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-7-access-group-created-toast.png` });

    // ── Step 8: Click Audit Log link in sidebar ─────────────────────────
    const auditLogLink = page.getByRole('link', { name: /audit log/i })
      .or(page.getByText(/audit log/i));
    await expect(auditLogLink).toBeVisible({ timeout: 10000 });
    await auditLogLink.click();

    // Wait for audit log page to load
    await page.waitForURL(/audit-log/i, { timeout: 10000 });

    // Wait for the audit table data to load
    const auditTable = page.getByRole('table').or(page.locator('table, [data-testid="audit-log-table"]'));
    await expect(auditTable).toBeVisible({ timeout: 10000 });

    const dataRows = page.locator('table tbody tr, [data-testid="audit-log-table"] [data-testid="audit-row"]');
    await expect(dataRows.first()).toBeVisible({ timeout: 10000 });

    // ── Step 9: Verify AccessGroup audit record exists ──────────────────
    // Look for a row containing "AccessGroup" entity type
    const accessGroupRow = page.locator('table tbody tr, [data-testid="audit-row"]')
      .filter({ hasText: /AccessGroup/i });
    await expect(accessGroupRow.first()).toBeVisible({ timeout: 10000 });

    // Verify the action is CREATE
    await expect(
      accessGroupRow.first().getByText(/CREATE/i)
        .or(accessGroupRow.first().locator(':has-text("CREATE")'))
    ).toBeVisible();

    // Checkpoint 2: Audit log shows AccessGroup CREATE record
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-9-audit-log-accessgroup-record.png` });

    // ── Step 10: Verify LOGIN audit record exists ────────────────────────
    const loginRow = page.locator('table tbody tr, [data-testid="audit-row"]')
      .filter({ hasText: /LOGIN/i });
    await expect(loginRow.first()).toBeVisible({ timeout: 10000 });

    // Checkpoint 3: Audit log shows LOGIN record
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-10-audit-log-login-record.png` });
  });
});
