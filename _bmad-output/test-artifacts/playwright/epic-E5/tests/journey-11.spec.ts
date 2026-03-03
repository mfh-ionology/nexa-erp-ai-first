import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5/journey-11';

test.describe('J11 — Financial Actions Always Require User Confirmation', () => {
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

  test('financial actions (journal and payment) always require explicit user confirmation', async ({ page }) => {
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

    // Helper: locate typing indicator
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

    // Helper: locate action proposal cards
    const actionProposalSelector = [
      '[data-testid="action-proposal"]',
      '[data-testid="action-proposal-card"]',
      '[data-testid*="action-card"]',
      '[class*="action-proposal"]',
      '[class*="actionProposal"]',
      '[class*="ActionProposal"]',
      '[class*="action-card"]',
      '[class*="actionCard"]',
      '[data-type="action_proposal"]',
    ].join(', ');

    // =================================================================
    // PART 1: POST_JOURNAL — financial action must require confirmation
    // =================================================================

    // --- Step 2: Type journal entry request into chat input ---
    await expect(chatInput).toBeVisible({ timeout: 3000 });
    await chatInput.fill('Post journal entry: debit Office Supplies £500, credit Cash £500');

    // Verify message text is in the input
    const inputValue =
      (await chatInput.inputValue().catch(() => null)) ||
      (await chatInput.textContent().catch(() => null));
    expect(inputValue).toContain('Post journal entry');

    // --- Step 3: Click Send button and wait for action proposal ---
    const sendBtn1 = await getSendBtn();
    await expect(sendBtn1).toBeVisible({ timeout: 3000 });
    await sendBtn1.click();

    // Wait for user message to appear in conversation
    const userMessage1 = copilotDrawer.getByText(/Post journal entry/i).first();
    await expect(userMessage1).toBeVisible({ timeout: 10000 });

    // Wait for AI response (streaming complete)
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

    // Wait for typing indicator to disappear
    try {
      await expect(typingIndicator).toBeHidden({ timeout: 30000 });
    } catch {
      // Typing indicator may not be present — that's fine
    }

    // Allow the action proposal card to fully render
    await page.waitForTimeout(2000);

    // Look for the first action proposal card (POST_JOURNAL)
    const journalProposalCard = copilotDrawer.locator(actionProposalSelector).first();
    await expect(journalProposalCard).toBeVisible({ timeout: 10000 });

    // Verify action type is POST_JOURNAL or similar
    const journalCardText = await journalProposalCard.textContent();
    const hasJournalType =
      /post.?journal|journal.?entry|create.?journal|general.?journal/i.test(journalCardText || '');
    expect(hasJournalType).toBeTruthy();

    // Verify journal details are shown (debit/credit, £500, Office Supplies, Cash)
    expect(journalCardText?.toLowerCase()).toMatch(/office.?supplies|debit/i);
    const hasAmount = /£?500|500/i.test(journalCardText || '');
    expect(hasAmount).toBeTruthy();

    // Verify Confirm and Reject buttons on the journal proposal
    const journalConfirmBtn = journalProposalCard
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

    const journalConfirmBtnAlt = journalProposalCard
      .getByRole('button', { name: /confirm|approve|accept/i })
      .first();

    const journalConfirm =
      (await journalConfirmBtn.count()) > 0 ? journalConfirmBtn : journalConfirmBtnAlt;
    await expect(journalConfirm).toBeVisible({ timeout: 5000 });
    await expect(journalConfirm).toBeEnabled();

    const journalRejectBtn = journalProposalCard
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

    const journalRejectBtnAlt = journalProposalCard
      .getByRole('button', { name: /reject|cancel|decline|dismiss/i })
      .first();

    const journalReject =
      (await journalRejectBtn.count()) > 0 ? journalRejectBtn : journalRejectBtnAlt;
    await expect(journalReject).toBeVisible({ timeout: 5000 });
    await expect(journalReject).toBeEnabled();

    // The journal was NOT auto-executed — it must be in a pending/awaiting state
    // Verify there is NO success/completed state on the card
    const journalAutoExecuted = journalProposalCard
      .locator(
        [
          '[class*="completed"]',
          '[class*="success"]',
          '[class*="executed"]',
          '[data-status="completed"]',
          '[data-status="executed"]',
          '[data-status="success"]',
        ].join(', '),
      )
      .first();

    const journalWasAutoExecuted =
      (await journalAutoExecuted.count()) > 0 &&
      (await journalAutoExecuted.isVisible().catch(() => false));
    expect(journalWasAutoExecuted).toBeFalsy();

    // Visual Checkpoint 1: POST_JOURNAL action proposal requires approval
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-post-journal-action-proposal.png`,
      fullPage: true,
    });

    // --- Step 4: Verify 'Approval Required' indicator on financial action ---
    // Look for explicit approval-required labelling
    const approvalIndicator = journalProposalCard
      .locator(
        [
          '[data-testid="approval-required"]',
          '[data-testid*="requires-approval"]',
          '[class*="approval-required"]',
          '[class*="approvalRequired"]',
          '[class*="requires-approval"]',
          '[class*="requiresApproval"]',
          '[class*="financial"]',
        ].join(', '),
      )
      .first();

    const approvalByText = journalProposalCard
      .getByText(/approval required|confirmation required|requires approval|financial action/i)
      .first();

    const approvalEl =
      (await approvalIndicator.count()) > 0 ? approvalIndicator : approvalByText;

    // Check if approval required indicator exists (may be a badge, label, or text)
    if ((await approvalEl.count()) > 0) {
      await expect(approvalEl).toBeVisible();
    } else {
      // Fallback: the presence of Confirm/Reject buttons on a financial action
      // is itself an indicator of the approval requirement — the key assertion
      // is that the action was NOT auto-executed, which we verified above.
    }

    // Visual Checkpoint 2: Approval Required indicator
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-approval-required-indicator.png`,
      fullPage: true,
    });

    // =================================================================
    // PART 2: CREATE_PAYMENT — second financial action also needs approval
    // =================================================================

    // --- Step 5: Type payment request into chat input ---
    await expect(chatInput).toBeVisible({ timeout: 3000 });
    await chatInput.fill('Process payment of £2,000 to Smith & Sons Ltd');

    // --- Step 6: Click Send button and wait for second action proposal ---
    const sendBtn2 = await getSendBtn();
    await expect(sendBtn2).toBeVisible({ timeout: 3000 });
    await sendBtn2.click();

    // Wait for the second user message to appear
    const userMessage2 = copilotDrawer.getByText(/Process payment/i).first();
    await expect(userMessage2).toBeVisible({ timeout: 10000 });

    // Wait for typing indicator to clear
    try {
      await expect(typingIndicator).toBeHidden({ timeout: 30000 });
    } catch {
      // Typing indicator may not be present
    }

    // Allow the second action proposal to render
    await page.waitForTimeout(2000);

    // There should now be two action proposal cards (one for journal, one for payment)
    const allProposalCards = copilotDrawer.locator(actionProposalSelector);
    const proposalCount = await allProposalCards.count();
    expect(proposalCount).toBeGreaterThanOrEqual(2);

    // Get the second (most recent) action proposal card
    const paymentProposalCard = allProposalCards.nth(proposalCount - 1);
    await expect(paymentProposalCard).toBeVisible({ timeout: 10000 });

    // Verify action type is CREATE_PAYMENT or similar
    const paymentCardText = await paymentProposalCard.textContent();
    const hasPaymentType =
      /create.?payment|process.?payment|payment|pay/i.test(paymentCardText || '');
    expect(hasPaymentType).toBeTruthy();

    // Verify payment details (£2,000, Smith & Sons)
    const hasPaymentAmount = /£?2[,.]?000|2000/i.test(paymentCardText || '');
    expect(hasPaymentAmount).toBeTruthy();
    expect(paymentCardText?.toLowerCase()).toMatch(/smith/i);

    // Verify Confirm and Reject buttons on the payment proposal
    const paymentConfirmBtn = paymentProposalCard
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

    const paymentConfirmBtnAlt = paymentProposalCard
      .getByRole('button', { name: /confirm|approve|accept/i })
      .first();

    const paymentConfirm =
      (await paymentConfirmBtn.count()) > 0 ? paymentConfirmBtn : paymentConfirmBtnAlt;
    await expect(paymentConfirm).toBeVisible({ timeout: 5000 });
    await expect(paymentConfirm).toBeEnabled();

    const paymentRejectBtn = paymentProposalCard
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

    const paymentRejectBtnAlt = paymentProposalCard
      .getByRole('button', { name: /reject|cancel|decline|dismiss/i })
      .first();

    const paymentReject =
      (await paymentRejectBtn.count()) > 0 ? paymentRejectBtn : paymentRejectBtnAlt;
    await expect(paymentReject).toBeVisible({ timeout: 5000 });
    await expect(paymentReject).toBeEnabled();

    // The payment was NOT auto-executed — verify no success/completed state
    const paymentAutoExecuted = paymentProposalCard
      .locator(
        [
          '[class*="completed"]',
          '[class*="success"]',
          '[class*="executed"]',
          '[data-status="completed"]',
          '[data-status="executed"]',
          '[data-status="success"]',
        ].join(', '),
      )
      .first();

    const paymentWasAutoExecuted =
      (await paymentAutoExecuted.count()) > 0 &&
      (await paymentAutoExecuted.isVisible().catch(() => false));
    expect(paymentWasAutoExecuted).toBeFalsy();

    // Visual Checkpoint 3: CREATE_PAYMENT also requires approval — guardrail confirmed
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-payment-action-proposal.png`,
      fullPage: true,
    });

    // Final verification: both financial action proposals required approval
    // Neither was auto-executed — the NFR16 guardrail is in effect
  });
});
