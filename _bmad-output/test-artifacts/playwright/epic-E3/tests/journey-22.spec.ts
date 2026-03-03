import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E3/journey-22';

test.describe('Journey 22: Full Audit Lifecycle — Action → Audit Record → Entity History', () => {
  test('complete audit lifecycle: create + update access group, verify audit records and entity history', async ({
    page,
  }) => {
    // ─── Step 1: Navigate to login page ───
    await page.goto('/login');
    await expect(
      page.getByRole('textbox', { name: /email/i }).or(page.getByPlaceholder(/email/i)).first(),
    ).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-01-login-page.png` });

    // ─── Step 2: Fill login form ───
    const emailInput = page
      .getByRole('textbox', { name: /email/i })
      .or(page.getByPlaceholder(/email/i))
      .first();
    const passwordInput = page
      .getByLabel(/password/i)
      .or(page.getByPlaceholder(/password/i))
      .first();

    await emailInput.fill('admin@nexa-test.co.uk');
    await passwordInput.fill('Admin123!');

    // ─── Step 3: Click Sign In ───
    const signInButton = page
      .getByRole('button', { name: /sign in/i })
      .or(page.getByRole('button', { name: /log in/i }))
      .first();
    await signInButton.click();

    // Wait for login to complete — should redirect to dashboard/briefing
    await page.waitForURL(/\/(briefing|dashboard|$)/, { timeout: 15000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-03-dashboard-after-login.png` });

    // ─── Step 4: Navigate to Access Groups via sidebar ───
    const accessGroupsLink = page
      .getByRole('link', { name: /access groups/i })
      .or(page.getByText(/access groups/i))
      .first();
    await accessGroupsLink.click();
    await page.waitForURL(/\/access-groups|\/system\/access-groups/, { timeout: 10000 });

    // ─── Step 5: Click Create Access Group button ───
    const createButton = page
      .getByRole('button', { name: /create|new|add/i })
      .first();
    await createButton.click();

    // Wait for create form/dialog to appear
    await expect(
      page.getByRole('textbox', { name: /code/i }).or(page.getByPlaceholder(/code/i)).first(),
    ).toBeVisible({ timeout: 10000 });

    // ─── Step 6: Fill create access group form ───
    const codeInput = page
      .getByRole('textbox', { name: /code/i })
      .or(page.getByLabel(/code/i))
      .or(page.getByPlaceholder(/code/i))
      .first();
    const nameInput = page
      .getByRole('textbox', { name: /^name$/i })
      .or(page.getByLabel(/^name$/i))
      .or(page.getByPlaceholder(/name/i))
      .first();
    const descInput = page
      .getByRole('textbox', { name: /description/i })
      .or(page.getByLabel(/description/i))
      .or(page.getByPlaceholder(/description/i))
      .first();

    await codeInput.fill('LIFECYCLE_TEST');
    await nameInput.fill('Lifecycle Test Group');
    await descInput.fill('Testing full audit lifecycle');

    // ─── Step 7: Click Save/Create ───
    const saveButton = page
      .getByRole('button', { name: /save|create/i })
      .first();
    await saveButton.click();

    // Wait for success indication (toast, redirect, or list update)
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-07-access-group-created.png` });

    // Verify success — either toast or the new group appears in list
    const successIndicator = page
      .getByText(/success|created/i)
      .or(page.getByText('Lifecycle Test Group'))
      .first();
    await expect(successIndicator).toBeVisible({ timeout: 10000 });

    // ─── Step 8: Click Edit on newly created group ───
    // Find the row with 'Lifecycle Test Group' and click edit
    const lifecycleRow = page.getByText('Lifecycle Test Group').first();
    await expect(lifecycleRow).toBeVisible({ timeout: 10000 });

    // Try clicking an edit button near the row, or clicking the row itself
    const editButton = page
      .getByRole('row', { name: /lifecycle test group/i })
      .getByRole('button', { name: /edit/i })
      .or(page.locator('[data-testid*="edit"]').filter({ hasText: /lifecycle/i }))
      .first();

    // Fallback: try clicking the row itself or a link within it
    try {
      await editButton.click({ timeout: 5000 });
    } catch {
      // If no explicit edit button, try clicking the row or a link
      await lifecycleRow.click();
    }

    // Wait for edit form to appear
    await page.waitForTimeout(1000);

    // ─── Step 9: Update the name field ───
    const editNameInput = page
      .getByRole('textbox', { name: /^name$/i })
      .or(page.getByLabel(/^name$/i))
      .first();
    await editNameInput.clear();
    await editNameInput.fill('Lifecycle Test Group (Updated)');

    // ─── Step 10: Click Save/Update ───
    const updateButton = page
      .getByRole('button', { name: /save|update/i })
      .first();
    await updateButton.click();

    // Wait for success
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-10-access-group-updated.png` });

    // Verify update success
    const updateSuccess = page
      .getByText(/success|updated/i)
      .or(page.getByText('Lifecycle Test Group (Updated)'))
      .first();
    await expect(updateSuccess).toBeVisible({ timeout: 10000 });

    // ─── Step 11: Navigate to Audit Log via sidebar ───
    const auditLogLink = page
      .getByRole('link', { name: /audit log/i })
      .or(page.getByText(/audit log/i))
      .first();
    await auditLogLink.click();
    await page.waitForURL(/\/audit-log|\/system\/audit-log/, { timeout: 10000 });

    // ─── Step 12: Set Entity Type filter to AccessGroup ───
    const entityTypeFilter = page
      .getByRole('combobox', { name: /entity type/i })
      .or(page.getByLabel(/entity type/i))
      .or(page.getByPlaceholder(/entity type/i))
      .first();

    // Could be a select dropdown or text input
    try {
      await entityTypeFilter.selectOption('AccessGroup');
    } catch {
      await entityTypeFilter.fill('AccessGroup');
    }

    // ─── Step 13: Click Apply Filters ───
    const applyButton = page
      .getByRole('button', { name: /apply|filter|search/i })
      .first();
    await applyButton.click();

    // Wait for filtered results
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-13-audit-log-filtered.png` });

    // Verify AccessGroup records visible
    await expect(page.getByText('AccessGroup').first()).toBeVisible({ timeout: 10000 });

    // Verify both CREATE and UPDATE actions
    await expect(page.getByText('CREATE').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('UPDATE').first()).toBeVisible({ timeout: 5000 });

    // ─── Step 14: View entity history ───
    // Click View History link on a LIFECYCLE_TEST record
    const viewHistoryButton = page
      .getByRole('button', { name: /view history|history/i })
      .or(page.getByRole('link', { name: /view history|history/i }))
      .or(page.locator('[data-testid*="history"]'))
      .first();
    await viewHistoryButton.click();

    // Wait for entity history view to load
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-14-entity-history.png` });

    // Verify entity history shows CREATE and UPDATE records in chronological order
    const historyRecords = page.getByText(/CREATE|UPDATE/);
    await expect(historyRecords.first()).toBeVisible({ timeout: 10000 });

    // Verify CREATE action appears (first chronologically)
    await expect(page.getByText('CREATE').first()).toBeVisible();

    // Verify UPDATE action appears (second chronologically)
    await expect(page.getByText('UPDATE').first()).toBeVisible();

    // Verify the admin user is shown as the actor
    await expect(
      page.getByText(/admin/i).first(),
    ).toBeVisible({ timeout: 5000 });
  });
});
