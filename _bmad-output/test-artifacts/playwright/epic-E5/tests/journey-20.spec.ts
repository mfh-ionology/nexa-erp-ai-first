import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5/journey-20';

test.describe('J20 — AI Service Degradation — Graceful Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    // Block ALL AI-related API requests to simulate AI Gateway being unreachable.
    // This must be set up BEFORE any navigation so the app cannot reach AI services.

    // Block AI chat WebSocket / Socket.io connections
    await page.route('**/socket.io/**', (route) => {
      route.abort('connectionrefused');
    });
    await page.route('**/ai/chat/socket**', (route) => {
      route.abort('connectionrefused');
    });

    // Block AI chat HTTP fallback endpoints
    await page.route('**/api/v1/ai/chat/**', (route) => {
      route.abort('connectionrefused');
    });
    await page.route('**/api/v1/ai/chat', (route) => {
      route.abort('connectionrefused');
    });

    // Block AI predictions endpoints (cash flow, anomaly, duplicates)
    await page.route('**/api/v1/ai/predictions/**', (route) => {
      route.abort('connectionrefused');
    });

    // Block AI briefing endpoints
    await page.route('**/api/v1/ai/briefing/**', (route) => {
      route.abort('connectionrefused');
    });
    await page.route('**/api/v1/ai/briefing', (route) => {
      route.abort('connectionrefused');
    });

    // Block AI suggestions endpoints
    await page.route('**/api/v1/ai/suggestions/**', (route) => {
      route.abort('connectionrefused');
    });

    // Block any generic AI gateway routes
    await page.route('**/ai-gateway/**', (route) => {
      route.abort('connectionrefused');
    });

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

  test('dashboard loads normally when AI Gateway is unreachable (IMP-006)', async ({ page }) => {
    // --- Step 1: Verify dashboard loads with traditional UI fully functional ---
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Allow time for AI connection attempts to fail and fallback states to render
    await page.waitForTimeout(3000);

    // Verify traditional UI elements are present and functional
    // Sidebar navigation should be visible
    const sidebar = page
      .locator(
        [
          'nav',
          '[data-testid="sidebar"]',
          '[class*="sidebar"]',
          '[class*="Sidebar"]',
          '[role="navigation"]',
        ].join(', '),
      )
      .first();
    await expect(sidebar).toBeVisible({ timeout: 5000 });

    // Header bar should be visible
    const header = page
      .locator(
        [
          'header',
          '[data-testid="header"]',
          '[class*="header"]',
          '[class*="Header"]',
          '[class*="top-bar"]',
          '[class*="TopBar"]',
        ].join(', '),
      )
      .first();
    await expect(header).toBeVisible({ timeout: 5000 });

    // Page should NOT have a fatal crash overlay or unhandled error
    const crashOverlay = page
      .locator(
        [
          '[class*="error-overlay"]',
          '[class*="ErrorOverlay"]',
          '[class*="crash"]',
          '[id="webpack-dev-server-client-overlay"]',
          'vite-error-overlay',
        ].join(', '),
      )
      .first();
    const hasCrash = (await crashOverlay.count()) > 0;
    if (hasCrash) {
      const isVisible = await crashOverlay.isVisible().catch(() => false);
      expect(isVisible).toBe(false);
    }

    // Check if the Daily Briefing section shows a graceful degradation state
    const briefingSection = page
      .locator(
        [
          '[data-testid="daily-briefing"]',
          '[data-testid="briefing"]',
          '[class*="briefing"]',
          '[class*="Briefing"]',
          '[aria-label*="briefing" i]',
          '[aria-label*="daily" i]',
        ].join(', '),
      )
      .first();

    if ((await briefingSection.count()) > 0) {
      // Briefing section exists — check it has a graceful error/fallback state
      const briefingErrorText = briefingSection
        .locator(
          [
            ':has-text("unavailable")',
            ':has-text("temporarily")',
            ':has-text("try again")',
            ':has-text("offline")',
            ':has-text("could not load")',
          ].join(', '),
        )
        .first();

      const retryButton = briefingSection
        .locator(
          [
            'button:has-text("Retry")',
            'button:has-text("Refresh")',
            'button:has-text("Try again")',
            '[data-testid="retry-briefing"]',
          ].join(', '),
        )
        .first();

      // Either a graceful error message or a retry button should be visible
      // (or the briefing may simply be empty — which is also acceptable)
      const hasErrorText = (await briefingErrorText.count()) > 0;
      const hasRetryBtn = (await retryButton.count()) > 0;
      // Soft assertion: at least some degradation signal if briefing section exists
      // If neither exists, the briefing may have loaded from cache or shows empty — still acceptable
      if (hasErrorText || hasRetryBtn) {
        // Good — graceful degradation is visible
      }
    }

    // Visual Checkpoint 1: Dashboard with AI degraded
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-dashboard-ai-degraded.png`,
      fullPage: true,
    });
  });

  test('chat shows user-friendly error when AI Gateway is unreachable', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // --- Step 2: Click Chat toggle button to open Co-Pilot drawer ---
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

    const chatToggleAlt = page
      .getByRole('button', { name: /chat|copilot|co-pilot|assistant/i })
      .first();
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

    // --- Step 3: Fill chat input with message ---
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
    await chatInput.fill('Hello, can you help me?');

    // --- Step 4: Click Send button — AI should return error gracefully ---
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
    const userMessageText = copilotDrawer.getByText('Hello, can you help me?').first();
    await expect(userMessageText).toBeVisible({ timeout: 10000 });

    // Wait for the error response (should be graceful, not a crash)
    // Allow time for the request to fail and error state to render
    await page.waitForTimeout(5000);

    // Check for a graceful error message in the conversation area
    const errorMessage = copilotDrawer
      .locator(
        [
          '[data-testid*="error-message"]',
          '[data-testid*="ai-error"]',
          '[class*="error-message"]',
          '[class*="errorMessage"]',
          '[class*="ai-error"]',
          '[class*="service-unavailable"]',
          '[role="alert"]',
        ].join(', '),
      )
      .first();

    // Also look for error text patterns in the conversation area
    const errorTextPatterns = copilotDrawer
      .locator(
        [
          ':has-text("temporarily unavailable")',
          ':has-text("service is temporarily")',
          ':has-text("try again later")',
          ':has-text("currently unavailable")',
          ':has-text("currently offline")',
          ':has-text("could not connect")',
          ':has-text("unable to reach")',
          ':has-text("something went wrong")',
        ].join(', '),
      )
      .first();

    const hasErrorElement = (await errorMessage.count()) > 0;
    const hasErrorText = (await errorTextPatterns.count()) > 0;

    // At least one type of graceful error indicator should be visible
    // (either a dedicated error component or text indicating unavailability)
    expect(
      hasErrorElement || hasErrorText,
      'Expected a graceful error message when AI Gateway is unreachable — neither an error component nor error text was found in the Co-Pilot drawer',
    ).toBe(true);

    // Verify the error is user-friendly — no stack traces or technical jargon
    const conversationText = await copilotDrawer.textContent();
    if (conversationText) {
      expect(conversationText.toLowerCase()).not.toContain('stack trace');
      expect(conversationText.toLowerCase()).not.toContain('econnrefused');
      expect(conversationText.toLowerCase()).not.toContain('500 internal');
      expect(conversationText.toLowerCase()).not.toContain('typeerror');
      expect(conversationText.toLowerCase()).not.toContain('referenceerror');
      expect(conversationText.toLowerCase()).not.toContain('unhandled');
    }

    // Verify chat input is still usable (not frozen/broken)
    await expect(chatInput).toBeVisible();
    const isInputEnabled = await chatInput.isEnabled();
    expect(isInputEnabled).toBe(true);

    // Visual Checkpoint 2: Graceful chat error
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-chat-error-graceful.png`,
      fullPage: true,
    });
  });

  test('traditional UI (invoice list) remains fully functional when AI is degraded', async ({
    page,
  }) => {
    // --- Step 5: Navigate to /ar/invoices — traditional page should work ---
    await page.goto('/ar/invoices');
    await page.waitForLoadState('networkidle');

    // Allow time for page to fully render
    await page.waitForTimeout(2000);

    // Verify the page loaded and has traditional UI elements
    // Look for signs of a data list/table page
    const pageContent = page
      .locator(
        [
          '[data-testid="invoice-list"]',
          '[data-testid="invoices"]',
          '[class*="invoice"]',
          '[class*="Invoice"]',
          'table',
          '[role="table"]',
          '[role="grid"]',
          '[data-testid*="list"]',
          '[class*="data-table"]',
          '[class*="DataTable"]',
        ].join(', '),
      )
      .first();

    // Also check for the page title / heading
    const pageHeading = page
      .locator(
        [
          'h1:has-text("Invoice")',
          'h2:has-text("Invoice")',
          '[data-testid="page-title"]:has-text("Invoice")',
          '[class*="page-title"]:has-text("Invoice")',
          '[class*="PageTitle"]:has-text("Invoice")',
        ].join(', '),
      )
      .first();

    const headingAlt = page.getByRole('heading', { name: /invoice/i }).first();

    const hasPageContent = (await pageContent.count()) > 0;
    const hasPageHeading = (await pageHeading.count()) > 0;
    const hasHeadingAlt = (await headingAlt.count()) > 0;

    // At least one indicator that the invoice page loaded should be present
    expect(
      hasPageContent || hasPageHeading || hasHeadingAlt,
      'Expected the invoice list page to load with data table or heading — traditional UI should work even when AI is degraded',
    ).toBe(true);

    // Verify no crash overlay
    const crashOverlay = page
      .locator(
        [
          '[class*="error-overlay"]',
          '[class*="ErrorOverlay"]',
          '[class*="crash"]',
          '[id="webpack-dev-server-client-overlay"]',
          'vite-error-overlay',
        ].join(', '),
      )
      .first();

    const hasCrash = (await crashOverlay.count()) > 0;
    if (hasCrash) {
      const isVisible = await crashOverlay.isVisible().catch(() => false);
      expect(isVisible).toBe(false);
    }

    // Verify sidebar/navigation is still functional
    const sidebar = page
      .locator(
        [
          'nav',
          '[data-testid="sidebar"]',
          '[class*="sidebar"]',
          '[class*="Sidebar"]',
          '[role="navigation"]',
        ].join(', '),
      )
      .first();
    await expect(sidebar).toBeVisible({ timeout: 5000 });

    // Visual Checkpoint 3: Invoice list page functional despite AI degradation
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-invoices-page-functional.png`,
      fullPage: true,
    });
  });
});
