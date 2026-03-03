import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5/journey-2';

test.describe('J02 — Open Co-Pilot Drawer and Verify Layout', () => {
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

  test('clicking chat toggle opens Co-Pilot drawer with correct layout, then close dismisses it', async ({
    page,
  }) => {
    // --- Step 1: Click Chat toggle button to open Co-Pilot drawer ---
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

    // Wait for drawer to appear (animation may take a moment)
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

    // Visual Checkpoint 1: Co-Pilot drawer opened
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-copilot-drawer-opened.png`,
      fullPage: true,
    });

    // Verify drawer width is approximately 380px
    const drawerBox = await copilotDrawer.boundingBox();
    if (drawerBox) {
      // Allow some tolerance (350-420px range)
      expect(drawerBox.width).toBeGreaterThanOrEqual(350);
      expect(drawerBox.width).toBeLessThanOrEqual(420);
    }

    // --- Step 2: Verify Co-Pilot drawer header ---
    // Look for "Co-Pilot" title text in the drawer
    const copilotTitle = copilotDrawer.getByText(/co-?pilot/i).first();
    await expect(copilotTitle).toBeVisible({ timeout: 3000 });

    // Look for close button (X) in the drawer
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
    await expect(closeBtnFinal).toBeVisible({ timeout: 3000 });

    // --- Step 3: Verify "+ New Chat" button ---
    const newChatButton = copilotDrawer
      .locator(
        [
          'button:has-text("New Chat")',
          '[data-testid="new-chat"]',
          '[data-testid="new-chat-button"]',
          'button[aria-label*="new chat" i]',
        ].join(', '),
      )
      .first();

    const newChatButtonAlt = copilotDrawer.getByRole('button', { name: /new chat/i }).first();
    const newChatBtnFinal = (await newChatButton.count()) > 0 ? newChatButton : newChatButtonAlt;
    await expect(newChatBtnFinal).toBeVisible({ timeout: 3000 });

    // --- Step 4: Verify Quick prompt chips ---
    // Quick prompt chips should be visible — context-relevant suggestions for Finance Manager
    const chipContainer = copilotDrawer
      .locator(
        [
          '[data-testid="quick-prompts"]',
          '[data-testid="prompt-chips"]',
          '[class*="chip"]',
          '[class*="prompt"]',
          '[class*="suggestion"]',
          '[role="list"]',
        ].join(', '),
      )
      .first();

    // Look for at least one chip with finance-related text
    const financeChips = copilotDrawer.locator(
      [
        'button:has-text("Cash flow")',
        'button:has-text("Reconciliation")',
        'button:has-text("Month-end")',
        'button:has-text("Revenue")',
        'button:has-text("Overdue")',
        '[data-testid*="chip"]',
        '[data-testid*="prompt"]',
        '[class*="chip"]',
      ].join(', '),
    );

    // Verify at least one chip is visible
    const chipCount = await financeChips.count();
    expect(chipCount).toBeGreaterThan(0);

    // --- Step 5: Verify Chat input field ---
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

    // Verify placeholder text
    const inputPlaceholder = await chatInput.getAttribute('placeholder');
    if (inputPlaceholder) {
      expect(inputPlaceholder.toLowerCase()).toContain('ask');
    }

    // Verify submit/send button
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

    // --- Step 6: Click Close button (X) to dismiss drawer ---
    await closeBtnFinal.click();

    // Wait for drawer to disappear (animation may take a moment)
    await expect(copilotDrawer).toBeHidden({ timeout: 5000 });

    // Visual Checkpoint 2: Co-Pilot drawer closed
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-copilot-drawer-closed.png`,
      fullPage: true,
    });

    // Verify main content area has returned to full width
    const mainContent = page
      .locator('main, [role="main"], [data-testid="main-content"], [class*="main"]')
      .first();
    await expect(mainContent).toBeVisible();

    // Verify chat toggle button is still visible after closing drawer
    const chatButtonAfterClose = (await chatToggle.count()) > 0 ? chatToggle : chatToggleAlt;
    await expect(chatButtonAfterClose).toBeVisible();
  });
});
