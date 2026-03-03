import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5/journey-12';

test.describe('J12 — Generate Cash Flow Forecast', () => {
  test('navigate to cash flow forecast, generate forecast, and verify period-by-period results with source breakdowns', async ({
    page,
  }) => {
    // --- Pre-requisite: Log in as Finance Manager (MANAGER role required for ai.predictions) ---
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

    // --- Step 1: Navigate to /ai/predictions/cash-flow ---
    await page.goto('/ai/predictions/cash-flow');
    await page.waitForLoadState('networkidle');

    // Verify cash flow forecast page loaded with configuration form
    // Look for the page heading
    const pageHeading = page
      .locator(
        [
          'h1:has-text("Cash Flow")',
          'h2:has-text("Cash Flow")',
          '[data-testid="page-title"]:has-text("Cash Flow")',
          'h1:has-text("cash flow")',
          'h2:has-text("cash flow")',
        ].join(', '),
      )
      .first();
    await expect(pageHeading).toBeVisible({ timeout: 10000 });

    // Verify Start Date input exists
    const startDateInput = page
      .locator(
        [
          'input[type="date"][name*="start" i]',
          'input[aria-label*="start date" i]',
          '[data-testid="start-date"]',
          'label:has-text("Start Date") + input',
          'label:has-text("Start Date") input',
          'input[placeholder*="Start" i]',
        ].join(', '),
      )
      .first();
    await expect(startDateInput).toBeVisible({ timeout: 5000 });

    // Verify End Date input exists
    const endDateInput = page
      .locator(
        [
          'input[type="date"][name*="end" i]',
          'input[aria-label*="end date" i]',
          '[data-testid="end-date"]',
          'label:has-text("End Date") + input',
          'label:has-text("End Date") input',
          'input[placeholder*="End" i]',
        ].join(', '),
      )
      .first();
    await expect(endDateInput).toBeVisible({ timeout: 5000 });

    // Verify "Include Committed POs" checkbox exists
    const committedPOsCheckbox = page
      .locator(
        [
          'input[type="checkbox"][name*="committed" i]',
          'label:has-text("Committed PO") input[type="checkbox"]',
          '[data-testid="include-committed-pos"] input[type="checkbox"]',
          'input[aria-label*="Committed PO" i]',
        ].join(', '),
      )
      .first();

    // If not found by locator, try getByLabel
    const committedPOsAlt = page.getByLabel(/committed po/i).first();
    const committedPOs =
      (await committedPOsCheckbox.count()) > 0 ? committedPOsCheckbox : committedPOsAlt;
    await expect(committedPOs).toBeVisible({ timeout: 5000 });

    // Verify "Include Recurring Payments" checkbox exists
    const recurringCheckbox = page
      .locator(
        [
          'input[type="checkbox"][name*="recurring" i]',
          'label:has-text("Recurring") input[type="checkbox"]',
          '[data-testid="include-recurring"] input[type="checkbox"]',
          'input[aria-label*="Recurring" i]',
        ].join(', '),
      )
      .first();

    const recurringAlt = page.getByLabel(/recurring/i).first();
    const recurring =
      (await recurringCheckbox.count()) > 0 ? recurringCheckbox : recurringAlt;
    await expect(recurring).toBeVisible({ timeout: 5000 });

    // Verify "Generate Forecast" button exists
    const generateButton = page
      .locator(
        [
          'button:has-text("Generate Forecast")',
          'button:has-text("Generate")',
          '[data-testid="generate-forecast"]',
          'button[type="submit"]',
        ].join(', '),
      )
      .first();
    await expect(generateButton).toBeVisible({ timeout: 5000 });
    await expect(generateButton).toBeEnabled();

    // Visual Checkpoint 1: Cash flow forecast page loaded with form
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-cash-flow-page-loaded.png`,
      fullPage: true,
    });

    // --- Step 2: Fill form with forecast parameters ---
    // Fill Start Date: 2026-03-01
    await startDateInput.fill('2026-03-01');

    // Fill End Date: 2026-06-30
    await endDateInput.fill('2026-06-30');

    // Ensure "Include Committed POs" is checked (should be checked by default)
    if (!(await committedPOs.isChecked())) {
      await committedPOs.check();
    }

    // Ensure "Include Recurring Payments" is checked (should be checked by default)
    if (!(await recurring.isChecked())) {
      await recurring.check();
    }

    // --- Step 3: Click "Generate Forecast" ---
    await generateButton.click();

    // Wait for results to load — look for a results section or period data to appear
    // The loading indicator should appear and then disappear
    const resultsSection = page
      .locator(
        [
          '[data-testid="forecast-results"]',
          '[class*="forecast-results"]',
          '[class*="ForecastResults"]',
          '[data-testid="period-breakdown"]',
          'table:has(th:has-text("Period"))',
          'table:has(th:has-text("Opening"))',
          '[class*="period"]',
          'section:has-text("Opening Balance")',
          'div:has-text("Opening Balance")',
        ].join(', '),
      )
      .first();

    await expect(resultsSection).toBeVisible({ timeout: 30000 });

    // Visual Checkpoint 2: Forecast results displayed
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-forecast-results-displayed.png`,
      fullPage: true,
    });

    // --- Step 4: Verify period breakdown row ---
    // Look for period data elements showing at least one complete period
    // Should contain: opening balance, inflows, outflows, net flow, closing balance

    // Verify "Opening Balance" label/text exists in results
    const openingBalanceText = page.getByText(/opening balance/i).first();
    await expect(openingBalanceText).toBeVisible({ timeout: 5000 });

    // Verify "Closing Balance" label/text exists in results
    const closingBalanceText = page.getByText(/closing balance/i).first();
    await expect(closingBalanceText).toBeVisible({ timeout: 5000 });

    // Verify "Inflows" label/text exists
    const inflowsText = page.getByText(/inflows/i).first();
    await expect(inflowsText).toBeVisible({ timeout: 5000 });

    // Verify "Outflows" label/text exists
    const outflowsText = page.getByText(/outflows/i).first();
    await expect(outflowsText).toBeVisible({ timeout: 5000 });

    // Verify "Net Flow" or "Net" label/text exists
    const netFlowText = page
      .locator(
        [
          ':text-matches("Net Flow", "i")',
          ':text-matches("Net Position", "i")',
          ':text-matches("Net Cash", "i")',
        ].join(', '),
      )
      .first();
    await expect(netFlowText).toBeVisible({ timeout: 5000 });

    // Verify GBP currency values are displayed (£ symbol present)
    const gbpValues = page.locator(':text-matches("£[\\\\d,]+\\\\.?\\\\d*")').first();
    await expect(gbpValues).toBeVisible({ timeout: 5000 });

    // Visual Checkpoint 3: Period detail verified
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-period-detail-verified.png`,
      fullPage: true,
    });

    // --- Step 5: Verify inflow/outflow source breakdowns ---
    // Each period should have expandable or visible inflow details
    // Inflow sources: 'AR outstanding', 'Recurring income'
    // Outflow sources: 'AP outstanding', 'Committed POs', 'Recurring payments'

    // Check for at least one inflow source detail
    const inflowSources = page
      .locator(
        [
          ':text-matches("AR [Oo]utstanding")',
          ':text-matches("Accounts [Rr]eceivable")',
          ':text-matches("Recurring [Ii]ncome")',
          ':text-matches("Trade [Rr]eceivables")',
          '[data-testid*="inflow-source"]',
        ].join(', '),
      )
      .first();
    await expect(inflowSources).toBeVisible({ timeout: 5000 });

    // Check for at least one outflow source detail
    const outflowSources = page
      .locator(
        [
          ':text-matches("AP [Oo]utstanding")',
          ':text-matches("Accounts [Pp]ayable")',
          ':text-matches("Committed PO")',
          ':text-matches("Recurring [Pp]ayment")',
          ':text-matches("Trade [Pp]ayables")',
          '[data-testid*="outflow-source"]',
        ].join(', '),
      )
      .first();
    await expect(outflowSources).toBeVisible({ timeout: 5000 });
  });
});
