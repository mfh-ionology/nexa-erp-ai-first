import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E2b/journey-9';

test.describe('Journey #9: Configure Field-Level Visibility Overrides', () => {
  // Pre-condition: login as admin before the journey starts
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@nexa-test.co.uk');
    await page.getByLabel('Password').fill('Admin123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
  });

  test('Admin configures field overrides on QA_TESTER group — HIDDEN and READ_ONLY on company-profile fields', async ({
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

    // Verify detail page loaded
    await expect(
      page
        .getByRole('heading', { name: /qa.?test/i })
        .or(page.getByRole('heading', { name: /qa testing/i }))
    ).toBeVisible({ timeout: 10000 });

    // ── Step 3: Click Field Overrides section / tab ──
    // The field overrides section may be a tab, accordion, or separate panel
    const fieldOverridesTab = page.getByRole('tab', { name: /field override/i })
      .or(page.getByRole('button', { name: /field override/i }))
      .or(page.getByText(/field override/i));
    await fieldOverridesTab.first().click();

    // Wait for field overrides panel to be visible
    const fieldOverridesPanel = page.locator('[data-testid="field-overrides"]')
      .or(page.locator('.field-overrides'))
      .or(page.locator('section', { hasText: /field override/i }));
    await expect(fieldOverridesPanel).toBeVisible({ timeout: 10000 });

    // Verify resource selector dropdown is present
    const resourceSelector = page.getByRole('combobox', { name: /resource/i })
      .or(page.getByLabel(/select resource/i))
      .or(page.locator('select', { hasText: /resource/i }));
    await expect(resourceSelector).toBeVisible({ timeout: 5000 });

    // Visual Checkpoint 1: Field Overrides panel empty state
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-field-overrides-empty-panel.png`,
      fullPage: true,
    });

    // ── Step 4: Select resource "system.company-profile.detail" from dropdown ──
    await resourceSelector.click();
    // Try selecting via option text or typing
    const companyProfileOption = page
      .getByRole('option', { name: /company.?profile/i })
      .or(page.getByText(/system\.company-profile\.detail/i));

    // If it's a native select, use selectOption; if combobox, click the option
    try {
      await resourceSelector.selectOption({
        label: /company.*profile/i,
      });
    } catch {
      // Fallback: if it's a custom combobox/dropdown, click the option
      await companyProfileOption.first().click();
    }

    // Wait for field list to appear for the selected resource
    await page.waitForTimeout(1000); // Allow time for fields to load

    // ── Step 5: Set vatNumber field override to HIDDEN ──
    // Find the vatNumber row in the field overrides table
    const vatNumberRow = page.locator('tr', { hasText: /vatNumber/i })
      .or(page.locator('[data-field="vatNumber"]'))
      .or(page.locator('div', { hasText: /vatNumber/i }).first());
    await expect(vatNumberRow).toBeVisible({ timeout: 10000 });

    // Find the visibility dropdown/select for vatNumber
    const vatNumberVisibility = vatNumberRow.locator('select')
      .or(vatNumberRow.getByRole('combobox'));
    await vatNumberVisibility.first().click();

    try {
      await vatNumberVisibility.first().selectOption('HIDDEN');
    } catch {
      // Fallback for custom dropdown
      await page.getByRole('option', { name: /hidden/i }).first().click();
    }

    // ── Step 6: Set registrationNumber field override to READ_ONLY ──
    const regNumberRow = page.locator('tr', { hasText: /registrationNumber/i })
      .or(page.locator('[data-field="registrationNumber"]'))
      .or(page.locator('div', { hasText: /registrationNumber/i }).first());
    await expect(regNumberRow).toBeVisible({ timeout: 10000 });

    const regNumberVisibility = regNumberRow.locator('select')
      .or(regNumberRow.getByRole('combobox'));
    await regNumberVisibility.first().click();

    try {
      await regNumberVisibility.first().selectOption('READ_ONLY');
    } catch {
      // Fallback for custom dropdown
      await page.getByRole('option', { name: /read.?only/i }).first().click();
    }

    // Verify both overrides are configured
    await expect(vatNumberRow.getByText(/hidden/i)).toBeVisible();
    await expect(regNumberRow.getByText(/read.?only/i)).toBeVisible();

    // Visual Checkpoint 2: Field overrides configured
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-field-overrides-configured.png`,
      fullPage: true,
    });

    // ── Step 7: Click [Save Settings] button ──
    await page.getByRole('button', { name: /save/i }).click();

    // Wait for success feedback
    const successToast = page.getByText(/updated|saved|success/i).first();
    await expect(successToast).toBeVisible({ timeout: 10000 });

    // Verify the overrides are still showing after save
    await expect(
      page.getByText(/hidden/i).or(page.getByText(/HIDDEN/))
    ).toBeVisible();
    await expect(
      page.getByText(/read.?only/i).or(page.getByText(/READ_ONLY/))
    ).toBeVisible();

    // Visual Checkpoint 3: Save success
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-7-field-overrides-saved-success.png`,
      fullPage: true,
    });
  });
});
