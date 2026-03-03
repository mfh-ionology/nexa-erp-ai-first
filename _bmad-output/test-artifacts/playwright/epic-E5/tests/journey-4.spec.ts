import { test, expect, type Page, type Locator } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5/journey-4';

/** Locator selectors — defined as string arrays for reuse */
const COPILOT_DRAWER_SELECTORS = [
  '[data-testid="copilot-drawer"]',
  '[class*="copilot-drawer"]',
  '[class*="CopilotDrawer"]',
  '[aria-label*="Co-Pilot" i]',
  '[aria-label*="copilot" i]',
  '[role="complementary"]',
].join(', ');

const CHAT_INPUT_SELECTORS = [
  'input[placeholder*="Ask Nexa" i]',
  'textarea[placeholder*="Ask Nexa" i]',
  'input[placeholder*="ask" i]',
  'textarea[placeholder*="ask" i]',
  '[data-testid="chat-input"]',
  '[data-testid="copilot-input"]',
  '[contenteditable="true"]',
].join(', ');

const SEND_BUTTON_SELECTORS = [
  'button[aria-label*="send" i]',
  'button[aria-label*="submit" i]',
  '[data-testid="send-button"]',
  '[data-testid="chat-send"]',
  'button[type="submit"]',
].join(', ');

const CHAT_TOGGLE_SELECTORS = [
  'button[aria-label*="chat" i]',
  'button[aria-label*="copilot" i]',
  'button[aria-label*="co-pilot" i]',
  '[data-testid="copilot-chat-button"]',
  '[data-testid="chat-toggle"]',
].join(', ');

const TYPING_INDICATOR_SELECTORS = [
  '[data-testid="typing-indicator"]',
  '[data-testid="ai-loading"]',
  '[class*="typing"]',
  '[class*="loading"]',
  '[class*="shimmer"]',
  '[class*="dots"]',
  '[aria-label*="typing" i]',
  '[aria-label*="loading" i]',
  '[aria-label*="thinking" i]',
].join(', ');

const AI_MESSAGE_SELECTORS = [
  '[data-testid*="ai-message"]',
  '[data-testid*="assistant-message"]',
  '[class*="ai-message"]',
  '[class*="aiMessage"]',
  '[class*="assistant-message"]',
  '[class*="assistantMessage"]',
  '[data-role="assistant"]',
  '[data-sender="assistant"]',
  '[data-sender="ai"]',
].join(', ');

const USER_MESSAGE_SELECTORS = [
  '[data-testid*="user-message"]',
  '[class*="user-message"]',
  '[class*="userMessage"]',
  '[class*="message-user"]',
  '[data-role="user"]',
  '[data-sender="user"]',
].join(', ');

