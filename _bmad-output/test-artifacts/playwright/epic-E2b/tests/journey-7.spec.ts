import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E2b/journey-7';

test.describe('Journey #7: Edit Access Group Name and Description', () => {
  // Pre-condition: login as admin before the journey starts
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@nexa-test.co.uk');
    await page.getByLabel('Password').fill('Admin123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
  });

  test('Admin edits QA_TESTER group name and description, verifies update in list', async ({
    page,
  }) => {
    // ── Step 1: Navigate to /system/access-groups ──
    await page.goto('/system/access-groups');
    await expect(
      page.getByRole('heading', { name: 'Access Groups' })
    ).toBeVisible();

    // ── Step 2: Click QA_TESTER row in table ──
    const qaTesterRow = page.locator('table tbody tr', {
      hasText: 'QA_TESTER',
    });
    await expect(qaTesterRow).toBeVisible({ timeout: 10000 });
    await qaTesterRow.click();

    // Wait for navigation to the detail page
    await expect(page).toHaveURL(/\/system\/access-groups\/.+/, {
      timeout: 10000,
    });

    // Verify detail page loaded — should show QA Tester heading or QA_TESTER code
    await expect(
      page
        .getByRole('heading', { name: /qa.?tester/i })
        .or(page.getByRole('heading', { name: /qa testing/i }))
    ).toBeVisible({ timeout: 10000 });

    // Verify this is NOT a system group (no system banner)
    // The Save Settings button should be present
    await expect(
      page.getByRole('button', { name: /save/i })
    ).toBeVisible();

    // Visual Checkpoint 1: QA_TESTER detail page loaded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-qa-tester-detail-page.png`,
      fullPage: true,
    });

    // ── Step 3: Edit name and description fields ──
    // Find and clear/fill the Name field
    const nameInput = page.getByLabel('Name')
      .or(page.locator('input[name="name"]'))
      .or(page.getByPlaceholder(/name/i));
    await expect(nameInput).toBeVisible();
    await nameInput.clear();
    await nameInput.fill('QA Testing Team');

    // Find and clear/fill the Description field
    const descriptionInput = page.getByLabel('Description')
      .or(page.locator('textarea[name="description"]'))
      .or(page.getByPlaceholder(/description/i));
    await expect(descriptionInput).toBeVisible();
    await descriptionInput.clear();
    await descriptionInput.fill(
      'Updated description for the QA testing access group'
    );

    // ── Step 4: Click [Save Settings] button ──
    await page.getByRole('button', { name: /save/i }).click();

    // Wait for success feedback — toast or notification
    const successToast = page.getByText(/updated|saved|success/i).first();
    await expect(successToast).toBeVisible({ timeout: 10000 });

    // Verify the page now shows the updated name
    await expect(
      page.getByRole('heading', { name: /qa testing team/i })
        .or(page.getByText('QA Testing Team'))
    ).toBeVisible();

    // Visual Checkpoint 2: Save success with updated metadata
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-save-success-updated-metadata.png`,
      fullPage: true,
    });

    // ── Step 5: Navigate back to list and verify updated name ──
    await page.goto('/system/access-groups');
    await expect(
      page.getByRole('heading', { name: 'Access Groups' })
    ).toBeVisible();

    // Verify the list shows the updated name "QA Testing Team"
    const updatedRow = page.locator('table tbody tr', {
      hasText: 'QA_TESTER',
    });
    await expect(updatedRow).toBeVisible({ timeout: 10000 });
    await expect(updatedRow.getByText('QA Testing Team')).toBeVisible();

    // Visual Checkpoint 3: List shows updated name
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-list-shows-updated-name.png`,
      fullPage: true,
    });
  });
});
