import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5/journey-1';

test.describe('J01 — Verify AI UI Elements Present in App Shell', () => {
  test('after login, app shell contains unified search/AI input, chat toggle, and Co-Pilot drawer is closed', async ({
    page,
  }) => {
    // --- Step 1: Navigate to /login ---
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Verify login page loaded
    const emailInput = page.getByRole('textbox', { name: /email/i });
    await expect(emailInput).toBeVisible({ timeout: 15000 });

    // --- Step 2: Fill login form ---
    await emailInput.fill('finance@nexa-test.co.uk');
    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();
    await passwordInput.fill('Finance123!');

    // --- Step 3: Click Sign In and verify redirect to dashboard ---
    const signInButton = page.getByRole('button', { name: /sign in|log in|submit|login/i });
    await expect(signInButton).toBeVisible();
    await signInButton.click();

    // Wait for navigation away from /login — dashboard should load
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // Visual Checkpoint 1: Dashboard loaded after login
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-dashboard-after-login.png`,
      fullPage: true,
    });

    // Verify we are on the dashboard (not still on login)
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/login');

    // Verify app shell elements are visible: sidebar and header
    // Sidebar navigation should be present
    const sidebar = page.locator('nav, aside, [data-testid="sidebar"], [class*="sidebar"]').first();
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // Header bar should be present
    const header = page.locator('header, [data-testid="header"], [class*="header"]').first();
    await expect(header).toBeVisible();

    // --- Step 4: Verify unified search/AI input in header bar ---
    // The search/AI input should be in the header with rotating placeholder text
    const searchInput = page
      .locator(
        [
          'input[placeholder*="Ask Nexa"]',
          'input[placeholder*="Search"]',
          'input[placeholder*="search"]',
          '[data-testid="unified-search"]',
          '[data-testid="search-input"]',
          '[role="combobox"][aria-label*="search" i]',
          '[role="searchbox"]',
        ].join(', '),
      )
      .first();

    await expect(searchInput).toBeVisible({ timeout: 5000 });

    // Visual Checkpoint 2: Search input verified
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-search-input-verified.png`,
      fullPage: true,
    });

    // Verify placeholder text exists (should rotate between entity search and AI command examples)
    const placeholder = await searchInput.getAttribute('placeholder');
    expect(placeholder).toBeTruthy();
    // Placeholder should contain recognizable English text, not raw keys
    expect(placeholder!.length).toBeGreaterThan(3);

    // --- Step 5: Verify chat toggle button (Co-Pilot button) ---
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

    // Fallback: look for a button with chat-related text or icon
    const chatToggleAlt = page.getByRole('button', { name: /chat|copilot|co-pilot|assistant/i }).first();

    // Try primary selector first, fall back to text-based
    const chatButton = (await chatToggle.count()) > 0 ? chatToggle : chatToggleAlt;
    await expect(chatButton).toBeVisible({ timeout: 5000 });

    // Visual Checkpoint 3: Chat toggle button verified
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-chat-toggle-verified.png`,
      fullPage: true,
    });

    // Verify no badge indicator is currently shown (no pending AI suggestions)
    // Badge would be a small dot or count indicator on or near the chat button
    const badge = page
      .locator(
        [
          '[data-testid="chat-badge"]',
          '[data-testid="copilot-badge"]',
          'button[aria-label*="chat" i] [class*="badge"]',
          'button[aria-label*="copilot" i] [class*="badge"]',
        ].join(', '),
      )
      .first();

    // Badge should NOT be visible (no pending suggestions on first login)
    if ((await badge.count()) > 0) {
      await expect(badge).toBeHidden();
    }

    // --- Step 6: Verify Co-Pilot drawer is NOT visible (closed by default) ---
    const copilotDrawer = page
      .locator(
        [
          '[data-testid="copilot-drawer"]',
          '[class*="copilot-drawer"]',
          '[class*="CopilotDrawer"]',
          '[aria-label*="Co-Pilot" i]',
          '[aria-label*="copilot" i]',
        ].join(', '),
      )
      .first();

    // The drawer should NOT be visible — it is closed by default on first login
    if ((await copilotDrawer.count()) > 0) {
      await expect(copilotDrawer).toBeHidden();
    }
    // If the drawer element doesn't exist in the DOM at all, that also counts as "closed"

    // Visual Checkpoint 4: Final state — all verified, drawer closed
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-drawer-closed-confirmed.png`,
      fullPage: true,
    });

    // Final assertions: the dashboard main content area should be visible and not obscured
    const mainContent = page
      .locator('main, [role="main"], [data-testid="main-content"], [class*="main"]')
      .first();
    await expect(mainContent).toBeVisible();
  });
});
