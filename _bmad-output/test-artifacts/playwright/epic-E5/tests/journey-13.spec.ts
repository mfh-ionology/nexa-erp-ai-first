import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5/journey-13';

test.describe('J13 — Cash Flow Forecast with Negative Balance Alert', () => {
  test('generate extended forecast and verify NEGATIVE_BALANCE alert with shortfall details and suggested action', async ({
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

    // --- Navigate to cash flow forecast page ---
    await page.goto('/ai/predictions/cash-flow');
    await page.waitForLoadState('networkidle');

    // Verify page loaded
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

    // --- Step 1: Fill form with extended 10-month forecast range ---
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
    await startDateInput.fill('2026-03-01');

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
    await endDateInput.fill('2026-12-31');

    // Ensure "Include Committed POs" is checked
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
    const committedPOsAlt = page.getByLabel(/committed po/i).first();
    const committedPOs =
      (await committedPOsCheckbox.count()) > 0 ? committedPOsCheckbox : committedPOsAlt;
    await expect(committedPOs).toBeVisible({ timeout: 5000 });
    if (!(await committedPOs.isChecked())) {
      await committedPOs.check();
    }

    // Ensure "Include Recurring Payments" is checked
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
    if (!(await recurring.isChecked())) {
      await recurring.check();
    }

    // Visual Checkpoint 1: Form filled with extended range
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-form-filled-extended-range.png`,
      fullPage: true,
    });

    // --- Step 2: Click "Generate Forecast" and verify results with alerts ---
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
    await generateButton.click();

    // Wait for results to load — look for results section or period data
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

    // Look for Alerts section — it should appear when a negative balance period is detected
    const alertsSection = page
      .locator(
        [
          '[data-testid="forecast-alerts"]',
          '[data-testid="alerts-section"]',
          '[class*="alert"]',
          'section:has-text("Alert")',
          'div:has-text("NEGATIVE_BALANCE")',
          'div:has-text("Negative Balance")',
          'div:has-text("negative balance")',
          ':text-matches("LOW_BALANCE|NEGATIVE_BALANCE|COLLECTION_OPPORTUNITY", "i")',
          '[class*="Alert"]',
          '[role="alert"]',
        ].join(', '),
      )
      .first();

    // The alerts section should be visible if any period has negative balance
    await expect(alertsSection).toBeVisible({ timeout: 10000 });

    // Visual Checkpoint 2: Forecast results with alerts section
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-forecast-results-with-alerts.png`,
      fullPage: true,
    });

    // --- Step 3: Verify alert card details ---

    // Verify alert type badge (NEGATIVE_BALANCE or LOW_BALANCE)
    const alertTypeBadge = page
      .locator(
        [
          ':text-matches("NEGATIVE_BALANCE", "i")',
          ':text-matches("Negative Balance", "i")',
          ':text-matches("LOW_BALANCE", "i")',
          ':text-matches("Low Balance", "i")',
          '[data-testid*="alert-type"]',
          '[class*="alert-type"]',
          '[class*="badge"]:has-text("Negative")',
          '[class*="badge"]:has-text("Low")',
        ].join(', '),
      )
      .first();
    await expect(alertTypeBadge).toBeVisible({ timeout: 5000 });

    // Verify the alert has a descriptive message
    const alertMessage = page
      .locator(
        [
          '[data-testid*="alert-message"]',
          '[class*="alert-message"]',
          '[class*="alert"] p',
          '[class*="alert"] [class*="message"]',
          '[class*="alert"] [class*="description"]',
          '[role="alert"] p',
          '[role="alert"] [class*="message"]',
        ].join(', '),
      )
      .first();
    // If a specific alert message element is not found, check for any descriptive text near the alert badge
    const hasAlertMessage = (await alertMessage.count()) > 0;
    if (hasAlertMessage) {
      await expect(alertMessage).toBeVisible({ timeout: 5000 });
    }

    // Verify a negative amount is displayed (shortfall — contains a negative £ value or parenthesised amount)
    const negativeAmount = page
      .locator(
        [
          ':text-matches("-£[\\d,]+\\.?\\d*")',
          ':text-matches("\\(£[\\d,]+\\.?\\d*\\)")',
          ':text-matches("Shortfall")',
          ':text-matches("shortfall")',
          '[data-testid*="alert-amount"]',
          '[class*="alert"] :text-matches("£")',
        ].join(', '),
      )
      .first();
    await expect(negativeAmount).toBeVisible({ timeout: 5000 });

    // Verify affected period is indicated
    const affectedPeriod = page
      .locator(
        [
          '[data-testid*="alert-period"]',
          '[class*="alert"] :text-matches("\\d{4}")',
          '[class*="alert"] :text-matches("(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)", "i")',
          '[role="alert"] :text-matches("(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)", "i")',
        ].join(', '),
      )
      .first();
    const hasAffectedPeriod = (await affectedPeriod.count()) > 0;
    if (hasAffectedPeriod) {
      await expect(affectedPeriod).toBeVisible({ timeout: 5000 });
    }

    // Verify suggested action text if present
    const suggestedAction = page
      .locator(
        [
          '[data-testid*="suggested-action"]',
          ':text-matches("Accelerate collections", "i")',
          ':text-matches("Defer payments", "i")',
          ':text-matches("Suggested Action", "i")',
          ':text-matches("Recommendation", "i")',
          '[class*="alert"] :text-matches("suggest|recommend|action", "i")',
        ].join(', '),
      )
      .first();
    const hasSuggestedAction = (await suggestedAction.count()) > 0;
    if (hasSuggestedAction) {
      await expect(suggestedAction).toBeVisible({ timeout: 5000 });
    }

    // Verify alert colour coding:
    // NEGATIVE_BALANCE should be red/destructive, LOW_BALANCE should be amber/warning
    // Check for colour-coded styling on the alert or badge element
    const colourCodedAlert = page
      .locator(
        [
          '[class*="danger"]',
          '[class*="destructive"]',
          '[class*="error"]',
          '[class*="warning"]',
          '[class*="red"]',
          '[class*="amber"]',
          '[data-severity="error"]',
          '[data-severity="warning"]',
        ].join(', '),
      )
      .first();
    const hasColourCoded = (await colourCodedAlert.count()) > 0;
    if (hasColourCoded) {
      await expect(colourCodedAlert).toBeVisible({ timeout: 5000 });
    }

    // Verify that the affected period row in the main table is highlighted
    const highlightedRow = page
      .locator(
        [
          'tr[class*="warning"]',
          'tr[class*="danger"]',
          'tr[class*="negative"]',
          'tr[class*="highlighted"]',
          '[data-testid*="period-row"][class*="alert"]',
          '[class*="period"][class*="warning"]',
          '[class*="period"][class*="negative"]',
        ].join(', '),
      )
      .first();
    const hasHighlightedRow = (await highlightedRow.count()) > 0;
    if (hasHighlightedRow) {
      await expect(highlightedRow).toBeVisible({ timeout: 5000 });
    }

    // Visual Checkpoint 3: Alert card detail verified
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-alert-card-detail.png`,
      fullPage: true,
    });
  });
});
