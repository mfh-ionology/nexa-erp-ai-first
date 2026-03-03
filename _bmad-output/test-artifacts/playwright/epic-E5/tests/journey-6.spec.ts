import { test, expect, type Page } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5/journey-6';

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

const RECENT_CHATS_DROPDOWN_SELECTORS = [
  '[data-testid="recent-chats-dropdown"]',
  '[data-testid="recent-chats"]',
  '[data-testid="chat-history"]',
  '[data-testid="chat-list"]',
  '[data-testid="conversation-list"]',
  '[class*="recent-chats"]',
  '[class*="recentChats"]',
  '[class*="chat-history"]',
  '[class*="chatHistory"]',
  '[class*="chat-list"]',
  '[class*="chatList"]',
  '[class*="conversation-list"]',
  '[class*="conversationList"]',
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
  return primary;
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

/** Helper: click '+ New Chat' button in the drawer */
async function clickNewChat(drawer: ReturnType<Page['locator']>) {
  const newChatPrimary = drawer.locator(NEW_CHAT_BUTTON_SELECTORS).first();
  const newChatByText = drawer.getByRole('button', { name: /new chat|new conversation|\+ new/i }).first();
  const newChatByIcon = drawer.locator('button').filter({ hasText: /\+\s*new/i }).first();

  let newChatBtn: ReturnType<typeof drawer.locator>;
  if ((await newChatPrimary.count()) > 0) {
    newChatBtn = newChatPrimary;
  } else if ((await newChatByText.count()) > 0) {
    newChatBtn = newChatByText;
  } else {
    newChatBtn = newChatByIcon;
  }

  await expect(newChatBtn).toBeVisible({ timeout: 5000 });
  await newChatBtn.click();
}

test.describe('J06 — View and Resume Previous Chat Sessions', () => {
  // Increase timeout for this test since it involves setting up multiple conversations
  test.setTimeout(180000);

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

  test('views chat history, resumes previous session, and receives context-aware response', async ({ page }) => {
    // ========================================================
    // SETUP: Create two conversations to populate chat history
    // Conversation 1: 3 exchanges about company status/overdue items (mirrors j03/j04)
    // Conversation 2: 1 exchange about employees (mirrors j05)
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

    // --- Conversation 1: Three exchanges (company status → overdue → top customer) ---
    await sendMessageAndWaitForResponse(
      page,
      drawer,
      'What is the current status of my company?',
      0,
    );

    await sendMessageAndWaitForResponse(
      page,
      drawer,
      'Can you give me more details about overdue items?',
      1,
    );

    await sendMessageAndWaitForResponse(
      page,
      drawer,
      'Which customer owes the most?',
      2,
    );

    // Verify conversation 1 has 6 messages (3 user + 3 AI)
    const conv1UserMsgs = await drawer.locator(USER_MESSAGE_SELECTORS).count();
    const conv1AiMsgs = await drawer.locator(AI_MESSAGE_SELECTORS).count();
    expect(conv1UserMsgs).toBe(3);
    expect(conv1AiMsgs).toBe(3);

    // --- Create Conversation 2: Click '+ New Chat', send 1 message about employees ---
    await clickNewChat(drawer);
    await page.waitForTimeout(1000);

    // Verify conversation cleared
    const clearedAi = await drawer.locator(AI_MESSAGE_SELECTORS).count();
    const clearedUser = await drawer.locator(USER_MESSAGE_SELECTORS).count();
    expect(clearedAi).toBe(0);
    expect(clearedUser).toBe(0);

    await sendMessageAndWaitForResponse(
      page,
      drawer,
      'How many employees do we have?',
      0,
    );

    // Verify conversation 2 has 2 messages (1 user + 1 AI)
    const conv2UserMsgs = await drawer.locator(USER_MESSAGE_SELECTORS).count();
    const conv2AiMsgs = await drawer.locator(AI_MESSAGE_SELECTORS).count();
    expect(conv2UserMsgs).toBe(1);
    expect(conv2AiMsgs).toBe(1);

    // ========================================================
    // STEP 1: Click "Recent Chats" dropdown to view chat history
    // ========================================================

    // Try multiple strategies to find and open the Recent Chats dropdown
    const recentChatsPrimary = drawer.locator(RECENT_CHATS_DROPDOWN_SELECTORS).first();
    const recentChatsByRole = drawer.getByRole('combobox', { name: /chat|recent|conversation/i }).first();
    const recentChatsByText = drawer.getByText(/recent chats/i).first();
    const chatSelector = drawer.locator(CHAT_SELECTOR_SELECTORS).first();

    let recentChatsControl: ReturnType<typeof drawer.locator>;
    if ((await recentChatsPrimary.count()) > 0) {
      recentChatsControl = recentChatsPrimary;
    } else if ((await chatSelector.count()) > 0) {
      recentChatsControl = chatSelector;
    } else if ((await recentChatsByRole.count()) > 0) {
      recentChatsControl = recentChatsByRole;
    } else {
      recentChatsControl = recentChatsByText;
    }

    await expect(recentChatsControl).toBeVisible({ timeout: 5000 });
    await recentChatsControl.click();

    // Wait for dropdown options/list items to appear
    await page.waitForTimeout(1000);

    // Look for the dropdown list items showing conversation entries
    const dropdownListSelectors = [
      '[data-testid*="chat-list-item"]',
      '[data-testid*="conversation-item"]',
      '[class*="chat-list-item"]',
      '[class*="chatListItem"]',
      '[class*="conversation-item"]',
      '[class*="conversationItem"]',
      '[role="option"]',
      '[role="listitem"]',
      'li',
    ].join(', ');

    // Check for the dropdown being visible — it may be a list inside the drawer
    // or a floating dropdown
    const dropdownContainer = page.locator(
      [
        '[data-testid="chat-dropdown"]',
        '[data-testid="recent-chats-list"]',
        '[class*="dropdown"]',
        '[role="listbox"]',
        '[role="menu"]',
      ].join(', '),
    ).first();

    // If a dedicated dropdown container exists, look for items there;
    // otherwise look within the drawer
    let listItemsContainer: ReturnType<typeof page.locator>;
    if ((await dropdownContainer.count()) > 0) {
      listItemsContainer = dropdownContainer;
    } else {
      listItemsContainer = drawer;
    }

    // Verify we see at least 2 conversation entries
    const listItems = listItemsContainer.locator(dropdownListSelectors);
    const itemCount = await listItems.count();

    // We expect at least 2 conversations (the company status one and the employees one)
    expect(itemCount).toBeGreaterThanOrEqual(2);

    // Visual Checkpoint 1: Recent Chats dropdown open with conversation list
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-recent-chats-dropdown-open.png`,
      fullPage: true,
    });

    // Verify the conversation entries contain recognisable titles
    // Look for the first conversation title (company status) somewhere in the list
    const allListText = await listItemsContainer.textContent() || '';
    const hasCompanyStatusConversation =
      /current status|company|status/i.test(allListText);
    const hasEmployeesConversation =
      /employees|how many/i.test(allListText);

    // At least one of the title patterns should be present
    expect(hasCompanyStatusConversation || hasEmployeesConversation).toBe(true);

    // ========================================================
    // STEP 2: Click the previous conversation entry to load it
    // ========================================================

    // Find and click the conversation about "company status" (the first/older one)
    // Try to find a list item containing "status" or "company" text
    const previousConvItem = listItemsContainer
      .locator(dropdownListSelectors)
      .filter({ hasText: /current status|company|status/i })
      .first();

    let itemToClick: ReturnType<typeof drawer.locator>;
    if ((await previousConvItem.count()) > 0) {
      itemToClick = previousConvItem;
    } else {
      // Fallback: click the second list item (should be the older conversation,
      // since most recent is first)
      const secondItem = listItems.nth(1);
      if ((await secondItem.count()) > 0) {
        itemToClick = secondItem;
      } else {
        // Last resort: click the first item
        itemToClick = listItems.first();
      }
    }

    await expect(itemToClick).toBeVisible({ timeout: 3000 });
    await itemToClick.click();

    // Wait for the conversation to load
    await page.waitForTimeout(2000);

    // Verify the conversation area now shows the previous conversation's messages
    // Should have 3 user messages and 3 AI messages from the company status conversation
    const loadedUserMsgs = drawer.locator(USER_MESSAGE_SELECTORS);
    const loadedAiMsgs = drawer.locator(AI_MESSAGE_SELECTORS);

    const loadedUserCount = await loadedUserMsgs.count();
    const loadedAiCount = await loadedAiMsgs.count();

    // We expect 6 messages total (3 user + 3 AI) from the original conversation
    expect(loadedUserCount).toBe(3);
    expect(loadedAiCount).toBe(3);

    // Verify the first user message text matches the original conversation
    const firstUserMsgText = await loadedUserMsgs.first().textContent();
    expect(firstUserMsgText).toBeTruthy();
    expect(firstUserMsgText!.toLowerCase()).toContain('current status');

    // Verify the chat selector title reflects the loaded conversation
    const titleAfterLoad = drawer.locator(CHAT_SELECTOR_SELECTORS).first();
    if ((await titleAfterLoad.count()) > 0) {
      const titleText = await titleAfterLoad.textContent() || '';
      if (titleText.length > 0) {
        // Should reference the company status topic
        expect(titleText.toLowerCase()).not.toContain('employees');
      }
    }

    // Visual Checkpoint 2: Previous conversation loaded with full history
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-previous-conversation-loaded.png`,
      fullPage: true,
    });

    // ========================================================
    // STEP 3: Type "Summarise what we discussed." in the chat input
    // ========================================================

    const chatInput = drawer.locator(CHAT_INPUT_SELECTORS).first();
    await expect(chatInput).toBeVisible({ timeout: 3000 });
    await chatInput.fill('Summarise what we discussed.');

    // Verify text is in input
    const inputValue =
      (await chatInput.inputValue().catch(() => null)) ||
      (await chatInput.textContent().catch(() => null));
    expect(inputValue).toContain('Summarise what we discussed.');

    // ========================================================
    // STEP 4: Send and verify context-aware summary response
    // ========================================================

    const sendBtn = await findElement(drawer, SEND_BUTTON_SELECTORS, {
      role: 'button',
      name: /send|submit/i,
    });
    await expect(sendBtn).toBeVisible({ timeout: 3000 });
    await sendBtn.click();

    // Wait for user message to appear
    const summaryUserMsg = drawer.getByText('Summarise what we discussed.').first();
    await expect(summaryUserMsg).toBeVisible({ timeout: 10000 });

    // Wait for the 4th AI response (index 3) — the summary
    const allAiMsgs = drawer.locator(AI_MESSAGE_SELECTORS);
    await expect(allAiMsgs.nth(3)).toBeVisible({ timeout: 30000 });

    // Wait for typing indicator to disappear
    const indicator = drawer.locator(TYPING_INDICATOR_SELECTORS).first();
    try {
      await expect(indicator).toBeHidden({ timeout: 30000 });
    } catch {
      // OK if not present
    }

    await page.waitForTimeout(2000);

    // Verify we now have 8 messages total (4 user + 4 AI)
    const finalUserCount = await drawer.locator(USER_MESSAGE_SELECTORS).count();
    const finalAiCount = await allAiMsgs.count();
    expect(finalUserCount).toBe(4);
    expect(finalAiCount).toBe(4);

    // Verify the AI summary response is meaningful and references prior context
    const summaryResponseText = await allAiMsgs.nth(3).textContent();
    expect(summaryResponseText).toBeTruthy();
    expect(summaryResponseText!.trim().length).toBeGreaterThan(20);

    // The summary should reference topics from the earlier conversation.
    // Check for at least one contextual reference (company, overdue, customer, status)
    const summaryLower = summaryResponseText!.toLowerCase();
    const hasContextualReference =
      summaryLower.includes('company') ||
      summaryLower.includes('status') ||
      summaryLower.includes('overdue') ||
      summaryLower.includes('customer') ||
      summaryLower.includes('owe') ||
      summaryLower.includes('invoic') ||
      summaryLower.includes('discuss') ||
      summaryLower.includes('conversation') ||
      summaryLower.includes('summary') ||
      summaryLower.includes('asked');

    expect(hasContextualReference).toBe(true);

    // Visual Checkpoint 3: Resumed conversation with context-aware summary
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-resumed-summary-response.png`,
      fullPage: true,
    });
  });
});
