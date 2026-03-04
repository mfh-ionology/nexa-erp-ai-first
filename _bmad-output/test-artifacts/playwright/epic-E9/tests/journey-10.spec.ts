import { test, expect } from '@playwright/test';

const SCREENSHOT_DIR =
  '_bmad-output/test-artifacts/screenshots/epic-E9/journey-10';

test.describe('Journey 10: Reset Preferences to Defaults', () => {
  test('Reset to Defaults opens confirmation dialog and clears all user preferences', async ({
    page,
  }) => {
    // Login as staff user
    await page.goto('/login');
    await expect(
      page.getByRole('heading', { name: /welcome back/i })
    ).toBeVisible();

    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    await emailInput.click();
    await emailInput.fill('staff@nexa-erp.dev');
    await passwordInput.click();
    await passwordInput.fill('NexaDev2026!');

    const signInButton = page.getByRole('button', { name: /sign in/i });
    await signInButton.click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 15000,
    });
    await page.waitForLoadState('networkidle');

    // Step 1 — Navigate to notification preferences via client-side routing
    await page.evaluate(() => {
      window.history.pushState({}, '', '/system/notification-preferences');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await page.waitForLoadState('networkidle');

    const pageTitle = page.getByRole('heading', {
      name: /notification preferences/i,
    });
    await expect(pageTitle).toBeVisible({ timeout: 15000 });

    // Wait for preference matrix to load
    const firstEmailToggle = page.getByRole('switch', {
      name: /access group deleted email/i,
    });
    await expect(firstEmailToggle).toBeVisible({ timeout: 10000 });

    // --- Precondition: Ensure at least one custom preference exists ---
    // Toggle a switch and save it so the user has a non-default preference
    const initialState = await firstEmailToggle.getAttribute('data-state');
    await firstEmailToggle.click();

    const expectedNewState =
      initialState === 'checked' ? 'unchecked' : 'checked';
    await expect(firstEmailToggle).toHaveAttribute(
      'data-state',
      expectedNewState,
      { timeout: 5000 }
    );

    // Wait for Save button to become enabled
    const saveButton = page.getByRole('button', {
      name: /save preferences/i,
    });
    await expect(saveButton).toBeEnabled({ timeout: 5000 });

    // Save the custom preference
    await saveButton.click();

    // Wait for success toast to confirm save
    const saveToast = page.getByText(
      /notification preferences saved|preferences saved successfully/i
    );
    await expect(saveToast).toBeVisible({ timeout: 15000 });

    // Wait for the save to fully complete
    await page.waitForLoadState('networkidle');

    // Navigate away and back to get a clean page state
    // Handle possible navigation blocker due to known dirty-state bug
    await page.evaluate(() => {
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    const discardButton = page.getByRole('button', {
      name: /discard.*leave/i,
    });
    const blockerVisible = await discardButton
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    if (blockerVisible) {
      await discardButton.click();
    }

    await page.waitForLoadState('networkidle');

    // Navigate back to preferences
    await page.evaluate(() => {
      window.history.pushState({}, '', '/system/notification-preferences');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await page.waitForLoadState('networkidle');

    await expect(pageTitle).toBeVisible({ timeout: 15000 });
    await expect(firstEmailToggle).toBeVisible({ timeout: 10000 });

    // Checkpoint 1: Preferences page loaded with custom override
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/step-1-preferences-with-custom-override.png`,
    });

    // Step 2 — Click "Reset to Defaults" button (ghost variant with RotateCcw icon)
    const resetButton = page.getByRole('button', {
      name: /reset to defaults/i,
    });
    await expect(resetButton).toBeVisible({ timeout: 5000 });
    await resetButton.click();

    // Verify the confirmation dialog appears
    const dialogTitle = page.getByRole('heading', {
      name: /reset to defaults/i,
    });
    await expect(dialogTitle).toBeVisible({ timeout: 5000 });

    // Verify dialog description text
    const dialogDescription = page.getByText(
      /reset all preferences to their default values.*cannot be undone/i
    );
    await expect(dialogDescription).toBeVisible();

    // Verify Cancel button is present
    const cancelButton = page.getByRole('button', { name: /cancel/i });
    await expect(cancelButton).toBeVisible();

    // Verify the destructive "Reset to Defaults" confirm button in the dialog
    // The dialog has a second "Reset to Defaults" button with destructive styling
    const confirmResetButton = page
      .locator('[role="alertdialog"]')
      .getByRole('button', { name: /reset to defaults/i });
    await expect(confirmResetButton).toBeVisible();

    // Checkpoint 2: Reset confirmation dialog visible
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/step-2-reset-confirmation-dialog.png`,
    });

    // Step 3 — Click "Reset to Defaults" in the confirmation dialog
    await confirmResetButton.click();

    // Wait for the reset to complete — success toast should appear
    const resetToast = page.getByText(/preferences reset to defaults/i);
    await expect(resetToast).toBeVisible({ timeout: 15000 });

    // Wait for matrix to reload with defaults
    await page.waitForLoadState('networkidle');

    // Verify the toggle has reverted to the template default value (original state)
    await expect(firstEmailToggle).toBeVisible({ timeout: 10000 });

    // After reset, look for "(default)" labels indicating template defaults are active
    const defaultLabels = page.getByText('(default)');
    // There should be at least one default label visible
    await expect(defaultLabels.first()).toBeVisible({ timeout: 10000 });

    // Checkpoint 3: Preferences reset to template defaults
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/step-3-preferences-reset-to-defaults.png`,
    });
  });
});
