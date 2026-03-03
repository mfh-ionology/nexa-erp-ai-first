import { test, expect, type Page } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5/journey-5';

/** Reusable selector groups — CSS selectors tried in priority order */
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

const NEW_CHAT_BUTTON_SELECTORS = [
  'button[aria-label*="new chat" i]',
  'button[aria-label*="new conversation" i]',
  '[data-testid="new-chat-button"]',
  '[data-testid="new-chat"]',
  '[data-testid="new-conversation"]',
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

const CHAT_SELECTOR_SELECTORS = [
  '[data-testid="chat-selector"]',
  '[data-testid="chat-title"]',
  '[data-testid="conversation-title"]',
  '[data-testid="recent-chats"]',
  '[class*="chat-selector"]',
  '[class*="chatSelector"]',
  '[class*="conversation-title"]',
  '[class*="conversationTitle"]',
].join(', ');

/** Helper: find the first visible locator from a primary CSS selector string or a role-based fallback */
async function findElement(
  container: Page | ReturnType<Page['locator']>,
  primarySelectors: string,
  fallbackRole?: { role: Parameters<Page['getByRole']>[0]; name: RegExp },
) {
  const primary = container.locator(primarySelectors).first();
  if ((await primary.count()) > 0) return primary;
  if (fallbackRole) {
    return container.getByRole(fallbackRole.role, { name: fallbackRole.name }).first();
  }
  return primary; // return primary anyway — let the assertion surface the failure
}

/** Helper: send a message in the Co-Pilot drawer and wait for the AI response */
async function sendMessageAndWaitForResponse(
  page: Page,
  drawer: ReturnType<Page['locator']>,
  message: string,
  expectedAiMessageIndex: number,
) {
  const input = drawer.locator(CHAT_INPUT_SELECTORS).first();
  await expect(input).toBeVisible({ timeout: 3000 });
  await input.fill(message);

  const sendBtn = await findElement(drawer, SEND_BUTTON_SELECTORS, {
    role: 'button',
    name: /send|submit/i,
  });
  await expect(sendBtn).toBeVisible({ timeout: 3000 });
  await sendBtn.click();

  // Wait for user message to appear
  const userMsg = drawer.getByText(message).first();
  await expect(userMsg).toBeVisible({ timeout: 10000 });

  // Wait for AI response at the expected index
  const aiMsgLocator = drawer.locator(AI_MESSAGE_SELECTORS);
  await expect(aiMsgLocator.nth(expectedAiMessageIndex)).toBeVisible({ timeout: 30000 });

  // Wait for typing indicator to disappear
  const indicator = drawer.locator(TYPING_INDICATOR_SELECTORS).first();
  try {
    await expect(indicator).toBeHidden({ timeout: 30000 });
  } catch {
    // OK if not present or already gone
  }

  // Brief pause for UI to settle
  await page.waitForTimeout(2000);

  // Verify meaningful AI response
  const aiText = await aiMsgLocator.nth(expectedAiMessageIndex).textContent();
  expect(aiText).toBeTruthy();
  expect(aiText!.trim().length).toBeGreaterThan(10);
}

test.describe('J05 — Create New Chat Session', () => {
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

  test('creates a new chat session that starts fresh without prior context', async ({ page }) => {
    // ========================================================
    // SETUP: Open Co-Pilot drawer, establish a prior conversation
    // (so we can verify '+ New Chat' clears it)
    // ========================================================

    // Open Co-Pilot drawer
    const toggle = await findElement(page, CHAT_TOGGLE_SELECTORS, {
      role: 'button',
      name: /chat|copilot|co-pilot|assistant/i,
    });
    await expect(toggle).toBeVisible({ timeout: 5000 });
    await toggle.click();

    const drawer = page.locator(COPILOT_DRAWER_SELECTORS).first();
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Send an initial message to establish a conversation
    await sendMessageAndWaitForResponse(
      page,
      drawer,
      'What is the current status of my company?',
      0, // first AI message at index 0
    );

    // Visual Checkpoint 1: Setup — existing conversation established
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-setup-existing-conversation.png`,
      fullPage: true,
    });

    // Verify we have at least 1 user message and 1 AI message before proceeding
    const aiMsgsBefore = drawer.locator(AI_MESSAGE_SELECTORS);
    const userMsgsBefore = drawer.locator(USER_MESSAGE_SELECTORS);
    expect(await aiMsgsBefore.count()).toBeGreaterThanOrEqual(1);
    expect(await userMsgsBefore.count()).toBeGreaterThanOrEqual(1);

    // ========================================================
    // STEP 1: Click '+ New Chat' button to start a fresh session
    // ========================================================

    // Try multiple strategies to find the '+ New Chat' button
    const newChatPrimary = drawer.locator(NEW_CHAT_BUTTON_SELECTORS).first();
    const newChatByText = drawer.getByRole('button', { name: /new chat|new conversation|\+ new/i }).first();
    const newChatByIcon = drawer.locator('button').filter({ hasText: /\+\s*new/i }).first();

    let newChatBtn: ReturnType<Page['locator']>;
    if ((await newChatPrimary.count()) > 0) {
      newChatBtn = newChatPrimary;
    } else if ((await newChatByText.count()) > 0) {
      newChatBtn = newChatByText;
    } else {
      newChatBtn = newChatByIcon;
    }

    await expect(newChatBtn).toBeVisible({ timeout: 5000 });
    await newChatBtn.click();

    // Wait for the conversation area to clear
    await page.waitForTimeout(1000);

    // Verify the conversation area is now empty — previous messages should be gone
    const aiMsgsAfterNew = drawer.locator(AI_MESSAGE_SELECTORS);
    const userMsgsAfterNew = drawer.locator(USER_MESSAGE_SELECTORS);

    // The previous messages should no longer be visible in the new session
    const aiCountAfterNew = await aiMsgsAfterNew.count();
    const userCountAfterNew = await userMsgsAfterNew.count();
    expect(aiCountAfterNew).toBe(0);
    expect(userCountAfterNew).toBe(0);

    // Verify input field is ready with placeholder
    const inputAfterNew = drawer.locator(CHAT_INPUT_SELECTORS).first();
    await expect(inputAfterNew).toBeVisible({ timeout: 3000 });

    // Check for placeholder text 'Ask Nexa anything...'
    const placeholder =
      (await inputAfterNew.getAttribute('placeholder')) || '';
    expect(placeholder.toLowerCase()).toContain('ask');

    // Verify the previous conversation title is no longer the active title
    // (the chat selector should show a new/untitled state)
    const chatSelector = drawer.locator(CHAT_SELECTOR_SELECTORS).first();
    if ((await chatSelector.count()) > 0) {
      const selectorText = (await chatSelector.textContent()) || '';
      // Should NOT still show the previous conversation title
      expect(selectorText.toLowerCase()).not.toContain('current status');
    }

    // Visual Checkpoint 2: New chat — empty conversation area
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-new-chat-empty-conversation.png`,
      fullPage: true,
    });

    // ========================================================
    // STEP 2: Type a new, unrelated message
    // ========================================================
    await inputAfterNew.fill('How many employees do we have?');

    // Verify text is in input
    const inputValue =
      (await inputAfterNew.inputValue().catch(() => null)) ||
      (await inputAfterNew.textContent().catch(() => null));
    expect(inputValue).toContain('How many employees do we have?');

    // ========================================================
    // STEP 3: Send the message and verify fresh AI response
    // ========================================================
    const sendBtn = await findElement(drawer, SEND_BUTTON_SELECTORS, {
      role: 'button',
      name: /send|submit/i,
    });
    await expect(sendBtn).toBeVisible({ timeout: 3000 });
    await sendBtn.click();

    // Wait for user message to appear
    const newUserMsg = drawer.getByText('How many employees do we have?').first();
    await expect(newUserMsg).toBeVisible({ timeout: 10000 });

    // Wait for AI response
    const newAiMsgs = drawer.locator(AI_MESSAGE_SELECTORS);
    await expect(newAiMsgs.first()).toBeVisible({ timeout: 30000 });

    // Wait for typing indicator to disappear
    const indicator = drawer.locator(TYPING_INDICATOR_SELECTORS).first();
    try {
      await expect(indicator).toBeHidden({ timeout: 30000 });
    } catch {
      // OK if not present
    }

    await page.waitForTimeout(2000);

    // Verify the new conversation has exactly 1 user message and 1 AI response
    const finalUserCount = await drawer.locator(USER_MESSAGE_SELECTORS).count();
    const finalAiCount = await newAiMsgs.count();
    expect(finalUserCount).toBe(1);
    expect(finalAiCount).toBe(1);

    // Verify the AI response is meaningful
    const aiResponseText = await newAiMsgs.first().textContent();
    expect(aiResponseText).toBeTruthy();
    expect(aiResponseText!.trim().length).toBeGreaterThan(10);

    // Verify the AI does NOT reference the previous conversation context
    // (should not mention "overdue items", "company status", or similar)
    const aiResponseLower = aiResponseText!.toLowerCase();
    expect(aiResponseLower).not.toContain('overdue');
    expect(aiResponseLower).not.toContain('company status');
    expect(aiResponseLower).not.toContain('as i mentioned');
    expect(aiResponseLower).not.toContain('as we discussed');

    // Verify chat selector title auto-generated from the new message
    if ((await chatSelector.count()) > 0) {
      const newTitle = (await chatSelector.textContent()) || '';
      if (newTitle.length > 0) {
        // Should reference the new topic, not the old one
        expect(newTitle.toLowerCase()).not.toContain('current status');
      }
    }

    // Visual Checkpoint 3: Fresh response — no prior context
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-fresh-response-no-prior-context.png`,
      fullPage: true,
    });
  });
});
