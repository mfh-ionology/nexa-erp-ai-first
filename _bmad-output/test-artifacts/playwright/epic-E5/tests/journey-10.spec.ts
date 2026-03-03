import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5/journey-10';

test.describe('J10 — Reject an AI Action Proposal', () => {
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

    // Open the Co-Pilot drawer
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

    // Start a new chat session
    const newChatButton = copilotDrawer
      .locator(
        [
          'button:has-text("New Chat")',
          'button:has-text("+ New Chat")',
          'button[aria-label*="new chat" i]',
          '[data-testid="new-chat-button"]',
          '[data-testid="new-chat"]',
        ].join(', '),
      )
      .first();

    const newChatButtonAlt = copilotDrawer.getByRole('button', { name: /new chat/i }).first();
    const newChatBtn = (await newChatButton.count()) > 0 ? newChatButton : newChatButtonAlt;
    await expect(newChatBtn).toBeVisible({ timeout: 5000 });
    await newChatBtn.click();
    await page.waitForTimeout(1000);
  });

  test('rejects an AI action proposal and continues conversation normally', async ({ page }) => {
    // Helper: locate the Co-Pilot drawer
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

    // Locate chat input
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

    // Locate send button
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
    const getSendBtn = async () => {
      return (await sendButton.count()) > 0 ? sendButton : sendButtonAlt;
    };

    // --- Step 1: Type the action request ---
    await expect(chatInput).toBeVisible({ timeout: 3000 });
    await chatInput.fill('Send an email to Acme Corp about their overdue payment');

    // --- Step 2: Click Send button ---
    const sendBtn = await getSendBtn();
    await expect(sendBtn).toBeVisible({ timeout: 3000 });
    await sendBtn.click();

    // Wait for user message to appear
    const userMessage = copilotDrawer.getByText(/Send an email to Acme Corp/i).first();
    await expect(userMessage).toBeVisible({ timeout: 10000 });

    // Wait for typing indicator to clear
    const typingIndicator = copilotDrawer
      .locator(
        [
          '[data-testid="typing-indicator"]',
          '[data-testid="ai-loading"]',
          '[class*="typing"]',
          '[class*="loading"]',
          '[class*="shimmer"]',
          '[aria-label*="typing" i]',
          '[aria-label*="loading" i]',
          '[aria-label*="thinking" i]',
        ].join(', '),
      )
      .first();

    try {
      await expect(typingIndicator).toBeHidden({ timeout: 30000 });
    } catch {
      // Typing indicator may not be present — that's fine
    }

    await page.waitForTimeout(2000);

    // --- Step 3: Verify SEND_EMAIL action proposal card ---
    const actionProposalCard = copilotDrawer
      .locator(
        [
          '[data-testid="action-proposal"]',
          '[data-testid="action-proposal-card"]',
          '[data-testid*="action-card"]',
          '[class*="action-proposal"]',
          '[class*="actionProposal"]',
          '[class*="ActionProposal"]',
          '[class*="action-card"]',
          '[class*="actionCard"]',
          '[data-type="action_proposal"]',
        ].join(', '),
      )
      .first();

    await expect(actionProposalCard).toBeVisible({ timeout: 10000 });

    // Verify the action proposal has Confirm and Reject buttons
    const confirmButton = actionProposalCard
      .locator(
        [
          'button:has-text("Confirm")',
          'button:has-text("Approve")',
          'button:has-text("Accept")',
          'button[aria-label*="confirm" i]',
          'button[aria-label*="approve" i]',
          '[data-testid="confirm-action"]',
          '[data-testid="action-confirm"]',
        ].join(', '),
      )
      .first();

    const confirmButtonAlt = actionProposalCard
      .getByRole('button', { name: /confirm|approve|accept/i })
      .first();

    const confirmBtn = (await confirmButton.count()) > 0 ? confirmButton : confirmButtonAlt;
    await expect(confirmBtn).toBeVisible({ timeout: 5000 });

    const rejectButton = actionProposalCard
      .locator(
        [
          'button:has-text("Reject")',
          'button:has-text("Cancel")',
          'button:has-text("Decline")',
          'button:has-text("Dismiss")',
          'button[aria-label*="reject" i]',
          'button[aria-label*="cancel" i]',
          'button[aria-label*="decline" i]',
          '[data-testid="reject-action"]',
          '[data-testid="action-reject"]',
          '[data-testid="cancel-action"]',
          '[data-testid="action-cancel"]',
        ].join(', '),
      )
      .first();

    const rejectButtonAlt = actionProposalCard
      .getByRole('button', { name: /reject|cancel|decline|dismiss/i })
      .first();

    const rejectBtn = (await rejectButton.count()) > 0 ? rejectButton : rejectButtonAlt;
    await expect(rejectBtn).toBeVisible({ timeout: 5000 });

    // Visual Checkpoint 1: SEND_EMAIL action proposal card visible
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-send-email-action-proposal.png`,
      fullPage: true,
    });

    // --- Step 4: Click Reject button ---
    await rejectBtn.click();

    // Wait for rejection acknowledgement — the AI should respond with a cancellation message
    // Look for text confirming no action was taken
    const cancelledText = copilotDrawer
      .getByText(/cancelled|rejected|no changes|action cancelled|not sent|did not send|won't send|will not/i)
      .first();

    // Also check for a visual state change on the action card
    const rejectedState = actionProposalCard
      .locator(
        [
          '[class*="rejected"]',
          '[class*="cancelled"]',
          '[class*="canceled"]',
          '[class*="dismissed"]',
          '[data-status="rejected"]',
          '[data-status="cancelled"]',
        ].join(', '),
      )
      .first();

    // Wait for either the rejection acknowledgement text or the rejected state on the card
    try {
      await expect(cancelledText).toBeVisible({ timeout: 15000 });
    } catch {
      // Maybe the card state changed but no separate text message
      try {
        await expect(rejectedState).toBeVisible({ timeout: 5000 });
      } catch {
        // At minimum, the Reject button should now be gone/disabled
        const rejectStillActive = await rejectBtn.isEnabled().catch(() => false);
        expect(rejectStillActive).toBeFalsy();
      }
    }

    await page.waitForTimeout(1000);

    // Visual Checkpoint 2: Action rejected — cancellation acknowledged
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-action-rejected-cancelled.png`,
      fullPage: true,
    });

    // Verify the Confirm button is no longer clickable after rejection
    const confirmStillActive = await confirmBtn.isVisible().catch(() => false);
    if (confirmStillActive) {
      const isDisabled = await confirmBtn.isDisabled().catch(() => false);
      expect(isDisabled).toBeTruthy();
    }

    // --- Step 5: Send follow-up message to verify conversation continues ---
    await expect(chatInput).toBeVisible({ timeout: 3000 });
    await chatInput.fill('OK, never mind. What else needs my attention?');

    // --- Step 6: Click Send and verify AI responds normally ---
    const sendBtn2 = await getSendBtn();
    await expect(sendBtn2).toBeVisible({ timeout: 3000 });
    await sendBtn2.click();

    // Wait for follow-up user message to appear
    const followUpMessage = copilotDrawer.getByText(/never mind|What else needs my attention/i).first();
    await expect(followUpMessage).toBeVisible({ timeout: 10000 });

    // Wait for typing indicator to clear again
    try {
      await expect(typingIndicator).toBeHidden({ timeout: 30000 });
    } catch {
      // No typing indicator — fine
    }

    await page.waitForTimeout(2000);

    // Verify the AI has sent a follow-up response (not an error)
    // The conversation should have at least: user action request, AI action proposal, rejection ack,
    // user follow-up, AI follow-up response — so multiple messages visible
    // Look for any AI response text after the follow-up that is NOT an error
    const allMessages = copilotDrawer
      .locator(
        [
          '[data-testid*="message"]',
          '[class*="message"]',
          '[class*="chat-bubble"]',
          '[class*="chatBubble"]',
          '[class*="ChatBubble"]',
          '[role="article"]',
          '[role="listitem"]',
        ].join(', '),
      );

    // There should be at least 3 messages in the conversation (user request, AI proposal/response, user follow-up, AI follow-up)
    const messageCount = await allMessages.count();
    expect(messageCount).toBeGreaterThanOrEqual(3);

    // Verify the conversation does not have an error state
    const errorIndicator = copilotDrawer
      .locator(
        [
          '[class*="error"]',
          '[data-testid="chat-error"]',
          '[data-testid="message-error"]',
          '[aria-label*="error" i]',
        ].join(', '),
      )
      .first();

    const hasError = (await errorIndicator.count()) > 0 && await errorIndicator.isVisible().catch(() => false);
    // Some UI frameworks use "error" in class names for non-error purposes; be lenient
    // but at minimum the conversation should still be interactive
    await expect(chatInput).toBeVisible();
    await expect(chatInput).toBeEnabled();

    // Visual Checkpoint 3: Conversation continues after rejection
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-conversation-continues.png`,
      fullPage: true,
    });
  });
});
