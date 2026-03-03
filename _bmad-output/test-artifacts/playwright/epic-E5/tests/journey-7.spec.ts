import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5/journey-7';

test.describe('J07 — Use Header Search Bar for AI Command', () => {
  test.beforeEach(async ({ page }) => {
    // Login as Finance Manager (prerequisite for this journey)
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

  test('typing an AI command in the header search bar opens Co-Pilot drawer and processes the message', async ({
    page,
  }) => {
    // Visual Checkpoint 1: Dashboard loaded, drawer not open
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-0-dashboard-loaded.png`,
      fullPage: true,
    });

    // --- Step 1: Close Co-Pilot drawer if open ---
    // Check if the Co-Pilot drawer is currently visible
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

    // If the drawer is visible, close it
    if ((await copilotDrawer.count()) > 0 && (await copilotDrawer.isVisible())) {
      const closeButton = copilotDrawer
        .locator(
          [
            'button[aria-label*="close" i]',
            'button[aria-label*="dismiss" i]',
            '[data-testid="copilot-close"]',
            '[data-testid="drawer-close"]',
          ].join(', '),
        )
        .first();

      const closeButtonAlt = copilotDrawer.getByRole('button', { name: /close|dismiss|×|✕/i }).first();
      const closeBtnFinal = (await closeButton.count()) > 0 ? closeButton : closeButtonAlt;

      if ((await closeBtnFinal.count()) > 0 && (await closeBtnFinal.isVisible())) {
        await closeBtnFinal.click();
        await expect(copilotDrawer).toBeHidden({ timeout: 5000 });
      }
    }

    // Visual Checkpoint 2: Drawer confirmed closed
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-drawer-confirmed-closed.png`,
      fullPage: true,
    });

    // Verify the drawer is definitely not visible
    if ((await copilotDrawer.count()) > 0) {
      await expect(copilotDrawer).toBeHidden();
    }

    // --- Step 2: Type an AI command into the header unified search/AI input ---
    const searchInput = page
      .locator(
        [
          'input[placeholder*="Ask Nexa" i]',
          'input[placeholder*="Search" i]',
          'input[placeholder*="search" i]',
          '[data-testid="unified-search"]',
          '[data-testid="search-input"]',
          '[role="combobox"][aria-label*="search" i]',
          '[role="searchbox"]',
        ].join(', '),
      )
      .first();

    await expect(searchInput).toBeVisible({ timeout: 5000 });

    // Click to focus the search input, then type the AI command
    await searchInput.click();
    await searchInput.fill("Show me this month's revenue");

    // Verify text appeared in the search bar
    const inputValue = await searchInput.inputValue();
    expect(inputValue).toContain("Show me this month");

    // --- Step 3: Submit the AI command (press Enter) ---
    await searchInput.press('Enter');

    // Wait for the Co-Pilot drawer to open — the AI command should route to the Co-Pilot
    await expect(copilotDrawer).toBeVisible({ timeout: 10000 });

    // Visual Checkpoint 3: Co-Pilot drawer opened with AI command
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-copilot-opened-with-ai-response.png`,
      fullPage: true,
    });

    // Verify the user message appears in the conversation area
    // The text "Show me this month's revenue" should appear as a user message in the drawer
    const userMessage = copilotDrawer.locator(
      [
        '[data-testid*="message"]',
        '[class*="message"]',
        '[class*="Message"]',
        '[class*="chat-bubble"]',
        '[class*="ChatBubble"]',
        'p',
        'span',
        'div',
      ].join(', '),
    );

    // Wait for the user message to appear in the conversation
    await expect(
      copilotDrawer.getByText(/show me this month/i).first(),
    ).toBeVisible({ timeout: 10000 });

    // Wait for AI response — look for either a typing indicator that appears and then
    // an AI response, or just wait for a second message bubble to appear
    // The AI response should contain revenue-related content or at least be a non-empty response

    // Wait for either a typing indicator to appear and disappear, or for a response message
    // Give the AI up to 30 seconds to respond
    const aiResponseOrIndicator = copilotDrawer.locator(
      [
        '[data-testid*="ai-message"]',
        '[data-testid*="assistant-message"]',
        '[class*="ai-message"]',
        '[class*="assistant"]',
        '[class*="typing-indicator"]',
        '[class*="loading"]',
      ].join(', '),
    );

    // Wait for some AI response activity
    await expect(aiResponseOrIndicator.first()).toBeVisible({ timeout: 15000 });

    // Wait a bit for streaming to complete
    await page.waitForTimeout(5000);

    // Visual Checkpoint 4: AI response complete
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-ai-response-complete.png`,
      fullPage: true,
    });

    // Verify the conversation now has content beyond just the user message
    // There should be at least 2 message elements (user message + AI response)
    // or the drawer should contain substantive text beyond just the user's input
    const allTextInDrawer = await copilotDrawer.textContent();
    expect(allTextInDrawer).toBeTruthy();
    expect(allTextInDrawer!.length).toBeGreaterThan(50); // Should have meaningful content

    // Verify the Co-Pilot drawer is still open and functional
    await expect(copilotDrawer).toBeVisible();

    // Verify the chat input is available for follow-up messages
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

    await expect(chatInput).toBeVisible({ timeout: 5000 });
  });
});
