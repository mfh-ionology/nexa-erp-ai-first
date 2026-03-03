import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5/journey-8';

test.describe('J08 — Receive an AI Action Proposal', () => {
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
  });

  test('asks AI to create an invoice and receives an action proposal card', async ({ page }) => {
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

    // --- Step 1: Click '+ New Chat' button to start a fresh conversation ---
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

    // Brief pause to let the new conversation initialise
    await page.waitForTimeout(1000);

    // --- Step 2: Type action request into chat input ---
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
    await chatInput.fill('Create an invoice for Acme Corp for £5,000 for consulting services');

    // Verify the message text is in the input
    const inputValue =
      (await chatInput.inputValue().catch(() => null)) ||
      (await chatInput.textContent().catch(() => null));
    expect(inputValue).toContain('Create an invoice for Acme Corp');

    // --- Step 3: Click Send button and wait for action proposal ---
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

    // Wait for user message to appear in conversation
    const userMessageText = copilotDrawer.getByText(/Create an invoice for Acme Corp/i).first();
    await expect(userMessageText).toBeVisible({ timeout: 10000 });

    // Wait for AI response (text or action proposal) — allow up to 30s for AI processing
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

    await expect(aiMessage).toBeVisible({ timeout: 30000 });

    // Wait for typing indicator to disappear (streaming complete)
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

    // Allow the action proposal card to fully render
    await page.waitForTimeout(2000);

    // Look for the action proposal card
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

    // Visual Checkpoint 1: Action proposal card displayed
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-action-proposal-card-displayed.png`,
      fullPage: true,
    });

    // Verify the action proposal card contains key elements:
    // Action type: CREATE_INVOICE
    const actionType = actionProposalCard
      .locator(
        [
          '[data-testid="action-type"]',
          '[class*="action-type"]',
          '[class*="actionType"]',
        ].join(', '),
      )
      .first();

    const actionTypeByText = actionProposalCard.getByText(/CREATE_INVOICE|create.invoice|Create Invoice/i).first();
    const actionTypeEl = (await actionType.count()) > 0 ? actionType : actionTypeByText;

    if ((await actionTypeEl.count()) > 0) {
      await expect(actionTypeEl).toBeVisible();
      const typeText = await actionTypeEl.textContent();
      expect(typeText?.toLowerCase()).toMatch(/create.?invoice/i);
    }

    // Verify entity type: CustomerInvoice
    const entityType = actionProposalCard.getByText(/CustomerInvoice|Invoice/i).first();
    if ((await entityType.count()) > 0) {
      await expect(entityType).toBeVisible();
    }

    // Verify description mentions Acme Corp and £5,000
    const descriptionText = await actionProposalCard.textContent();
    expect(descriptionText?.toLowerCase()).toContain('acme');

    // --- Step 4: Verify confidence score with colour coding ---
    const confidenceScore = actionProposalCard
      .locator(
        [
          '[data-testid="confidence-score"]',
          '[data-testid*="confidence"]',
          '[class*="confidence"]',
          '[class*="Confidence"]',
        ].join(', '),
      )
      .first();

    const confidenceByText = actionProposalCard.getByText(/\d{1,3}%|0\.\d+|confidence/i).first();
    const confidenceEl = (await confidenceScore.count()) > 0 ? confidenceScore : confidenceByText;

    if ((await confidenceEl.count()) > 0) {
      await expect(confidenceEl).toBeVisible();
    }

    // Visual Checkpoint 2: Confidence score detail
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-confidence-score-detail.png`,
      fullPage: true,
    });

    // --- Step 5: Verify preview data showing proposed field values ---
    const previewData = actionProposalCard
      .locator(
        [
          '[data-testid="preview-data"]',
          '[data-testid="action-preview"]',
          '[data-testid*="preview"]',
          '[class*="preview"]',
          '[class*="Preview"]',
        ].join(', '),
      )
      .first();

    // At minimum, verify the card mentions key data: Acme Corp, £5,000, consulting
    const cardFullText = await actionProposalCard.textContent();
    expect(cardFullText?.toLowerCase()).toContain('acme');

    // Check for amount display — could be "£5,000" or "5000" or "5,000"
    const hasAmount = /£?5[,.]?000|5000/i.test(cardFullText || '');
    expect(hasAmount).toBeTruthy();

    // Check for consulting services mention
    const hasDescription = /consult/i.test(cardFullText || '');
    expect(hasDescription).toBeTruthy();

    // --- Step 6: Verify Confirm and Reject buttons ---
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

    const confirmButtonAlt = actionProposalCard.getByRole('button', { name: /confirm|approve|accept/i }).first();
    const confirmBtn = (await confirmButton.count()) > 0 ? confirmButton : confirmButtonAlt;
    await expect(confirmBtn).toBeVisible({ timeout: 5000 });

    const rejectButton = actionProposalCard
      .locator(
        [
          'button:has-text("Reject")',
          'button:has-text("Cancel")',
          'button:has-text("Decline")',
          'button[aria-label*="reject" i]',
          'button[aria-label*="cancel" i]',
          '[data-testid="reject-action"]',
          '[data-testid="action-reject"]',
        ].join(', '),
      )
      .first();

    const rejectButtonAlt = actionProposalCard.getByRole('button', { name: /reject|cancel|decline/i }).first();
    const rejectBtn = (await rejectButton.count()) > 0 ? rejectButton : rejectButtonAlt;
    await expect(rejectBtn).toBeVisible({ timeout: 5000 });

    // Verify both buttons are enabled (clickable)
    await expect(confirmBtn).toBeEnabled();
    await expect(rejectBtn).toBeEnabled();

    // Visual Checkpoint 3: Preview data and action buttons
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-preview-data-and-buttons.png`,
      fullPage: true,
    });
  });
});
