import { test, expect } from '@playwright/test';

const SCREENSHOT_DIR =
  '_bmad-output/test-artifacts/screenshots/epic-E9/journey-11';

test.describe('Journey 11: Navigation Blocker for Unsaved Changes', () => {
  test('Unsaved changes on preferences page triggers blocker dialog on navigation', async ({
    page,
  }) => {
    // Login first
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

    // Step 1 — Navigate to notification preferences
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
    const firstToggle = page.getByRole('switch').first();
    await expect(firstToggle).toBeVisible({ timeout: 10000 });

    // Verify Save button starts disabled
    const saveButton = page.getByRole('button', {
      name: /save preferences/i,
    });
    await expect(saveButton).toBeVisible();

    // Checkpoint 1: Preferences page loaded
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/step-1-preferences-page-loaded.png`,
    });

    // Step 2 — Click any channel toggle switch to create a dirty state
    const initialState = await firstToggle.getAttribute('data-state');
    await firstToggle.click();

    // Verify the toggle actually changed
    const expectedNewState =
      initialState === 'checked' ? 'unchecked' : 'checked';
    await expect(firstToggle).toHaveAttribute('data-state', expectedNewState, {
      timeout: 5000,
    });

    // Verify unsaved changes warning appeared
    const unsavedStatus = page.locator('[role="status"]');
    await expect(unsavedStatus).toBeVisible({ timeout: 5000 });
    await expect(unsavedStatus).toContainText(/unsaved changes/i);

    // Verify Save button is enabled
    await expect(saveButton).toBeEnabled({ timeout: 5000 });

    // Checkpoint 2: Toggle changed, dirty state active
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/step-2-toggle-changed-dirty-state.png`,
    });

    // Step 3 — Click a sidebar navigation link (Dashboard)
    const dashboardLink = page
      .locator('aside')
      .getByRole('link', { name: /dashboard/i });
    await expect(dashboardLink).toBeVisible({ timeout: 5000 });
    await dashboardLink.click();

    // Step 3 verify — Navigation blocker dialog should appear
    const blockerDialog = page.getByRole('alertdialog');
    await expect(blockerDialog).toBeVisible({ timeout: 5000 });

    // Verify dialog content
    await expect(
      blockerDialog.getByText(/unsaved changes/i).first()
    ).toBeVisible();

    const cancelButton = blockerDialog.getByRole('button', {
      name: /cancel/i,
    });
    const discardButton = blockerDialog.getByRole('button', {
      name: /discard.*leave/i,
    });
    await expect(cancelButton).toBeVisible();
    await expect(discardButton).toBeVisible();

    // Checkpoint 3: Navigation blocker dialog visible
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/step-3-navigation-blocker-dialog.png`,
    });

    // Step 4 — Click Cancel to stay on page
    await cancelButton.click();

    // Dialog should close
    await expect(blockerDialog).not.toBeVisible({ timeout: 5000 });

    // Verify we're still on the preferences page with unsaved changes
    await expect(pageTitle).toBeVisible();
    await expect(unsavedStatus).toBeVisible();
    await expect(firstToggle).toHaveAttribute('data-state', expectedNewState);

    // Step 5 — Click sidebar navigation link again
    await dashboardLink.click();

    // Blocker dialog should appear again
    await expect(blockerDialog).toBeVisible({ timeout: 5000 });

    // Step 6 — Click 'Discard & Leave' to navigate away
    const discardButtonAgain = blockerDialog.getByRole('button', {
      name: /discard.*leave/i,
    });
    await discardButtonAgain.click();

    // Dialog should close and user should navigate away
    await expect(blockerDialog).not.toBeVisible({ timeout: 5000 });

    // Verify we navigated away from preferences page
    await page.waitForLoadState('networkidle');

    // We should no longer be on the notification preferences page
    const preferencesHeading = page.getByRole('heading', {
      name: /notification preferences/i,
    });
    await expect(preferencesHeading).not.toBeVisible({ timeout: 10000 });

    // Checkpoint 4: Navigated away after discarding
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/step-4-navigated-to-dashboard.png`,
    });
  });
});
