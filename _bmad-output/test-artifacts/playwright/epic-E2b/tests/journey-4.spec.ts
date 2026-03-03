import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E2b/journey-4';

test.describe('Journey #4: Create a Custom Access Group', () => {
  test('Admin creates a new custom access group and verifies it appears in the list', async ({
    page,
  }) => {
    // ── Pre-requisite: Login as admin ──
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@nexa-test.co.uk');
    await page.getByLabel('Password').fill('Admin123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).not.toHaveURL(/\/login/);

    // ── Step 1: Navigate to /system/access-groups ──
    await page.goto('/system/access-groups');
    await expect(page.getByRole('heading', { name: /access groups/i })).toBeVisible();

    // ── Step 2: Click [+ New Access Group] button ──
    await page.getByRole('link', { name: /new access group/i }).or(
      page.getByRole('button', { name: /new access group/i })
    ).click();

    // Wait for the create form to load
    await expect(page).toHaveURL(/\/system\/access-groups\/new/);

    // Verify create form fields are visible
    await expect(page.getByLabel(/code/i)).toBeVisible();
    await expect(page.getByLabel(/name/i)).toBeVisible();

    // Visual checkpoint 1: Create form loaded
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-2-create-form-loaded.png` });

    // ── Step 3: Fill form with custom group data ──
    await page.getByLabel(/code/i).fill('QA_TESTER');
    await page.getByLabel(/name/i).fill('QA Tester');
    // Description might be a textarea — try label first, fall back to placeholder
    const descriptionField = page.getByLabel(/description/i);
    if (await descriptionField.isVisible()) {
      await descriptionField.fill('Custom access group for QA testing E2E flows');
    } else {
      await page.getByPlaceholder(/description/i).fill('Custom access group for QA testing E2E flows');
    }

    // ── Step 4: Click [Save Settings] button ──
    await page.getByRole('button', { name: /save/i }).click();

    // Wait for success indication — either a toast, or redirect to detail page
    // Give the page time to process the creation
    await expect(page).not.toHaveURL(/\/new/, { timeout: 10000 });

    // Visual checkpoint 2: Access group created successfully
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-4-creation-success.png` });

    // Verify we're on a detail page (not the create form anymore)
    // The URL should be /system/access-groups/:id (not /new)
    await expect(page.getByText('QA_TESTER').or(page.getByText('QA Tester'))).toBeVisible();

    // ── Step 5: Navigate back to list and verify new group appears ──
    await page.goto('/system/access-groups');
    await expect(page.getByRole('heading', { name: /access groups/i })).toBeVisible();

    // Verify QA_TESTER is visible in the list
    await expect(page.getByText('QA_TESTER')).toBeVisible();

    // Visual checkpoint 3: New group visible in list
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-5-new-group-in-list.png` });
  });
});
