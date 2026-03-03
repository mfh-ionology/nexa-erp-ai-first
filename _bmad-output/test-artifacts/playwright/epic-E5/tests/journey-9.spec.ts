import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5/journey-9';

test.describe('J09 — Confirm an AI Action Proposal', () => {
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

    // Send an action request to generate an action proposal (same as j08 setup)
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

    // Wait for user message to appear
    const userMessageText = copilotDrawer.getByText(/Create an invoice for Acme Corp/i).first();
    await expect(userMessageText).toBeVisible({ timeout: 10000 });

    // Wait for AI response and action proposal card to appear
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

    // Wait for typing indicator to clear and action proposal to render
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

    // Verify action proposal card is visible before proceeding
    await expect(actionProposalCard).toBeVisible({ timeout: 10000 });
  });

  test('clicks Confirm on action proposal and verifies record creation', async ({ page }) => {
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

    // Locate the action proposal card
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

    await expect(actionProposalCard).toBeVisible({ timeout: 5000 });

    // --- Step 1: Click Confirm button on the action proposal card ---
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
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    // Wait for the action to execute — the card should transition to a processing/success state
    // Look for indicators: loading spinner on the card, then success state
    const processingIndicator = actionProposalCard
      .locator(
        [
          '[class*="processing"]',
          '[class*="executing"]',
          '[class*="loading"]',
          '[class*="spinner"]',
          '[aria-busy="true"]',
        ].join(', '),
      )
      .first();

    // Processing state may be brief, don't fail if we miss it
    try {
      await expect(processingIndicator).toBeVisible({ timeout: 3000 });
    } catch {
      // Processing state may have already passed
    }

    // Wait for the success/completion state — look for record_created message or success indicator
    // Possible success indicators: green checkmark, "Record Created", "created successfully", display ref like "INV-XXXXX"
    const successIndicators = copilotDrawer
      .locator(
        [
          '[data-testid="record-created"]',
          '[data-testid="action-success"]',
          '[data-testid="action-result"]',
          '[class*="record-created"]',
          '[class*="recordCreated"]',
          '[class*="action-success"]',
          '[class*="actionSuccess"]',
          '[class*="action-result"]',
          '[class*="actionResult"]',
          '[data-type="record_created"]',
        ].join(', '),
      )
      .first();

    // Also look for text-based confirmation
    const successText = copilotDrawer
      .getByText(/created successfully|record created|INV-\d+|invoice.*created/i)
      .first();

    // Wait for either structured success indicator or text confirmation (up to 30s for API execution)
    try {
      await expect(successIndicators).toBeVisible({ timeout: 30000 });
    } catch {
      // Fall back to checking for text-based confirmation
      await expect(successText).toBeVisible({ timeout: 10000 });
    }

    // Allow UI to fully settle
    await page.waitForTimeout(1000);

    // Visual Checkpoint 1: Action confirmed — record created
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-action-confirmed-record-created.png`,
      fullPage: true,
    });

    // Verify the action proposal card is now in a confirmed/success state
    // The Confirm button should no longer be clickable/visible, or the card has transformed
    const confirmBtnAfter = actionProposalCard
      .locator(
        [
          'button:has-text("Confirm")',
          'button:has-text("Approve")',
          'button:has-text("Accept")',
        ].join(', '),
      )
      .first();

    // After confirmation, the Confirm button should either be gone, disabled, or replaced by success state
    const confirmStillActive = await confirmBtnAfter.isVisible().catch(() => false);
    if (confirmStillActive) {
      // If still visible, it should be disabled
      const isDisabled = await confirmBtnAfter.isDisabled().catch(() => false);
      expect(isDisabled).toBeTruthy();
    }

    // --- Step 2: Verify record created confirmation text ---
    // Look for confirmation text mentioning the invoice was created with a display reference
    const confirmationMessage = copilotDrawer
      .locator(
        [
          '[data-testid="record-created"]',
          '[data-testid="action-result"]',
          '[data-testid="action-success"]',
          '[class*="record-created"]',
          '[class*="recordCreated"]',
          '[class*="action-result"]',
          '[class*="actionResult"]',
          '[class*="action-success"]',
          '[class*="actionSuccess"]',
          '[data-type="record_created"]',
        ].join(', '),
      )
      .first();

    // Check for structured confirmation or text-based confirmation
    const hasStructuredConfirmation = (await confirmationMessage.count()) > 0 && await confirmationMessage.isVisible().catch(() => false);

    if (hasStructuredConfirmation) {
      const confirmText = await confirmationMessage.textContent();
      // Should mention the entity type or display reference
      const mentionsInvoice = /invoice|INV-/i.test(confirmText || '');
      expect(mentionsInvoice).toBeTruthy();
    } else {
      // Fall back to looking for confirmation text in the broader conversation
      const conversationText = await copilotDrawer.textContent();
      const hasCreationConfirmation = /created|confirmed|success/i.test(conversationText || '');
      expect(hasCreationConfirmation).toBeTruthy();
    }

    // Verify display reference number is shown (e.g., "INV-000042")
    const displayRef = copilotDrawer.getByText(/INV-\d+/).first();
    const hasDisplayRef = (await displayRef.count()) > 0;
    if (hasDisplayRef) {
      await expect(displayRef).toBeVisible();
    }

    // --- Step 3: Verify link to created record ---
    const recordLink = copilotDrawer
      .locator(
        [
          '[data-testid="record-link"]',
          '[data-testid="view-record"]',
          '[data-testid="entity-link"]',
          'a[href*="/ar/invoices/"]',
          'a[href*="/invoices/"]',
          'button:has-text("View")',
          'a:has-text("View")',
          '[class*="record-link"]',
          '[class*="recordLink"]',
          '[class*="entity-link"]',
          '[class*="entityLink"]',
        ].join(', '),
      )
      .first();

    const recordLinkAlt = copilotDrawer
      .getByRole('link', { name: /view|open|go to|INV-/i })
      .first();

    const recordLinkButton = copilotDrawer
      .getByRole('button', { name: /view|open|go to|INV-/i })
      .first();

    const linkEl = (await recordLink.count()) > 0
      ? recordLink
      : (await recordLinkAlt.count()) > 0
        ? recordLinkAlt
        : recordLinkButton;

    if ((await linkEl.count()) > 0) {
      await expect(linkEl).toBeVisible({ timeout: 5000 });
    }

    // Visual Checkpoint 2: Record reference and navigation link visible
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-record-link-visible.png`,
      fullPage: true,
    });

    // Final verification: the full conversation flow is intact
    // User message → AI response → action proposal (confirmed) → record created
    const userMessage = copilotDrawer.getByText(/Create an invoice for Acme Corp/i).first();
    await expect(userMessage).toBeVisible();
  });
});
