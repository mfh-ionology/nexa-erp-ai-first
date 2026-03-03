import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5/journey-18';

test.describe('J18 — Smart Suggestions Change with Page Context', () => {
  test('quick prompt chips update based on current page context (Dashboard, Customer Detail, Invoice List)', async ({
    page,
  }) => {
    // ======================================================================
    // Login as Finance Manager (has ai.suggestions access, STAFF+)
    // ======================================================================
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

    // Wait for navigation away from /login
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // ======================================================================
    // Step 1: Navigate to Dashboard (/)
    // ======================================================================
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // ======================================================================
    // Step 2: Click Chat toggle button to open Co-Pilot drawer
    // ======================================================================
    const chatToggle = page
      .locator(
        [
          '[data-testid="chat-toggle"]',
          '[data-testid="copilot-toggle"]',
          '[data-testid="ai-toggle"]',
          '[aria-label*="Co-Pilot" i]',
          '[aria-label*="chat" i]',
          '[aria-label*="copilot" i]',
          'button:has-text("Co-Pilot")',
          'button:has([class*="chat-icon"])',
          'button:has([class*="copilot"])',
        ].join(', '),
      )
      .first();

    await expect(chatToggle).toBeVisible({ timeout: 10000 });
    await chatToggle.click();

    // Wait for the Co-Pilot drawer to open
    const coPilotDrawer = page
      .locator(
        [
          '[data-testid="copilot-drawer"]',
          '[data-testid="chat-drawer"]',
          '[data-testid="copilot-panel"]',
          '[class*="copilot-drawer"]',
          '[class*="CopilotDrawer"]',
          '[class*="chat-drawer"]',
          '[class*="ChatDrawer"]',
          '[role="complementary"]',
          'aside:has-text("Co-Pilot")',
          'div[class*="drawer"]:has-text("Co-Pilot")',
        ].join(', '),
      )
      .first();

    await expect(coPilotDrawer).toBeVisible({ timeout: 10000 });

    // ======================================================================
    // Step 3: Verify quick prompt chips on Dashboard
    // ======================================================================
    // Quick prompt chips should show dashboard-relevant suggestions
    const chipContainer = page
      .locator(
        [
          '[data-testid="quick-prompts"]',
          '[data-testid="prompt-chips"]',
          '[data-testid="suggestion-chips"]',
          '[class*="quick-prompt"]',
          '[class*="QuickPrompt"]',
          '[class*="prompt-chip"]',
          '[class*="PromptChip"]',
          '[class*="suggestion-chip"]',
          '[class*="SuggestionChip"]',
          '[role="list"]:has([role="option"])',
        ].join(', '),
      )
      .first();

    await expect(chipContainer).toBeVisible({ timeout: 10000 });

    // Verify dashboard-context chips are present
    // Expected: 'Morning briefing', 'What needs my attention?', 'Revenue this month'
    const dashboardChipTexts = [
      /morning briefing/i,
      /what needs my attention/i,
      /revenue/i,
      /briefing/i,
      /attention/i,
      /cash flow/i,
      /overdue/i,
    ];

    // Find all chip elements
    const allChips = page
      .locator(
        [
          '[data-testid*="chip"]',
          '[data-testid*="prompt"]',
          '[data-testid*="suggestion"]',
          '[class*="chip"]',
          '[class*="Chip"]',
          '[role="option"]',
          'button[class*="prompt"]',
          'button[class*="suggestion"]',
        ].join(', '),
      );

    // There should be at least one chip visible
    const chipCount = await allChips.count();
    expect(chipCount).toBeGreaterThan(0);

    // Collect dashboard chip text for later comparison
    const dashboardChipValues: string[] = [];
    for (let i = 0; i < chipCount; i++) {
      const text = await allChips.nth(i).textContent();
      if (text) dashboardChipValues.push(text.trim());
    }

    // At least one chip should match a dashboard-context keyword
    const hasDashboardChip = dashboardChipValues.some((text) =>
      dashboardChipTexts.some((regex) => regex.test(text)),
    );
    expect(hasDashboardChip).toBeTruthy();

    // Visual Checkpoint 1: Dashboard quick prompt chips
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-dashboard-chips.png`,
      fullPage: true,
    });

    // ======================================================================
    // Step 4: Navigate to a Customer Detail page
    // ======================================================================
    // First try to find a customer ID by navigating to the customer list
    await page.goto('/ar/customers');
    await page.waitForLoadState('networkidle');

    // Try to click the first customer in the list to get a real customer detail page
    const customerLink = page
      .locator(
        [
          'table tbody tr td a',
          '[data-testid*="customer-row"] a',
          '[data-testid*="customer-link"]',
          'a[href*="/ar/customers/"]',
          'table tbody tr:first-child a',
          'table tbody tr:first-child td:first-child',
        ].join(', '),
      )
      .first();

    const hasCustomerLink = (await customerLink.count()) > 0 && (await customerLink.isVisible());

    if (hasCustomerLink) {
      await customerLink.click();
      await page.waitForLoadState('networkidle');
    } else {
      // Fallback: navigate to a known test customer path
      await page.goto('/ar/customers/some-customer-id');
      await page.waitForLoadState('networkidle');
    }

    // ======================================================================
    // Step 5: Verify quick prompt chips changed to customer context
    // ======================================================================
    // Re-open Co-Pilot drawer if it closed during navigation
    const drawerStillOpen = await coPilotDrawer.isVisible();
    if (!drawerStillOpen) {
      await chatToggle.click();
      await expect(coPilotDrawer).toBeVisible({ timeout: 10000 });
    }

    // Wait for chips to update
    await page.waitForTimeout(1000);

    // Collect customer detail chip text
    const customerChipValues: string[] = [];
    const customerChipCount = await allChips.count();

    for (let i = 0; i < customerChipCount; i++) {
      const text = await allChips.nth(i).textContent();
      if (text) customerChipValues.push(text.trim());
    }

    // Customer-context chip keywords
    const customerChipTexts = [
      /invoice this customer/i,
      /show payment history/i,
      /payment history/i,
      /credit check/i,
      /view outstanding/i,
      /outstanding/i,
      /invoice/i,
      /payment/i,
      /statement/i,
    ];

    // At least one chip should match a customer-context keyword
    const hasCustomerChip = customerChipValues.some((text) =>
      customerChipTexts.some((regex) => regex.test(text)),
    );
    expect(hasCustomerChip).toBeTruthy();

    // Verify chips are DIFFERENT from dashboard chips
    const chipsAreDifferent =
      JSON.stringify(dashboardChipValues.sort()) !== JSON.stringify(customerChipValues.sort());
    expect(chipsAreDifferent).toBeTruthy();

    // Visual Checkpoint 2: Customer Detail quick prompt chips
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-customer-detail-chips.png`,
      fullPage: true,
    });

    // ======================================================================
    // Step 6: Click 'Show payment history' chip (or first customer-context chip)
    // ======================================================================
    // Try to find the specific "Show payment history" chip
    const paymentHistoryChip = page
      .locator(
        [
          'button:has-text("Show payment history")',
          'button:has-text("Payment history")',
          '[data-testid*="chip"]:has-text("payment history")',
          '[class*="chip"]:has-text("payment history")',
          '[role="option"]:has-text("payment history")',
        ].join(', '),
      )
      .first();

    const hasPaymentChip =
      (await paymentHistoryChip.count()) > 0 && (await paymentHistoryChip.isVisible());

    if (hasPaymentChip) {
      await paymentHistoryChip.click();
    } else {
      // Fallback: click the first customer-context chip available
      const firstCustomerChip = allChips.first();
      if ((await firstCustomerChip.count()) > 0) {
        await firstCustomerChip.click();
      }
    }

    // Wait for the AI to respond — look for a user message bubble and AI response
    const conversationArea = page
      .locator(
        [
          '[data-testid="conversation-area"]',
          '[data-testid="chat-messages"]',
          '[data-testid="message-list"]',
          '[class*="conversation"]',
          '[class*="Conversation"]',
          '[class*="message-list"]',
          '[class*="MessageList"]',
          '[class*="chat-body"]',
          '[class*="ChatBody"]',
        ].join(', '),
      )
      .first();

    // Wait for at least one message to appear (the auto-submitted user prompt)
    const userMessage = page
      .locator(
        [
          '[data-testid*="user-message"]',
          '[data-testid*="message-user"]',
          '[class*="user-message"]',
          '[class*="UserMessage"]',
          '[class*="message-right"]',
          '[class*="message"][class*="user"]',
        ].join(', '),
      )
      .first();

    await expect(userMessage).toBeVisible({ timeout: 15000 });

    // Wait for AI response to complete (typing indicator disappears or AI message visible)
    const aiMessage = page
      .locator(
        [
          '[data-testid*="ai-message"]',
          '[data-testid*="message-ai"]',
          '[data-testid*="assistant-message"]',
          '[class*="ai-message"]',
          '[class*="AiMessage"]',
          '[class*="assistant-message"]',
          '[class*="AssistantMessage"]',
          '[class*="message-left"]',
          '[class*="message"][class*="assistant"]',
        ].join(', '),
      )
      .first();

    await expect(aiMessage).toBeVisible({ timeout: 30000 });

    // Visual Checkpoint 3: Payment history response after chip click
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-payment-history-response.png`,
      fullPage: true,
    });

    // ======================================================================
    // Step 7: Navigate to Invoice List page (/ar/invoices)
    // ======================================================================
    await page.goto('/ar/invoices');
    await page.waitForLoadState('networkidle');

    // ======================================================================
    // Step 8: Verify quick prompt chips changed to invoice-list context
    // ======================================================================
    // Re-open Co-Pilot drawer if it closed during navigation
    const drawerOpenAfterInvoice = await coPilotDrawer.isVisible();
    if (!drawerOpenAfterInvoice) {
      await chatToggle.click();
      await expect(coPilotDrawer).toBeVisible({ timeout: 10000 });
    }

    // Wait for chips to update
    await page.waitForTimeout(1000);

    // Collect invoice list chip text
    const invoiceChipValues: string[] = [];
    const invoiceChipCount = await allChips.count();

    for (let i = 0; i < invoiceChipCount; i++) {
      const text = await allChips.nth(i).textContent();
      if (text) invoiceChipValues.push(text.trim());
    }

    // Invoice-list-context chip keywords
    const invoiceChipTexts = [
      /show overdue/i,
      /overdue/i,
      /create invoice/i,
      /export all/i,
      /send statements/i,
      /statements/i,
      /outstanding/i,
      /aged debt/i,
      /invoice/i,
    ];

    // At least one chip should match an invoice-list-context keyword
    const hasInvoiceChip = invoiceChipValues.some((text) =>
      invoiceChipTexts.some((regex) => regex.test(text)),
    );
    expect(hasInvoiceChip).toBeTruthy();

    // Verify chips are DIFFERENT from customer detail chips
    const invoiceChipsDifferent =
      JSON.stringify(customerChipValues.sort()) !== JSON.stringify(invoiceChipValues.sort());
    expect(invoiceChipsDifferent).toBeTruthy();

    // Visual Checkpoint 4: Invoice List quick prompt chips
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-8-invoice-list-chips.png`,
      fullPage: true,
    });

    // Verify no error states on the page
    const errorIndicator = page
      .locator(':text-matches("404|Not Found|Something went wrong|Error", "i")')
      .first();
    const hasError =
      (await errorIndicator.count()) > 0 && (await errorIndicator.isVisible());
    expect(hasError).toBeFalsy();
  });
});
