import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5/journey-23';

test.describe('J23 — RBAC — Viewer Cannot Access Chat or Predictions', () => {
  test('should allow VIEWER to see briefing but restrict chat and predictions', async ({
    page,
  }) => {
    // ─── Step 1: Navigate to login ───
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);

    // ─── Step 2: Fill login form with VIEWER credentials ───
    await page.getByLabel(/email/i).fill('viewer@nexa-test.co.uk');
    await page.getByLabel(/password/i).fill('View123!');

    // ─── Step 3: Click Sign In ───
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for navigation away from login — should land on dashboard
    await page.waitForURL(/^(?!.*\/login)/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // ─── Step 4: Verify Daily Briefing is visible for VIEWER ───
    // VIEWER has ai.briefing permission (VIEWER minimum), so the briefing should appear
    const briefingSection = page
      .locator('[data-testid="daily-briefing"], [data-testid="briefing-section"]')
      .or(page.getByRole('region', { name: /briefing/i }))
      .or(page.getByText(/daily briefing/i).first())
      .or(page.getByText(/good (morning|afternoon|evening)/i).first());

    const briefingVisible = await briefingSection.isVisible().catch(() => false);

    // ─── CHECKPOINT 1: Dashboard with briefing visible for VIEWER ───
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-viewer-dashboard-briefing-visible.png`,
      fullPage: true,
    });

    // Assert the briefing section is visible — VIEWER should have access
    expect(
      briefingVisible,
      'Expected Daily Briefing section to be visible for VIEWER (ai.briefing requires VIEWER minimum)'
    ).toBeTruthy();

    // ─── Step 5: Click Chat toggle button — should be restricted for VIEWER ───
    // VIEWER lacks ai.chat permission (STAFF minimum required)
    // The chat toggle button may be: disabled, hidden, or show a permission error when clicked
    const chatToggle = page
      .getByRole('button', { name: /co-?pilot|chat|ai assistant/i })
      .or(page.locator('[data-testid="chat-toggle"]'))
      .or(page.locator('[data-testid="copilot-toggle"]'))
      .or(page.locator('[aria-label*="chat" i]'))
      .or(page.locator('[aria-label*="co-pilot" i]'));

    const chatToggleVisible = await chatToggle.first().isVisible().catch(() => false);

    if (chatToggleVisible) {
      // Check if the button is disabled
      const isDisabled = await chatToggle.first().isDisabled().catch(() => false);

      if (!isDisabled) {
        // Button is visible and enabled — click it and check for permission error
        await chatToggle.first().click();
        await page.waitForTimeout(1000);
      }

      // After click (or if disabled), verify chat is not functional
      // Look for permission error messages or disabled state
      const permissionDeniedChat = page
        .getByText(/do not have permission/i)
        .or(page.getByText(/permission denied/i))
        .or(page.getByText(/not authorised/i))
        .or(page.getByText(/not authorized/i))
        .or(page.getByText(/access denied/i))
        .or(page.getByText(/restricted/i))
        .or(page.getByText(/upgrade.*access/i));

      // The chat input should NOT be available, OR a permission error should be shown
      const chatInput = page
        .getByPlaceholder(/ask nexa/i)
        .or(page.locator('[data-testid="chat-input"]'))
        .or(page.locator('[data-testid="copilot-input"]'));

      const chatInputVisible = await chatInput.first().isVisible().catch(() => false);
      const permissionErrorVisible = await permissionDeniedChat
        .first()
        .isVisible()
        .catch(() => false);

      // ─── CHECKPOINT 2: Chat restricted for VIEWER ───
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-5-chat-restricted-for-viewer.png`,
        fullPage: true,
      });

      // Assert: either chat input is NOT visible, OR a permission error IS shown, OR button was disabled
      const chatRestricted = isDisabled || !chatInputVisible || permissionErrorVisible;
      expect(
        chatRestricted,
        'Expected AI chat to be restricted for VIEWER (ai.chat requires STAFF minimum). ' +
          `Button disabled: ${isDisabled}, Chat input visible: ${chatInputVisible}, Permission error: ${permissionErrorVisible}`
      ).toBeTruthy();
    } else {
      // Chat toggle button is completely hidden for VIEWER — that is valid RBAC
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/step-5-chat-restricted-for-viewer.png`,
        fullPage: true,
      });

      // Hidden toggle = restricted. This is acceptable.
      expect(chatToggleVisible).toBeFalsy();
    }

    // Close any open drawer before navigating
    const closeButton = page
      .getByRole('button', { name: /close/i })
      .or(page.locator('[data-testid="copilot-close"]'))
      .or(page.locator('[data-testid="drawer-close"]'))
      .or(page.locator('[aria-label*="close" i]'));

    const closeVisible = await closeButton.first().isVisible().catch(() => false);
    if (closeVisible) {
      await closeButton.first().click();
      await page.waitForTimeout(500);
    }

    // ─── Step 6: Navigate to /ai/predictions/cash-flow — should be restricted ───
    // VIEWER lacks ai.predictions permission (MANAGER minimum required)
    await page.goto('/ai/predictions/cash-flow');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Check for permission denied state
    const permissionDeniedPredictions = page
      .getByText(/do not have permission/i)
      .or(page.getByText(/permission denied/i))
      .or(page.getByText(/not authorised/i))
      .or(page.getByText(/not authorized/i))
      .or(page.getByText(/access denied/i))
      .or(page.getByText(/403/i))
      .or(page.getByText(/forbidden/i))
      .or(page.getByText(/restricted/i))
      .or(page.getByText(/upgrade.*access/i));

    // Check if redirected away from predictions page
    const currentUrl = page.url();
    const redirectedAway = !currentUrl.includes('/ai/predictions');

    // Check if the predictions form/content is absent
    const predictionsForm = page
      .getByRole('button', { name: /generate forecast/i })
      .or(page.locator('[data-testid="forecast-form"]'))
      .or(page.getByText(/cash flow forecast/i));

    const predictionsFormVisible = await predictionsForm.first().isVisible().catch(() => false);
    const predictionsDenied = await permissionDeniedPredictions
      .first()
      .isVisible()
      .catch(() => false);

    // ─── CHECKPOINT 3: Predictions permission denied for VIEWER ───
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-predictions-permission-denied.png`,
      fullPage: true,
    });

    // Assert: either redirected away, predictions form is NOT visible, or permission error IS shown
    const predictionsRestricted = redirectedAway || !predictionsFormVisible || predictionsDenied;
    expect(
      predictionsRestricted,
      'Expected AI predictions to be restricted for VIEWER (ai.predictions requires MANAGER minimum). ' +
        `Redirected: ${redirectedAway}, Form visible: ${predictionsFormVisible}, Permission error: ${predictionsDenied}`
    ).toBeTruthy();
  });
});
