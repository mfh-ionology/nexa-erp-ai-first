import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5/journey-15';

test.describe('J15 — Run Duplicate Detection for Customers', () => {
  test('navigate to duplicate detection, select Customer entity type, run scan, and verify duplicate pairs with similarity scores and field-by-field comparison', async ({
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

    // ==========================================================================
    // Step 1: Navigate to /ai/predictions/duplicates
    // ==========================================================================
    await page.goto('/ai/predictions/duplicates');
    await page.waitForLoadState('networkidle');

    // Verify duplicate detection page loaded with heading
    const pageHeading = page
      .locator(
        [
          'h1:has-text("Duplicate")',
          'h2:has-text("Duplicate")',
          '[data-testid="page-title"]:has-text("Duplicate")',
          'h1:has-text("duplicate")',
          'h2:has-text("duplicate")',
        ].join(', '),
      )
      .first();
    await expect(pageHeading).toBeVisible({ timeout: 10000 });

    // Verify Entity Type selector (dropdown: Customer, Supplier, Contact)
    const entityTypeSelect = page
      .locator(
        [
          'select[name*="entity" i]',
          'select[name*="type" i]',
          '[data-testid="entity-type"]',
          '[data-testid="entity-type-select"]',
          '[aria-label*="entity type" i]',
          '[aria-label*="Entity Type" i]',
          'label:has-text("Entity Type") + select',
          'label:has-text("Entity Type") select',
          'label:has-text("entity type") select',
          // For custom select/combobox components
          '[role="combobox"][aria-label*="entity" i]',
          'button[aria-haspopup="listbox"][aria-label*="entity" i]',
        ].join(', '),
      )
      .first();

    const entityTypeByLabel = page.getByLabel(/entity type/i).first();
    const entityType = (await entityTypeSelect.count()) > 0 ? entityTypeSelect : entityTypeByLabel;
    await expect(entityType).toBeVisible({ timeout: 5000 });

    // Verify Minimum Similarity threshold input (slider or number, default 70%)
    const similarityInput = page
      .locator(
        [
          'input[type="number"][name*="similar" i]',
          'input[type="range"][name*="similar" i]',
          'input[aria-label*="similar" i]',
          'input[aria-label*="Similar" i]',
          '[data-testid="min-similarity"]',
          '[data-testid="minimum-similarity"]',
          'label:has-text("Similarity") + input',
          'label:has-text("Similarity") input',
          'label:has-text("similarity") input',
          'input[name*="similarity" i]',
          'input[name*="threshold" i]',
        ].join(', '),
      )
      .first();

    const similarityByLabel = page.getByLabel(/similar/i).first();
    const similarity = (await similarityInput.count()) > 0 ? similarityInput : similarityByLabel;
    await expect(similarity).toBeVisible({ timeout: 5000 });

    // Verify Results Limit input (number input, default 20)
    const limitInput = page
      .locator(
        [
          'input[type="number"][name*="limit" i]',
          'input[aria-label*="limit" i]',
          'input[aria-label*="Limit" i]',
          '[data-testid="results-limit"]',
          '[data-testid="limit"]',
          'label:has-text("Limit") + input',
          'label:has-text("Limit") input',
          'label:has-text("limit") input',
          'label:has-text("Results") + input',
          'label:has-text("Results") input',
          'input[name*="limit" i]',
          'input[name*="results" i]',
        ].join(', '),
      )
      .first();

    const limitByLabel = page.getByLabel(/limit|results/i).first();
    const limit = (await limitInput.count()) > 0 ? limitInput : limitByLabel;
    await expect(limit).toBeVisible({ timeout: 5000 });

    // Verify "Scan for Duplicates" button
    const scanButton = page
      .locator(
        [
          'button:has-text("Scan for Duplicates")',
          'button:has-text("Scan")',
          'button:has-text("Find Duplicates")',
          'button:has-text("Detect")',
          '[data-testid="scan-duplicates"]',
          '[data-testid="run-scan"]',
          'button[type="submit"]',
        ].join(', '),
      )
      .first();
    await expect(scanButton).toBeVisible({ timeout: 5000 });
    await expect(scanButton).toBeEnabled();

    // Visual Checkpoint 1: Duplicate detection page loaded with configuration form
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-duplicate-detection-page.png`,
      fullPage: true,
    });

    // ==========================================================================
    // Step 2: Fill form with Customer duplicate scan parameters
    // ==========================================================================

    // Select "Customer" entity type
    const tagName = await entityType.evaluate((el) => el.tagName.toLowerCase());
    if (tagName === 'select') {
      await entityType.selectOption({ label: 'Customer' });
    } else {
      // For custom dropdown/combobox, click to open then select
      await entityType.click();
      const customerOption = page
        .locator(
          [
            '[role="option"]:has-text("Customer")',
            'li:has-text("Customer")',
            '[data-value="Customer"]',
            '[data-value="customer"]',
            'option:has-text("Customer")',
          ].join(', '),
        )
        .first();
      await customerOption.click();
    }

    // Set Minimum Similarity to 0.7 (70%)
    const similarityType = await similarity.getAttribute('type');
    if (similarityType === 'range') {
      await similarity.fill('0.7');
    } else {
      await similarity.clear();
      // Check input scale — if max is 100, use 70; otherwise use 0.7
      const max = await similarity.getAttribute('max');
      const placeholder = await similarity.getAttribute('placeholder');
      if (max === '100' || (placeholder && placeholder.includes('%'))) {
        await similarity.fill('70');
      } else {
        await similarity.fill('0.7');
      }
    }

    // Set Results Limit to 20
    const limitType = await limit.getAttribute('type');
    if (limitType !== 'range') {
      await limit.clear();
      await limit.fill('20');
    } else {
      await limit.fill('20');
    }

    // ==========================================================================
    // Step 3: Click "Scan for Duplicates" and verify results
    // ==========================================================================
    await scanButton.click();

    // Wait for results to load — look for results section, duplicate pair cards, or summary
    const resultsSection = page
      .locator(
        [
          '[data-testid="duplicate-results"]',
          '[data-testid="scan-results"]',
          '[class*="duplicate-results"]',
          '[class*="DuplicateResults"]',
          '[class*="scan-results"]',
          'section:has-text("duplicate")',
          'div:has-text("duplicate pairs")',
          'div:has-text("potential duplicate")',
          'div:has-text("Scanned")',
          '[data-testid="duplicate-card"]',
          '[data-testid="duplicate-pair"]',
          '[class*="duplicate-card"]',
          '[class*="DuplicateCard"]',
          '[class*="duplicate-pair"]',
          '[class*="DuplicatePair"]',
        ].join(', '),
      )
      .first();

    await expect(resultsSection).toBeVisible({ timeout: 30000 });

    // Verify summary header (e.g. "Scanned 150 customers — 3 potential duplicate pairs found")
    const summaryText = page
      .locator(
        [
          ':text-matches("Scanned \\\\d+ customer")',
          ':text-matches("\\\\d+ potential duplicate")',
          ':text-matches("\\\\d+ duplicate")',
          ':text-matches("\\\\d+ customer")',
          '[data-testid="scan-summary"]',
          '[class*="summary"]',
        ].join(', '),
      )
      .first();
    await expect(summaryText).toBeVisible({ timeout: 5000 });

    // Verify overall similarity score with confidence colour coding
    const similarityScore = page
      .locator(
        [
          '[data-testid*="similarity"]',
          '[data-testid*="score"]',
          '[class*="similarity"]',
          '[class*="score"]',
          ':text-matches("\\\\d+%")',
          ':text-matches("0\\\\.\\\\d+")',
        ].join(', '),
      )
      .first();
    await expect(similarityScore).toBeVisible({ timeout: 5000 });

    // Visual Checkpoint 2: Duplicate scan results displayed
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-duplicate-scan-results.png`,
      fullPage: true,
    });

    // ==========================================================================
    // Step 4: Verify field-by-field comparison table
    // ==========================================================================

    // Look for comparison table with field names, value A, value B, per-field similarity
    const comparisonTable = page
      .locator(
        [
          '[data-testid="field-comparison"]',
          '[data-testid*="comparison"]',
          '[class*="field-comparison"]',
          '[class*="FieldComparison"]',
          '[class*="comparison-table"]',
          '[class*="ComparisonTable"]',
          'table:has-text("Name")',
          'table:has-text("Company")',
          'table:has-text("Address")',
          'table:has-text("VAT")',
          '[data-testid="duplicate-pair"] table',
          '[data-testid="duplicate-card"] table',
        ].join(', '),
      )
      .first();
    await expect(comparisonTable).toBeVisible({ timeout: 5000 });

    // Verify specific comparison fields are present (name, address, VAT, email, phone)
    const fieldNames = page
      .locator(
        [
          ':text-matches("Company Name|Name|Address|VAT|Email|Phone", "i")',
          '[data-testid*="field-name"]',
          'td:has-text("Name")',
          'td:has-text("Address")',
          'td:has-text("VAT")',
          'td:has-text("Email")',
          'td:has-text("Phone")',
          'th:has-text("Field")',
        ].join(', '),
      )
      .first();
    await expect(fieldNames).toBeVisible({ timeout: 5000 });

    // Verify per-field similarity scores exist (0.0-1.0 decimals or percentages)
    const perFieldScore = page
      .locator(
        [
          '[data-testid*="field-score"]',
          '[data-testid*="field-similarity"]',
          '[class*="field-score"]',
          '[class*="field-similarity"]',
          // Look for decimal scores or percentages in the comparison table context
          'td:text-matches("0\\\\.\\\\d+")',
          'td:text-matches("\\\\d+%")',
        ].join(', '),
      )
      .first();
    await expect(perFieldScore).toBeVisible({ timeout: 5000 });

    // Visual Checkpoint 3: Field comparison detail
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-4-field-comparison-detail.png`,
      fullPage: true,
    });
  });
});
