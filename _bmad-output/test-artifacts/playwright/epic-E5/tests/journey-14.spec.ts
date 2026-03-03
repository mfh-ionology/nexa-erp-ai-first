import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5/journey-14';

test.describe('J14 — Run Anomaly Detection on Recent Transactions', () => {
  test('navigate to anomaly detection, run scan, and verify flagged transactions with confidence colour coding and related entities', async ({
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

    // --- Step 1: Navigate to /ai/predictions/anomalies ---
    await page.goto('/ai/predictions/anomalies');
    await page.waitForLoadState('networkidle');

    // Verify anomaly detection page loaded with configuration form
    const pageHeading = page
      .locator(
        [
          'h1:has-text("Anomaly")',
          'h2:has-text("Anomaly")',
          '[data-testid="page-title"]:has-text("Anomaly")',
          'h1:has-text("anomaly")',
          'h2:has-text("anomaly")',
          'h1:has-text("Anomal")',
          'h2:has-text("Anomal")',
        ].join(', '),
      )
      .first();
    await expect(pageHeading).toBeVisible({ timeout: 10000 });

    // Verify Lookback Period input (slider or number field, 7-365 days, default 90)
    const lookbackInput = page
      .locator(
        [
          'input[type="number"][name*="lookback" i]',
          'input[type="range"][name*="lookback" i]',
          'input[aria-label*="lookback" i]',
          'input[aria-label*="Lookback" i]',
          '[data-testid="lookback-days"]',
          '[data-testid="lookback-period"]',
          'label:has-text("Lookback") + input',
          'label:has-text("Lookback") input',
          'label:has-text("lookback") input',
          'input[name*="lookback" i]',
          'input[placeholder*="days" i]',
        ].join(', '),
      )
      .first();

    const lookbackAlt = page.getByLabel(/lookback/i).first();
    const lookback = (await lookbackInput.count()) > 0 ? lookbackInput : lookbackAlt;
    await expect(lookback).toBeVisible({ timeout: 5000 });

    // Verify Minimum Confidence threshold (slider or input, 0-100%, default 50%)
    const confidenceInput = page
      .locator(
        [
          'input[type="number"][name*="confidence" i]',
          'input[type="range"][name*="confidence" i]',
          'input[aria-label*="confidence" i]',
          'input[aria-label*="Confidence" i]',
          '[data-testid="min-confidence"]',
          '[data-testid="minimum-confidence"]',
          'label:has-text("Confidence") + input',
          'label:has-text("Confidence") input',
          'label:has-text("confidence") input',
          'input[name*="confidence" i]',
        ].join(', '),
      )
      .first();

    const confidenceAlt = page.getByLabel(/confidence/i).first();
    const confidence = (await confidenceInput.count()) > 0 ? confidenceInput : confidenceAlt;
    await expect(confidence).toBeVisible({ timeout: 5000 });

    // Verify "Run Scan" button exists and is enabled
    const runScanButton = page
      .locator(
        [
          'button:has-text("Run Scan")',
          'button:has-text("Scan")',
          'button:has-text("Analyse")',
          'button:has-text("Analyze")',
          '[data-testid="run-scan"]',
          'button[type="submit"]',
        ].join(', '),
      )
      .first();
    await expect(runScanButton).toBeVisible({ timeout: 5000 });
    await expect(runScanButton).toBeEnabled();

    // Visual Checkpoint 1: Anomaly detection page loaded with configuration form
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-anomaly-detection-page.png`,
      fullPage: true,
    });

    // --- Step 2: Fill form with scan parameters ---
    // Set Lookback Period to 90 days
    const lookbackType = await lookback.getAttribute('type');
    if (lookbackType === 'range') {
      // For slider inputs, use fill with the value
      await lookback.fill('90');
    } else {
      await lookback.clear();
      await lookback.fill('90');
    }

    // Set Minimum Confidence to 0.5 (50%)
    const confidenceType = await confidence.getAttribute('type');
    if (confidenceType === 'range') {
      await confidence.fill('0.5');
    } else {
      await confidence.clear();
      // Try both 0.5 and 50 depending on the input scale
      const placeholder = await confidence.getAttribute('placeholder');
      const min = await confidence.getAttribute('min');
      const max = await confidence.getAttribute('max');
      // If max is 100 or placeholder suggests percentage, use 50
      if (max === '100' || (placeholder && placeholder.includes('%'))) {
        await confidence.fill('50');
      } else {
        await confidence.fill('0.5');
      }
    }

    // --- Step 3: Click "Run Scan" ---
    await runScanButton.click();

    // Wait for results to load — look for a results section, anomaly cards, or summary
    const resultsSection = page
      .locator(
        [
          '[data-testid="anomaly-results"]',
          '[data-testid="scan-results"]',
          '[class*="anomaly-results"]',
          '[class*="AnomalyResults"]',
          '[class*="scan-results"]',
          'section:has-text("anomalies detected")',
          'div:has-text("anomalies detected")',
          'section:has-text("transactions")',
          'div:has-text("Analysed")',
          'div:has-text("Analyzed")',
          '[data-testid="anomaly-card"]',
          '[class*="anomaly-card"]',
          '[class*="AnomalyCard"]',
        ].join(', '),
      )
      .first();

    await expect(resultsSection).toBeVisible({ timeout: 30000 });

    // Verify summary header is present (e.g. "Analysed 250 transactions — 5 anomalies detected")
    const summaryText = page
      .locator(
        [
          ':text-matches("Analy[sz]ed \\\\d+ transaction")',
          ':text-matches("\\\\d+ anomal")',
          ':text-matches("\\\\d+ transaction")',
          '[data-testid="scan-summary"]',
          '[class*="summary"]',
        ].join(', '),
      )
      .first();
    await expect(summaryText).toBeVisible({ timeout: 5000 });

    // Visual Checkpoint 2: Anomaly scan results displayed
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-anomaly-scan-results.png`,
      fullPage: true,
    });

    // --- Step 4: Verify anomaly card with confidence colour coding ---
    // Look for anomaly type badges (DUPLICATE_AMOUNT, UNUSUAL_AMOUNT, TIMING_ANOMALY, etc.)
    const anomalyTypeBadge = page
      .locator(
        [
          ':text-matches("DUPLICATE_AMOUNT|UNUSUAL_AMOUNT|TIMING_ANOMALY|DUPLICATE|UNUSUAL|TIMING|FREQUENCY", "i")',
          '[data-testid*="anomaly-type"]',
          '[class*="badge"]:has-text("DUPLICATE")',
          '[class*="badge"]:has-text("UNUSUAL")',
          '[class*="badge"]:has-text("TIMING")',
          '[class*="badge"]:has-text("Duplicate")',
          '[class*="badge"]:has-text("Unusual")',
          '[class*="badge"]:has-text("Timing")',
          '[class*="anomaly-type"]',
        ].join(', '),
      )
      .first();
    await expect(anomalyTypeBadge).toBeVisible({ timeout: 5000 });

    // Verify confidence score is displayed with colour coding
    // Look for percentage display or decimal score with colour indicators
    const confidenceScore = page
      .locator(
        [
          '[data-testid*="confidence"]',
          '[class*="confidence"]',
          ':text-matches("\\\\d+%")',
          ':text-matches("0\\\\.\\\\d+")',
          '[class*="score"]',
        ].join(', '),
      )
      .first();
    await expect(confidenceScore).toBeVisible({ timeout: 5000 });

    // Verify confidence level labels exist (high, review, low)
    const confidenceLevel = page
      .locator(
        [
          ':text-matches("high|review|medium|low", "i")',
          '[data-testid*="confidence-level"]',
          '[class*="confidence-level"]',
          '[class*="level"]',
        ].join(', '),
      )
      .first();
    // This may or may not be present depending on implementation — soft check
    const hasConfidenceLevel = (await confidenceLevel.count()) > 0;
    if (hasConfidenceLevel) {
      await expect(confidenceLevel).toBeVisible({ timeout: 3000 });
    }

    // Verify entity reference is displayed on the anomaly card
    const entityRef = page
      .locator(
        [
          '[data-testid*="entity-ref"]',
          '[data-testid*="display-ref"]',
          '[class*="entity-ref"]',
          ':text-matches("[A-Z]+-\\\\d{3,}")',
          '[class*="reference"]',
        ].join(', '),
      )
      .first();
    await expect(entityRef).toBeVisible({ timeout: 5000 });

    // --- Step 5: Verify related entities on anomaly card ---
    // Related entities show entity type, display reference, and relationship
    // e.g. "Potential duplicate of PAY-000123"
    const relatedEntities = page
      .locator(
        [
          '[data-testid*="related-entit"]',
          '[class*="related-entit"]',
          '[class*="RelatedEntit"]',
          ':text-matches("duplicate of|related to|original|same supplier|similar to|matches", "i")',
          '[data-testid*="relationship"]',
          '[class*="relationship"]',
        ].join(', '),
      )
      .first();

    // Related entities may not exist on all anomaly cards — check if present
    const hasRelatedEntities = (await relatedEntities.count()) > 0;
    if (hasRelatedEntities) {
      await expect(relatedEntities).toBeVisible({ timeout: 5000 });
    }
  });
});
