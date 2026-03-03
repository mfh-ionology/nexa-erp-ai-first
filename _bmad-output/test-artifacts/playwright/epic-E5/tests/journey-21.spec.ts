import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5/journey-21';

test.describe('J21 — Prediction Endpoints Return 503 When AI Degraded', () => {
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

  test('cash flow forecast page shows graceful 503 error when AI is degraded', async ({
    page,
  }) => {
    // --- Step 1: Navigate to /ai/predictions/cash-flow ---
    await page.goto('/ai/predictions/cash-flow');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify the page loaded (not a crash or blank screen)
    // Look for the cash flow form or page heading
    const pageHeading = page
      .locator(
        [
          'h1:has-text("Cash Flow")',
          'h1:has-text("cash flow")',
          'h2:has-text("Cash Flow")',
          'h2:has-text("cash flow")',
          '[data-testid="page-title"]:has-text("Cash Flow")',
          '[data-testid="page-title"]:has-text("cash flow")',
        ].join(', '),
      )
      .first();

    const headingAlt = page.getByRole('heading', { name: /cash flow|forecast/i }).first();

    const hasPageHeading = (await pageHeading.count()) > 0;
    const hasHeadingAlt = (await headingAlt.count()) > 0;

    // The page should have loaded — at minimum we should see some content
    // (heading, form, or an immediate error state about the service)
    const pageText = await page.locator('body').textContent();
    const hasRelevantContent =
      hasPageHeading ||
      hasHeadingAlt ||
      (pageText && /cash flow|forecast|prediction/i.test(pageText));

    expect(
      hasRelevantContent,
      'Expected cash flow forecast page to load with heading or relevant content',
    ).toBe(true);

    // --- Step 2: Fill cash flow forecast form ---
    // Look for date inputs
    const startDateInput = page
      .locator(
        [
          'input[name*="start" i]',
          'input[aria-label*="start" i]',
          '[data-testid*="start-date"]',
          'input[type="date"]:first-of-type',
        ].join(', '),
      )
      .first();

    const endDateInput = page
      .locator(
        [
          'input[name*="end" i]',
          'input[aria-label*="end" i]',
          '[data-testid*="end-date"]',
          'input[type="date"]:last-of-type',
        ].join(', '),
      )
      .first();

    if ((await startDateInput.count()) > 0 && (await endDateInput.count()) > 0) {
      await startDateInput.fill('2026-03-01');
      await endDateInput.fill('2026-06-30');
    }

    // --- Step 3: Click "Generate Forecast" — expect graceful 503 error ---
    const generateButton = page
      .locator(
        [
          'button:has-text("Generate")',
          'button:has-text("generate")',
          'button:has-text("Forecast")',
          'button:has-text("forecast")',
          'button:has-text("Submit")',
          '[data-testid*="generate"]',
          '[data-testid*="forecast"]',
          'button[type="submit"]',
        ].join(', '),
      )
      .first();

    const generateAlt = page
      .getByRole('button', { name: /generate|forecast|submit|run/i })
      .first();
    const generateBtn = (await generateButton.count()) > 0 ? generateButton : generateAlt;

    if ((await generateBtn.count()) > 0) {
      await generateBtn.click();

      // Wait for the request to fail and error state to render
      await page.waitForTimeout(5000);
    }

    // Verify a graceful error message is displayed (not a crash)
    // Look for error-state UI elements
    const errorElements = page
      .locator(
        [
          '[data-testid*="error"]',
          '[class*="error-message"]',
          '[class*="errorMessage"]',
          '[class*="service-unavailable"]',
          '[role="alert"]',
          '[class*="error-state"]',
          '[class*="ErrorState"]',
          '[class*="empty-state"]',
          '[class*="EmptyState"]',
        ].join(', '),
      )
      .first();

    const errorTextPatterns = page
      .locator(
        [
          ':has-text("temporarily unavailable")',
          ':has-text("service is temporarily")',
          ':has-text("try again later")',
          ':has-text("currently unavailable")',
          ':has-text("currently offline")',
          ':has-text("could not generate")',
          ':has-text("forecast engine")',
          ':has-text("prediction service")',
          ':has-text("something went wrong")',
          ':has-text("unable to")',
        ].join(', '),
      )
      .first();

    const hasErrorElement = (await errorElements.count()) > 0;
    const hasErrorText = (await errorTextPatterns.count()) > 0;

    // At least one graceful error indicator should be present
    expect(
      hasErrorElement || hasErrorText,
      'Expected a graceful error message on the cash flow forecast page when AI Gateway is unreachable — neither an error component nor error text was found',
    ).toBe(true);

    // Verify NO crash overlay
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

    // Verify no technical jargon in the page
    const bodyText = await page.locator('body').textContent();
    if (bodyText) {
      expect(bodyText.toLowerCase()).not.toContain('stack trace');
      expect(bodyText.toLowerCase()).not.toContain('econnrefused');
      expect(bodyText.toLowerCase()).not.toContain('typeerror');
      expect(bodyText.toLowerCase()).not.toContain('referenceerror');
      expect(bodyText.toLowerCase()).not.toContain('unhandled');
    }

    // Check for an optional Retry button
    const retryButton = page
      .locator(
        [
          'button:has-text("Retry")',
          'button:has-text("Try again")',
          'button:has-text("Refresh")',
          '[data-testid*="retry"]',
        ].join(', '),
      )
      .first();

    if ((await retryButton.count()) > 0) {
      await expect(retryButton).toBeVisible();
    }

    // Visual Checkpoint 1: Cash flow 503 error state
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-cashflow-503-error.png`,
      fullPage: true,
    });
  });

  test('anomaly detection page shows graceful 503 error when AI is degraded', async ({ page }) => {
    // --- Step 4: Navigate to /ai/predictions/anomalies ---
    await page.goto('/ai/predictions/anomalies');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify the page loaded (not a crash or blank screen)
    const pageHeading = page
      .locator(
        [
          'h1:has-text("Anomal")',
          'h2:has-text("Anomal")',
          '[data-testid="page-title"]:has-text("Anomal")',
        ].join(', '),
      )
      .first();

    const headingAlt = page.getByRole('heading', { name: /anomal|detection|scan/i }).first();

    const hasPageHeading = (await pageHeading.count()) > 0;
    const hasHeadingAlt = (await headingAlt.count()) > 0;

    const pageText = await page.locator('body').textContent();
    const hasRelevantContent =
      hasPageHeading ||
      hasHeadingAlt ||
      (pageText && /anomal|detection|scan|prediction/i.test(pageText));

    expect(
      hasRelevantContent,
      'Expected anomaly detection page to load with heading or relevant content',
    ).toBe(true);

    // --- Step 5: Click "Run Scan" button — expect graceful 503 error ---
    const scanButton = page
      .locator(
        [
          'button:has-text("Run Scan")',
          'button:has-text("run scan")',
          'button:has-text("Scan")',
          'button:has-text("Detect")',
          'button:has-text("Analyse")',
          'button:has-text("Analyze")',
          '[data-testid*="scan"]',
          '[data-testid*="detect"]',
          'button[type="submit"]',
        ].join(', '),
      )
      .first();

    const scanAlt = page
      .getByRole('button', { name: /run scan|scan|detect|analyse|analyze|submit/i })
      .first();
    const scanBtn = (await scanButton.count()) > 0 ? scanButton : scanAlt;

    if ((await scanBtn.count()) > 0) {
      await scanBtn.click();

      // Wait for the request to fail and error state to render
      await page.waitForTimeout(5000);
    }

    // Verify graceful error message — same pattern as cash flow
    const errorElements = page
      .locator(
        [
          '[data-testid*="error"]',
          '[class*="error-message"]',
          '[class*="errorMessage"]',
          '[class*="service-unavailable"]',
          '[role="alert"]',
          '[class*="error-state"]',
          '[class*="ErrorState"]',
          '[class*="empty-state"]',
          '[class*="EmptyState"]',
        ].join(', '),
      )
      .first();

    const errorTextPatterns = page
      .locator(
        [
          ':has-text("temporarily unavailable")',
          ':has-text("service is temporarily")',
          ':has-text("try again later")',
          ':has-text("currently unavailable")',
          ':has-text("currently offline")',
          ':has-text("could not")',
          ':has-text("prediction service")',
          ':has-text("something went wrong")',
          ':has-text("unable to")',
        ].join(', '),
      )
      .first();

    const hasErrorElement = (await errorElements.count()) > 0;
    const hasErrorText = (await errorTextPatterns.count()) > 0;

    expect(
      hasErrorElement || hasErrorText,
      'Expected a graceful error message on the anomaly detection page when AI Gateway is unreachable — neither an error component nor error text was found',
    ).toBe(true);

    // Verify NO crash overlay
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

    // Verify no technical jargon
    const bodyText = await page.locator('body').textContent();
    if (bodyText) {
      expect(bodyText.toLowerCase()).not.toContain('stack trace');
      expect(bodyText.toLowerCase()).not.toContain('econnrefused');
      expect(bodyText.toLowerCase()).not.toContain('typeerror');
      expect(bodyText.toLowerCase()).not.toContain('referenceerror');
      expect(bodyText.toLowerCase()).not.toContain('unhandled');
    }

    // Verify page remains navigable — sidebar should still work
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

    // Visual Checkpoint 2: Anomaly detection 503 error state
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-5-anomaly-503-error.png`,
      fullPage: true,
    });
  });
});
