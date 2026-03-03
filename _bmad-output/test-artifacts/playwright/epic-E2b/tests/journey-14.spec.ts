import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E2b/journey-14';

test.describe('Journey #14: Verify Field-Level Visibility in API Response', () => {
  test('Sales user with QA_TESTER field overrides: vatNumber HIDDEN, registrationNumber READ_ONLY on company profile', async ({
    page,
  }) => {
    // ── Prerequisite: Login as sales user ──
    // The sales user has QA_TESTER access group assigned (from journey 10),
    // which has field overrides configured (from journey 9):
    //   - vatNumber → HIDDEN on system.company-profile.detail
    //   - registrationNumber → READ_ONLY on system.company-profile.detail
    await page.goto('/login');
    await expect(page.getByLabel('Email')).toBeVisible({ timeout: 10000 });

    await page.getByLabel('Email').fill('sales@nexa-test.co.uk');
    await page.getByLabel('Password').fill('Sales123!');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for dashboard to load after login
    await page.waitForURL('**/dashboard**', { timeout: 15000 });

    // Wait for sidebar to render with permissions
    const sidebar = page.locator('nav, [role="navigation"], aside, [data-testid="sidebar"]');
    await expect(sidebar.first()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // ── Step 1: Navigate to /system/company-profile ──
    // QA_TESTER grants canAccess+canView on system.company-profile.detail
    await page.goto('/system/company-profile');

    // Wait for the company profile page to load
    await page.waitForTimeout(2000);

    // Verify the page loaded successfully (not access denied)
    const accessDenied = page.getByText(/access denied/i)
      .or(page.getByText(/forbidden/i))
      .or(page.getByText(/not authorized/i))
      .or(page.getByText(/403/i));

    const isAccessDenied = await accessDenied.first().isVisible().catch(() => false);
    expect(isAccessDenied).toBeFalsy();

    // Verify the company profile page heading is present
    const companyProfileHeading = page.getByRole('heading', { name: /company profile/i })
      .or(page.getByText(/company profile/i));
    await expect(companyProfileHeading.first()).toBeVisible({ timeout: 5000 });

    // Visual Checkpoint 1: Company profile page loaded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-company-profile-loaded.png`,
      fullPage: true,
    });

    // ── Step 2: Verify vatNumber field is NOT displayed (HIDDEN override) ──
    // The QA_TESTER group has a HIDDEN field override on vatNumber for company-profile.
    // The field should be completely absent from the page — not just empty, but removed entirely.
    const vatNumberField = page.getByLabel(/vat\s*number/i)
      .or(page.locator('input[name="vatNumber"]'))
      .or(page.locator('[data-field="vatNumber"]'))
      .or(page.locator('#vatNumber'));

    // The vatNumber field should NOT be visible
    await expect(vatNumberField.first()).toBeHidden({ timeout: 5000 });

    // Also check that the label "VAT Number" does not appear in the form
    // (Be careful not to match "VAT" in other contexts if applicable)
    const vatNumberLabel = page.locator('label').filter({ hasText: /vat\s*number/i })
      .or(page.locator('[data-field-label="vatNumber"]'));

    const vatLabelVisible = await vatNumberLabel.first().isVisible().catch(() => false);
    expect(vatLabelVisible).toBeFalsy();

    // Visual Checkpoint 2: vatNumber field is absent
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-vat-number-absent.png`,
      fullPage: true,
    });

    // ── Step 3: Verify registrationNumber is present but READ_ONLY ──
    // The QA_TESTER group has a READ_ONLY field override on registrationNumber.
    // The field should be visible but non-editable (disabled, readonly, or styled as read-only).
    const regNumberField = page.getByLabel(/registration\s*number/i)
      .or(page.locator('input[name="registrationNumber"]'))
      .or(page.locator('[data-field="registrationNumber"]'))
      .or(page.locator('#registrationNumber'));

    // The registration number field should be visible
    await expect(regNumberField.first()).toBeVisible({ timeout: 5000 });

    // Verify the field is read-only or disabled
    // Check for common read-only indicators:
    //   1. disabled attribute
    //   2. readonly attribute
    //   3. aria-readonly attribute
    //   4. data-readonly attribute
    //   5. CSS class indicating read-only state
    const regField = regNumberField.first();

    const isDisabled = await regField.getAttribute('disabled').then(v => v !== null).catch(() => false);
    const isReadonly = await regField.getAttribute('readonly').then(v => v !== null).catch(() => false);
    const ariaReadonly = await regField.getAttribute('aria-readonly').then(v => v === 'true').catch(() => false);

    // At least one of the read-only indicators should be true
    // If the field is rendered as plain text (not an input), that also counts as read-only
    const isInputElement = await regField.evaluate(el => el.tagName.toLowerCase() === 'input' || el.tagName.toLowerCase() === 'textarea').catch(() => false);
    const isRenderedAsText = !isInputElement;

    const isFieldReadOnly = isDisabled || isReadonly || ariaReadonly || isRenderedAsText;
    expect(isFieldReadOnly).toBeTruthy();

    // Visual Checkpoint 3: registrationNumber visible but read-only
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-registration-number-readonly.png`,
      fullPage: true,
    });
  });
});
