import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E2b/journey-5';

test.describe('Journey #5: Create Access Group with Duplicate Code is Rejected', () => {
  test('Creating an access group with an existing code returns a 409 Conflict error', async ({
    page,
  }) => {
    // ── Pre-requisite: Login as admin ──
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@nexa-test.co.uk');
    await page.getByLabel('Password').fill('Admin123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).not.toHaveURL(/\/login/);

    // ── Pre-requisite: Ensure QA_TESTER access group exists ──
    // Navigate to the create form and create QA_TESTER if it doesn't exist already
    await page.goto('/system/access-groups/new');
    await page.getByLabel(/code/i).fill('QA_TESTER');
    await page.getByLabel(/name/i).fill('QA Tester');
    const descriptionField = page.getByLabel(/description/i);
    if (await descriptionField.isVisible()) {
      await descriptionField.fill('Setup group for duplicate test');
    }
    await page.getByRole('button', { name: /save/i }).click();

    // Wait briefly for the creation to process — it may succeed (201) or fail (409 if already exists)
    // Either way, QA_TESTER now exists in the system
    await page.waitForTimeout(2000);

    // ── Step 1: Navigate to /system/access-groups/new ──
    await page.goto('/system/access-groups/new');

    // Verify create form loaded
    await expect(page.getByLabel(/code/i)).toBeVisible();
    await expect(page.getByLabel(/name/i)).toBeVisible();

    // ── Step 2: Fill form with duplicate code QA_TESTER ──
    await page.getByLabel(/code/i).fill('QA_TESTER');
    await page.getByLabel(/name/i).fill('QA Tester Duplicate');
    const descField = page.getByLabel(/description/i);
    if (await descField.isVisible()) {
      await descField.fill('Attempting duplicate code');
    }

    // Visual checkpoint 1: Form filled with duplicate code data
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-2-form-filled-duplicate-code.png` });

    // ── Step 3: Click [Save Settings] button — expect 409 error ──
    await page.getByRole('button', { name: /save/i }).click();

    // The form should remain on the create page (NOT redirect to a detail page)
    // Wait for an error indication — toast, alert, or inline error
    const errorToast = page.getByText(/already exists/i)
      .or(page.getByText(/duplicate/i))
      .or(page.getByText(/conflict/i))
      .or(page.getByRole('alert'));

    await expect(errorToast).toBeVisible({ timeout: 10000 });

    // Verify we're still on the create page (not redirected)
    await expect(page).toHaveURL(/\/system\/access-groups\/new/);

    // Visual checkpoint 2: Error toast/message visible for duplicate code
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-3-duplicate-code-error.png` });
  });
});
