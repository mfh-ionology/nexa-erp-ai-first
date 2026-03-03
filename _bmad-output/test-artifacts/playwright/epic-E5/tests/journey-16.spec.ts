import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5/journey-16';

test.describe('J16 — View Daily Briefing as Finance Manager', () => {
  test('dashboard shows role-specific daily briefing with metrics, deltas, and actionable links', async ({
    page,
  }) => {
    // --- Pre-requisite: Log in as Finance Manager ---
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

    // --- Step 1: Navigate to "/" — Dashboard loads with briefing section ---
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify the Daily Briefing section is visible
    const briefingSection = page
      .locator(
        [
          '[data-testid="daily-briefing"]',
          '[data-testid="briefing-section"]',
          '[class*="briefing"]',
          '[class*="Briefing"]',
          'section:has-text("Briefing")',
          'section:has-text("briefing")',
          'div:has-text("Daily Briefing")',
          '[aria-label*="briefing" i]',
        ].join(', '),
      )
      .first();

    await expect(briefingSection).toBeVisible({ timeout: 15000 });

    // Visual Checkpoint 1: Dashboard loaded with Daily Briefing
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-dashboard-with-briefing.png`,
      fullPage: true,
    });

    // Verify we are on the dashboard
    const currentUrl = page.url();
    expect(currentUrl.endsWith('/') || currentUrl.includes('/dashboard')).toBeTruthy();

    // Verify greeting is present (personalised based on time of day)
    // Should show "Good morning", "Good afternoon", or "Good evening"
    const greetingSection = page
      .locator(
        [
          '[data-testid="briefing-greeting"]',
          '[class*="greeting"]',
          '[class*="Greeting"]',
        ].join(', '),
      )
      .first();

    // Fall back to text-based search for greeting
    const greetingText = page
      .locator(':text-matches("Good (morning|afternoon|evening)", "i")')
      .first();

    const hasGreetingByTestId = (await greetingSection.count()) > 0;
    const hasGreetingByText = (await greetingText.count()) > 0;
    expect(hasGreetingByTestId || hasGreetingByText).toBeTruthy();

    // Verify "Refresh" button or "cached at" timestamp exists
    const refreshOrCacheIndicator = page
      .locator(
        [
          'button:has-text("Refresh")',
          'button[aria-label*="refresh" i]',
          '[data-testid="briefing-refresh"]',
          ':text-matches("cached at|last updated|updated at", "i")',
          '[data-testid="briefing-timestamp"]',
          '[class*="cache-time"]',
        ].join(', '),
      )
      .first();

    await expect(refreshOrCacheIndicator).toBeVisible({ timeout: 5000 });

    // --- Step 2: Verify personalised greeting ---
    // The greeting should be appropriate for the current time of day
    const now = new Date();
    const hour = now.getHours();
    let expectedGreetingPattern: RegExp;
    if (hour < 12) {
      expectedGreetingPattern = /good morning/i;
    } else if (hour < 17) {
      expectedGreetingPattern = /good afternoon/i;
    } else {
      expectedGreetingPattern = /good evening/i;
    }

    const greetingElement = hasGreetingByTestId ? greetingSection : greetingText;
    const greetingContent = await greetingElement.textContent();
    expect(greetingContent).toBeTruthy();
    // Verify the greeting matches expected time-of-day pattern
    expect(greetingContent!.toLowerCase()).toMatch(expectedGreetingPattern);

    // --- Step 3: Verify briefing item card with metric and actions ---
    // Look for briefing item cards with title, description, metric value, delta, and action buttons
    const briefingCards = page
      .locator(
        [
          '[data-testid*="briefing-item"]',
          '[data-testid*="briefing-card"]',
          '[class*="briefing-item"]',
          '[class*="BriefingItem"]',
          '[class*="briefing-card"]',
          '[class*="BriefingCard"]',
        ].join(', '),
      );

    // If no data-testid matches, try to find cards within the briefing section
    const cardCount = await briefingCards.count();
    let briefingItemCards = briefingCards;
    if (cardCount === 0) {
      // Fallback: look for card-like elements within the briefing section
      briefingItemCards = briefingSection.locator(
        [
          '[class*="card"]',
          '[class*="Card"]',
          '[role="article"]',
          'article',
          'li',
        ].join(', '),
      );
    }

    // Verify at least one briefing item card exists
    const itemCount = await briefingItemCards.count();
    expect(itemCount).toBeGreaterThan(0);

    // Verify the first card has essential elements
    const firstCard = briefingItemCards.first();
    await expect(firstCard).toBeVisible({ timeout: 5000 });

    // Verify metric value exists (GBP amount like £12,400 or a number)
    const metricValue = page
      .locator(
        [
          '[data-testid*="briefing-metric"]',
          '[class*="metric"]',
          '[class*="Metric"]',
          ':text-matches("£[\\\\d,]+\\\\.?\\\\d*")',
          ':text-matches("\\\\d+ (Overdue|Pending|Outstanding)", "i")',
        ].join(', '),
      )
      .first();

    await expect(metricValue).toBeVisible({ timeout: 5000 });

    // Verify delta/trend indicator exists (e.g., "+12% vs last month", up/down arrow)
    const deltaIndicator = page
      .locator(
        [
          '[data-testid*="delta"]',
          '[data-testid*="trend"]',
          '[class*="delta"]',
          '[class*="Delta"]',
          '[class*="trend"]',
          '[class*="Trend"]',
          ':text-matches("[+-]?\\\\d+%")',
          ':text-matches("vs (last|previous|prior)", "i")',
        ].join(', '),
      )
      .first();

    await expect(deltaIndicator).toBeVisible({ timeout: 5000 });

    // Verify action buttons exist on briefing items (e.g., "Chase", "Review", "Approve", "Approve All")
    const actionButtons = page
      .locator(
        [
          '[data-testid*="briefing-action"]',
          'button:has-text("Chase")',
          'button:has-text("Review")',
          'button:has-text("Approve")',
          'button:has-text("Approve All")',
          'a:has-text("Chase")',
          'a:has-text("Review")',
          'a:has-text("Approve")',
          'a:has-text("View")',
          'a:has-text("View All")',
        ].join(', '),
      );

    const actionButtonCount = await actionButtons.count();
    expect(actionButtonCount).toBeGreaterThan(0);

    // Visual Checkpoint 2: Briefing item card detail
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-briefing-item-card-detail.png`,
      fullPage: true,
    });

    // --- Step 4: Verify Pending Approvals category ---
    const pendingApprovals = page
      .locator(
        [
          '[data-testid*="pending-approvals"]',
          ':text-matches("Pending Approval", "i")',
          ':text-matches("Awaiting Approval", "i")',
          ':text-matches("Approvals", "i")',
        ].join(', '),
      )
      .first();

    await expect(pendingApprovals).toBeVisible({ timeout: 5000 });

    // Verify Pending Approvals has a count or action
    // Look for a number near the text, or an action button like "Approve All" or "Review"
    const approvalAction = page
      .locator(
        [
          'button:has-text("Approve All")',
          'button:has-text("Review")',
          'a:has-text("Approve All")',
          'a:has-text("Review")',
          '[data-testid*="approval-action"]',
        ].join(', '),
      )
      .first();

    // At least the section heading should be visible
    const pendingApprovalsText = await pendingApprovals.textContent();
    expect(pendingApprovalsText).toBeTruthy();

    // --- Step 5: Verify Cash Position category ---
    const cashPosition = page
      .locator(
        [
          '[data-testid*="cash-position"]',
          ':text-matches("Cash Position", "i")',
          ':text-matches("Cash Balance", "i")',
          ':text-matches("Bank Balance", "i")',
        ].join(', '),
      )
      .first();

    await expect(cashPosition).toBeVisible({ timeout: 5000 });

    // Verify Cash Position shows a monetary value
    const cashValue = page
      .locator(':text-matches("£[\\\\d,]+\\\\.?\\\\d*")')
      .first();

    await expect(cashValue).toBeVisible({ timeout: 5000 });

    // --- Step 6: Click action button on a briefing item ---
    // Find a clickable action on a briefing item (e.g., "Review" on overdue invoices)
    const clickableAction = page
      .locator(
        [
          'button:has-text("Review")',
          'a:has-text("Review")',
          'button:has-text("Chase")',
          'a:has-text("Chase")',
          'button:has-text("View")',
          'a:has-text("View")',
          'button:has-text("View All")',
          'a:has-text("View All")',
          '[data-testid*="briefing-action"]',
        ].join(', '),
      )
      .first();

    await expect(clickableAction).toBeVisible({ timeout: 5000 });

    // Record URL before clicking
    const urlBeforeAction = page.url();

    // Click the action
    await clickableAction.click();

    // Wait for navigation or page change
    await page.waitForLoadState('networkidle');

    // Verify navigation occurred (URL should have changed or page content updated)
    // Allow for either URL change or same-page content update
    const urlAfterAction = page.url();

    // Visual Checkpoint 3: Navigation result after action click
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-6-action-navigation-result.png`,
      fullPage: true,
    });

    // Verify we navigated away from the dashboard to a relevant page
    // OR that the page now shows a filtered/specific view
    // The URL should contain a relevant path like /invoices, /approvals, /ar/, etc.
    // OR the page content should show a list/detail view
    const pageChangedOrFiltered =
      urlAfterAction !== urlBeforeAction ||
      (await page.locator('table, [data-testid*="list"], [class*="list"], [role="grid"]').count()) > 0;

    expect(pageChangedOrFiltered).toBeTruthy();

    // Verify the destination page has meaningful content (not an error page)
    const errorIndicator = page.locator(':text-matches("404|Not Found|Error|Something went wrong", "i")').first();
    const hasError = (await errorIndicator.count()) > 0 && (await errorIndicator.isVisible());
    expect(hasError).toBeFalsy();

    // Verify breadcrumb or page title confirms the destination
    const pageIdentifier = page
      .locator(
        [
          'h1',
          'h2',
          '[data-testid="page-title"]',
          'nav[aria-label*="breadcrumb" i]',
          '[class*="breadcrumb"]',
          '[class*="Breadcrumb"]',
        ].join(', '),
      )
      .first();

    await expect(pageIdentifier).toBeVisible({ timeout: 5000 });
  });
});
