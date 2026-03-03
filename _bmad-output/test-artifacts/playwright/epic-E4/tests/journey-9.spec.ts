import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E4/journey-9';

test.describe('Journey 9: User Locale Preference Change and Fallback Chain', () => {
  test('j09 — Edit user locale to en-GB, verify i18n fallback chain keeps UI in English', async ({
    page,
  }) => {
    // Step 1: Navigate to /login
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Step 2: Fill login form with admin credentials
    const emailField = page.getByRole('textbox', { name: /email/i });
    const passwordField = page.locator('input[type="password"]');

    const emailInput = (await emailField.count()) > 0
      ? emailField
      : page.getByLabel(/email/i);

    await emailInput.fill('admin@nexa-test.co.uk');
    await passwordField.fill('Admin123!');

    // Step 3: Click Sign In button
    const signInButton = page.getByRole('button', { name: /sign in|log in|submit|login/i });
    await signInButton.click();

    // Wait for login to succeed — we should leave /login
    await page.waitForURL(/^(?!.*\/login).*$/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // Visual Checkpoint 1: Dashboard loaded after login
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-dashboard-after-login.png`,
      fullPage: true,
    });

    // Step 4: Navigate to /system/users
    await page.goto('/system/users');
    await page.waitForLoadState('networkidle');

    // Verify user list page loaded
    await expect(
      page.getByRole('heading', { name: /users/i })
        .or(page.locator('h1, h2').filter({ hasText: /users/i }))
    ).toBeVisible({ timeout: 10000 });

    // Step 5: Click on admin user row or edit link to open user detail
    // Look for the admin user row — try clicking on the email or name text, or an edit button
    const adminRow = page.getByText('admin@nexa-test.co.uk').first();
    const editButton = page.getByRole('link', { name: /edit/i })
      .or(page.getByRole('button', { name: /edit/i }));

    // Try clicking the admin row directly — if it's a link or clickable row
    if (await adminRow.isVisible()) {
      // Try to find a clickable element in the same row
      const row = page.locator('tr, [data-testid*="row"], [role="row"]')
        .filter({ hasText: 'admin@nexa-test.co.uk' });

      // Try clicking an edit button/link within the row first
      const rowEditLink = row.getByRole('link', { name: /edit|view/i })
        .or(row.getByRole('button', { name: /edit|view/i }));

      if (await rowEditLink.count() > 0) {
        await rowEditLink.first().click();
      } else {
        // Click the row itself — may navigate to detail page
        await adminRow.click();
      }
    } else {
      // If admin email isn't visible, try the first edit button
      await editButton.first().click();
    }

    // Wait for user detail/edit page to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Visual Checkpoint 2: User detail page with locale field
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-user-detail-locale-field.png`,
      fullPage: true,
    });

    // Step 6: Verify locale field exists on the user edit form
    const localeField = page.getByLabel(/locale|language/i)
      .or(page.getByRole('combobox', { name: /locale|language/i }))
      .or(page.getByRole('textbox', { name: /locale|language/i }))
      .or(page.locator('[name="locale"], [data-testid*="locale"], select[name*="locale"]'));

    await expect(
      localeField.first(),
      'Locale field should be visible on the user edit form'
    ).toBeVisible({ timeout: 10000 });

    // Step 7: Change locale to 'en-GB'
    const firstLocale = localeField.first();
    const tagName = await firstLocale.evaluate(el => el.tagName.toLowerCase());

    if (tagName === 'select') {
      // If it's a <select> dropdown, select the en-GB option
      await firstLocale.selectOption({ value: 'en-GB' });
    } else if (tagName === 'input') {
      // If it's a text input, clear and type en-GB
      await firstLocale.clear();
      await firstLocale.fill('en-GB');
    } else {
      // Might be a combobox or custom dropdown — try clicking and selecting
      await firstLocale.click();
      const option = page.getByRole('option', { name: /en-GB/i })
        .or(page.getByText('en-GB'));
      if (await option.count() > 0) {
        await option.first().click();
      } else {
        // Fallback: try fill if it's some kind of input
        await firstLocale.fill('en-GB');
      }
    }

    // Step 8: Click Save button
    const saveButton = page.getByRole('button', { name: /save|update|submit/i });
    await saveButton.click();

    // Wait for save operation to complete
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');

    // Visual Checkpoint 3: Success after locale change to en-GB
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-8-locale-saved-en-gb.png`,
      fullPage: true,
    });

    // Step 9: Verify sidebar still shows 'Dashboard' in English after locale change
    // The i18n fallback chain (user locale -> company locale -> 'en') should resolve
    // 'en-GB' -> 'en' since en-GB is not a separate locale file
    const sidebar = page.getByRole('navigation')
      .or(page.locator('[data-testid*="sidebar"], aside, nav'));
    await expect(
      sidebar.getByText('Dashboard', { exact: false }),
      'Sidebar should still show "Dashboard" after locale change — en-GB falls back to en'
    ).toBeVisible();

    // Also verify no raw i18n keys appeared after locale change
    const pageContent = await page.textContent('body');
    expect(pageContent).not.toContain('navigation:');
    expect(pageContent).not.toContain('common:');
    expect(pageContent).not.toContain('{{');

    // Step 10: Reset locale back to 'en'
    // Navigate back to the user edit page if we're no longer there
    const currentUrl = page.url();
    if (!currentUrl.includes('/system/users/')) {
      // Navigate back to user list and click admin user again
      await page.goto('/system/users');
      await page.waitForLoadState('networkidle');

      const adminRowAgain = page.getByText('admin@nexa-test.co.uk').first();
      if (await adminRowAgain.isVisible()) {
        const rowAgain = page.locator('tr, [data-testid*="row"], [role="row"]')
          .filter({ hasText: 'admin@nexa-test.co.uk' });
        const rowEditAgain = rowAgain.getByRole('link', { name: /edit|view/i })
          .or(rowAgain.getByRole('button', { name: /edit|view/i }));

        if (await rowEditAgain.count() > 0) {
          await rowEditAgain.first().click();
        } else {
          await adminRowAgain.click();
        }
      }
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
    }

    // Re-locate the locale field
    const localeFieldReset = page.getByLabel(/locale|language/i)
      .or(page.getByRole('combobox', { name: /locale|language/i }))
      .or(page.getByRole('textbox', { name: /locale|language/i }))
      .or(page.locator('[name="locale"], [data-testid*="locale"], select[name*="locale"]'));

    const resetField = localeFieldReset.first();
    const resetTagName = await resetField.evaluate(el => el.tagName.toLowerCase());

    if (resetTagName === 'select') {
      await resetField.selectOption({ value: 'en' });
    } else if (resetTagName === 'input') {
      await resetField.clear();
      await resetField.fill('en');
    } else {
      await resetField.click();
      const enOption = page.getByRole('option', { name: /^en$/i })
        .or(page.getByText(/^en$/));
      if (await enOption.count() > 0) {
        await enOption.first().click();
      } else {
        await resetField.fill('en');
      }
    }

    // Step 11: Click Save to reset locale
    const saveButtonReset = page.getByRole('button', { name: /save|update|submit/i });
    await saveButtonReset.click();

    // Wait for save to complete
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');

    // Verify locale was reset — page should still be in English
    const finalContent = await page.textContent('body');
    expect(finalContent).not.toContain('navigation:');
    expect(finalContent).not.toContain('common:');
  });
});
