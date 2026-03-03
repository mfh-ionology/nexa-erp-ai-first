import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5/journey-19';

test.describe('J19 — HTTP Fallback When WebSocket Unavailable', () => {
  test.beforeEach(async ({ page }) => {
    // Login as Finance Manager
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const emailInput = page.getByRole('textbox', { name: /email/i });
    await expect(emailInput).toBeVisible({ timeout: 15000 });
    await emailInput.fill('finance@nexa-test.co.uk');

    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();
    await passwordInput.fill('Finance123!');

    const signInButton = page.getByRole('button', { name: /sign in|log in|submit|login/i });
    await expect(signInButton).toBeVisible();
    await signInButton.click();

    // Wait for navigation away from /login — dashboard should load
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
    await page.waitForLoadState('networkidle');
  });

  test('sends a chat message via HTTP fallback when WebSocket is unavailable', async ({ page }) => {
    // --- Step 1: Block WebSocket connections to force HTTP fallback ---
    // Intercept WebSocket upgrade requests to /ai/chat to simulate WS unavailability.
    // We block any request that looks like a Socket.io WebSocket connection.
    await page.route('**/socket.io/**', (route) => {
      // Block WebSocket upgrade and polling requests to force HTTP fallback
      route.abort('connectionrefused');
    });
    await page.route('**/ai/chat/socket**', (route) => {
      route.abort('connectionrefused');
    });

    // Navigate to dashboard (which will try and fail to establish WebSocket)
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait a moment for the WS connection attempt to fail and fallback to kick in
    await page.waitForTimeout(3000);

    // --- Step 2: Click Chat toggle button to open Co-Pilot drawer ---
    const chatToggle = page
      .locator(
        [
          'button[aria-label*="chat" i]',
          'button[aria-label*="copilot" i]',
          'button[aria-label*="co-pilot" i]',
          '[data-testid="copilot-chat-button"]',
          '[data-testid="chat-toggle"]',
        ].join(', '),
      )
      .first();

    const chatToggleAlt = page.getByRole('button', { name: /chat|copilot|co-pilot|assistant/i }).first();
    const chatButton = (await chatToggle.count()) > 0 ? chatToggle : chatToggleAlt;
    await expect(chatButton).toBeVisible({ timeout: 5000 });
    await chatButton.click();

    // Wait for the Co-Pilot drawer to appear
    const copilotDrawer = page
      .locator(
        [
          '[data-testid="copilot-drawer"]',
          '[class*="copilot-drawer"]',
          '[class*="CopilotDrawer"]',
          '[aria-label*="Co-Pilot" i]',
          '[aria-label*="copilot" i]',
          '[role="complementary"]',
        ].join(', '),
      )
      .first();

    await expect(copilotDrawer).toBeVisible({ timeout: 5000 });

    // Optionally check for a fallback/HTTP mode indicator
    const fallbackIndicator = copilotDrawer
      .locator(
        [
          '[data-testid="connection-status"]',
          '[data-testid="fallback-indicator"]',
          '[class*="fallback"]',
          '[class*="http-mode"]',
          '[class*="offline"]',
          '[aria-label*="HTTP mode" i]',
          '[aria-label*="fallback" i]',
        ].join(', '),
      )
      .first();

    // Soft check — the indicator may or may not be present depending on implementation
    const hasFallbackIndicator = (await fallbackIndicator.count()) > 0;
    if (hasFallbackIndicator) {
      await expect(fallbackIndicator).toBeVisible({ timeout: 3000 });
    }

    // --- Step 3: Fill chat input with message ---
    const chatInput = copilotDrawer
      .locator(
        [
          'input[placeholder*="Ask Nexa" i]',
          'textarea[placeholder*="Ask Nexa" i]',
          'input[placeholder*="ask" i]',
          'textarea[placeholder*="ask" i]',
          '[data-testid="chat-input"]',
          '[data-testid="copilot-input"]',
          '[contenteditable="true"]',
        ].join(', '),
      )
      .first();

    await expect(chatInput).toBeVisible({ timeout: 3000 });
    await chatInput.fill('What is my cash position today?');

    // Verify the message text is in the input
    const inputValue =
      (await chatInput.inputValue().catch(() => null)) ||
      (await chatInput.textContent().catch(() => null));
    expect(inputValue).toContain('What is my cash position today?');

    // --- Step 4: Click Send button — message sent via HTTP POST fallback ---
    const sendButton = copilotDrawer
      .locator(
        [
          'button[aria-label*="send" i]',
          'button[aria-label*="submit" i]',
          '[data-testid="send-button"]',
          '[data-testid="chat-send"]',
          'button[type="submit"]',
        ].join(', '),
      )
      .first();

    const sendButtonAlt = copilotDrawer.getByRole('button', { name: /send|submit/i }).first();
    const sendBtnFinal = (await sendButton.count()) > 0 ? sendButton : sendButtonAlt;
    await expect(sendBtnFinal).toBeVisible({ timeout: 3000 });
    await sendBtnFinal.click();

    // Wait for the user message to appear in the conversation
    const userMessageText = copilotDrawer.getByText('What is my cash position today?').first();
    await expect(userMessageText).toBeVisible({ timeout: 10000 });

    // Wait for the AI response via HTTP fallback (non-streaming — arrives all at once)
    // The response should appear as a complete message, not streamed token-by-token
    const aiMessage = copilotDrawer
      .locator(
        [
          '[data-testid*="ai-message"]',
          '[data-testid*="assistant-message"]',
          '[class*="ai-message"]',
          '[class*="aiMessage"]',
          '[class*="assistant-message"]',
          '[class*="assistantMessage"]',
          '[data-role="assistant"]',
          '[data-sender="assistant"]',
          '[data-sender="ai"]',
        ].join(', '),
      )
      .first();

    // Allow up to 30s for the HTTP fallback response to complete
    await expect(aiMessage).toBeVisible({ timeout: 30000 });

    // Wait for the response to fully render
    await page.waitForTimeout(2000);

    // Verify the AI response contains meaningful text
    const aiMessageText = await aiMessage.textContent();
    expect(aiMessageText).toBeTruthy();
    expect(aiMessageText!.trim().length).toBeGreaterThan(10);

    // Verify both user message and AI response are visible (full conversation)
    await expect(userMessageText).toBeVisible();
    await expect(aiMessage).toBeVisible();

    // Verify there are no visible error banners that would indicate a broken state
    const errorBanner = page
      .locator(
        [
          '[role="alert"]:has-text("error")',
          '[class*="error-banner"]',
          '[class*="errorBanner"]',
          '[data-testid="error-banner"]',
        ].join(', '),
      )
      .first();

    // If an error banner exists, it should NOT be about a fatal/unrecoverable error
    // A soft "HTTP mode" notice is OK; a hard "Connection failed, cannot chat" error is not
    if ((await errorBanner.count()) > 0) {
      const errorText = await errorBanner.textContent();
      // Accept connection-mode notices, fail on blocking errors
      if (errorText) {
        expect(errorText.toLowerCase()).not.toContain('cannot send');
        expect(errorText.toLowerCase()).not.toContain('unable to connect');
      }
    }

    // Visual Checkpoint 1: HTTP fallback response received — complete conversation visible
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-http-fallback-response.png`,
      fullPage: true,
    });
  });
});