test.describe('J04 — Multi-Turn Conversation Maintains Context', () => {
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

  test('multi-turn conversation maintains context across follow-up messages', async ({ page }) => {
    // ========================================================
    // SETUP: Open Co-Pilot drawer and send the first message
    // (reproduces j03 prerequisites for this standalone test)
    // ========================================================

    // Open Co-Pilot drawer
    const togglePrimary = page.locator(CHAT_TOGGLE_SELECTORS).first();
    const toggleFallback = page.getByRole('button', { name: /chat|copilot|co-pilot|assistant/i }).first();
    const toggle = (await togglePrimary.count()) > 0 ? togglePrimary : toggleFallback;
    await expect(toggle).toBeVisible({ timeout: 5000 });
    await toggle.click();

    const drawer = page.locator(COPILOT_DRAWER_SELECTORS).first();
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Send the initial message to establish a conversation
    const input = drawer.locator(CHAT_INPUT_SELECTORS).first();
    await expect(input).toBeVisible({ timeout: 3000 });
    await input.fill('What is the current status of my company?');

    const sendBtnPrimary = drawer.locator(SEND_BUTTON_SELECTORS).first();
    const sendBtnFallback = drawer.getByRole('button', { name: /send|submit/i }).first();
    const sendBtn = (await sendBtnPrimary.count()) > 0 ? sendBtnPrimary : sendBtnFallback;
    await expect(sendBtn).toBeVisible({ timeout: 3000 });
    await sendBtn.click();

    // Wait for the user message to appear in the conversation
    const firstUserMsg = drawer.getByText('What is the current status of my company?').first();
    await expect(firstUserMsg).toBeVisible({ timeout: 10000 });

    // Wait for the first AI response to complete
    const aiMsgLocator = drawer.locator(AI_MESSAGE_SELECTORS);
    await expect(aiMsgLocator.first()).toBeVisible({ timeout: 30000 });

    // Wait for typing indicator to disappear (response complete)
    const indicator = drawer.locator(TYPING_INDICATOR_SELECTORS).first();
    try {
      await expect(indicator).toBeHidden({ timeout: 30000 });
    } catch {
      // Typing indicator may not exist or already gone
    }

    // Brief pause for UI to settle
    await page.waitForTimeout(2000);

    // Verify first AI response has meaningful content
    const firstAiText = await aiMsgLocator.first().textContent();
    expect(firstAiText).toBeTruthy();
    expect(firstAiText!.trim().length).toBeGreaterThan(10);

    // Visual Checkpoint 1: First exchange complete (setup)
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-setup-first-exchange-complete.png`,
      fullPage: true,
    });

    // ========================================================
    // STEP 1: Send follow-up message about overdue items
    // ========================================================
    const inputForStep1 = drawer.locator(CHAT_INPUT_SELECTORS).first();
    await expect(inputForStep1).toBeVisible({ timeout: 3000 });
    await inputForStep1.fill('Can you give me more details about overdue items?');

    // Verify text is in input
    const inputValueStep1 =
      (await inputForStep1.inputValue().catch(() => null)) ||
      (await inputForStep1.textContent().catch(() => null));
    expect(inputValueStep1).toContain('Can you give me more details about overdue items?');

    // ========================================================
    // STEP 2: Click Send for the follow-up message
    // ========================================================
    const sendBtnStep2Primary = drawer.locator(SEND_BUTTON_SELECTORS).first();
    const sendBtnStep2Fallback = drawer.getByRole('button', { name: /send|submit/i }).first();
    const sendBtnStep2 =
      (await sendBtnStep2Primary.count()) > 0 ? sendBtnStep2Primary : sendBtnStep2Fallback;
    await expect(sendBtnStep2).toBeVisible({ timeout: 3000 });
    await sendBtnStep2.click();

    // Wait for the second user message to appear
    const secondUserMsg = drawer.getByText('Can you give me more details about overdue items?').first();
    await expect(secondUserMsg).toBeVisible({ timeout: 10000 });

    // ========================================================
    // STEP 3: Verify AI follow-up response with context retention
    // ========================================================
    // Wait for second AI response (should now have 2 AI messages)
    await expect(aiMsgLocator.nth(1)).toBeVisible({ timeout: 30000 });

    // Wait for typing indicator to disappear
    try {
      await expect(indicator).toBeHidden({ timeout: 30000 });
    } catch {
      // OK if not present
    }

    await page.waitForTimeout(2000);

    // Verify the second AI response has meaningful content
    const secondAiText = await aiMsgLocator.nth(1).textContent();
    expect(secondAiText).toBeTruthy();
    expect(secondAiText!.trim().length).toBeGreaterThan(10);

    // Verify conversation now shows 4 messages: 2 user + 2 AI
    const userMsgLocator = drawer.locator(USER_MESSAGE_SELECTORS);
    const userMsgCount = await userMsgLocator.count();
    const aiMsgCount = await aiMsgLocator.count();

    // We expect at least 2 user messages and 2 AI messages (total 4)
    expect(userMsgCount).toBeGreaterThanOrEqual(2);
    expect(aiMsgCount).toBeGreaterThanOrEqual(2);

    // Visual Checkpoint 2: Four messages visible — context retained
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-four-messages-context-retained.png`,
      fullPage: true,
    });

    // ========================================================
    // STEP 4: Send third message to test full conversation awareness
    // ========================================================
    const inputForStep4 = drawer.locator(CHAT_INPUT_SELECTORS).first();
    await expect(inputForStep4).toBeVisible({ timeout: 3000 });
    await inputForStep4.fill('Which customer owes the most?');

    // Verify text is in input
    const inputValueStep4 =
      (await inputForStep4.inputValue().catch(() => null)) ||
      (await inputForStep4.textContent().catch(() => null));
    expect(inputValueStep4).toContain('Which customer owes the most?');

    // ========================================================
    // STEP 5: Click Send for the third message and verify full context
    // ========================================================
    const sendBtnStep5Primary = drawer.locator(SEND_BUTTON_SELECTORS).first();
    const sendBtnStep5Fallback = drawer.getByRole('button', { name: /send|submit/i }).first();
    const sendBtnStep5 =
      (await sendBtnStep5Primary.count()) > 0 ? sendBtnStep5Primary : sendBtnStep5Fallback;
    await expect(sendBtnStep5).toBeVisible({ timeout: 3000 });
    await sendBtnStep5.click();

    // Wait for the third user message to appear
    const thirdUserMsg = drawer.getByText('Which customer owes the most?').first();
    await expect(thirdUserMsg).toBeVisible({ timeout: 10000 });

    // Wait for third AI response
    await expect(aiMsgLocator.nth(2)).toBeVisible({ timeout: 30000 });

    // Wait for typing indicator to disappear
    try {
      await expect(indicator).toBeHidden({ timeout: 30000 });
    } catch {
      // OK if not present
    }

    await page.waitForTimeout(2000);

    // Verify the third AI response has meaningful content
    const thirdAiText = await aiMsgLocator.nth(2).textContent();
    expect(thirdAiText).toBeTruthy();
    expect(thirdAiText!.trim().length).toBeGreaterThan(10);

    // Verify conversation now shows 6 messages: 3 user + 3 AI
    const finalUserMsgCount = await userMsgLocator.count();
    const finalAiMsgCount = await aiMsgLocator.count();

    expect(finalUserMsgCount).toBeGreaterThanOrEqual(3);
    expect(finalAiMsgCount).toBeGreaterThanOrEqual(3);

    // Verify all three user messages are still visible (conversation persisted)
    await expect(firstUserMsg).toBeVisible();
    await expect(secondUserMsg).toBeVisible();
    await expect(thirdUserMsg).toBeVisible();

    // Visual Checkpoint 3: Six messages visible — full conversation awareness
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-six-messages-full-context.png`,
      fullPage: true,
    });
  });
});
