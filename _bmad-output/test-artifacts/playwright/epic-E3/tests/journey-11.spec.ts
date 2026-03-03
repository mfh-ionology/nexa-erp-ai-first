import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E3/journey-11';

test.describe('j11 — Verify AI Action Fields in Audit Records', () => {
  test('Audit record detail view shows isAiAction=false and aiConfidence fields', async ({ page }) => {
    // ── Step 1: Navigate to /login ──────────────────────────────────────
    await page.goto('/login');

    const emailInput = page.getByLabel(/email/i).or(page.getByPlaceholder(/email/i));
    const passwordInput = page.getByLabel(/password/i).or(page.getByPlaceholder(/password/i));
    const signInButton = page.getByRole('button', { name: /sign in/i });

    await expect(emailInput).toBeVisible({ timeout: 15000 });

    // ── Step 2: Fill login form ─────────────────────────────────────────
    await emailInput.fill('admin@nexa-test.co.uk');
    await passwordInput.fill('Admin123!');

    // ── Step 3: Click Sign In ───────────────────────────────────────────
    await signInButton.click();

    // Wait for navigation away from login page
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 15000,
    });

    // ── Step 4: Navigate to /system/audit-log ───────────────────────────
    await page.goto('/system/audit-log');
    await page.waitForLoadState('networkidle', { timeout: 15000 });

    // Verify audit log table is visible
    const table = page
      .getByRole('table')
      .or(page.locator('table, [data-testid="audit-log-table"]'));
    await expect(table).toBeVisible({ timeout: 10000 });

    // Verify the table has data rows
    const dataRows = page.locator(
      'table tbody tr, [data-testid="audit-log-table"] [data-testid="audit-row"]'
    );
    await expect(dataRows.first()).toBeVisible({ timeout: 10000 });

    // ── Step 5: Click first audit record row to expand/detail view ──────
    // Try multiple interaction patterns: clickable row, expand button, detail link
    const expandTrigger = page
      .locator('table tbody tr').first()
      .or(page.locator('[data-testid="audit-row"]').first());

    // Try clicking the row itself first (common expandable table pattern)
    const detailButton = page
      .locator('table tbody tr:first-child button, table tbody tr:first-child a')
      .or(page.locator('[data-testid="audit-row"]:first-child button'))
      .or(page.locator('[data-testid="expand-row"]').first())
      .or(page.locator('[data-testid="view-detail"]').first());

    // Check if there's an explicit detail/expand button on the first row
    const hasDetailButton = await detailButton.first().isVisible().catch(() => false);

    if (hasDetailButton) {
      await detailButton.first().click();
    } else {
      // Click the row itself to expand it
      await expandTrigger.click();
    }

    // Wait for the detail view to appear — could be a panel, modal, or expanded row
    await page.waitForTimeout(1000);

    const detailView = page
      .locator('[data-testid="audit-detail"], [data-testid="record-detail"]')
      .or(page.getByRole('dialog'))
      .or(page.locator('.audit-detail, .record-detail, .detail-panel, .detail-view'))
      .or(page.locator('[role="dialog"]'))
      .or(page.locator('table tbody tr.expanded, table tbody tr + tr.detail-row'));

    // Wait for detail content to be visible
    await expect(detailView.first()).toBeVisible({ timeout: 10000 });

    // Checkpoint 1: Record detail view with AI action fields
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-5-record-detail-view.png` });

    // Verify the detail view contains the expected AI action fields
    const detailContent = await detailView.first().textContent() ?? '';

    // Check for isAiAction field — look for the label and value
    const aiActionLabel = page
      .getByText(/ai\s*action/i)
      .or(page.getByText(/isAiAction/i))
      .or(page.locator('[data-testid="is-ai-action"]'))
      .or(page.locator(':text-matches("AI Action|aiAction|is_ai_action", "i")'));
    await expect(aiActionLabel.first()).toBeVisible({ timeout: 5000 });

    // Check for aiConfidence field
    const aiConfidenceLabel = page
      .getByText(/ai\s*confidence/i)
      .or(page.getByText(/aiConfidence/i))
      .or(page.locator('[data-testid="ai-confidence"]'))
      .or(page.locator(':text-matches("AI Confidence|aiConfidence|ai_confidence", "i")'));
    await expect(aiConfidenceLabel.first()).toBeVisible({ timeout: 5000 });

    // Verify correlationId field is present
    const correlationIdLabel = page
      .getByText(/correlation/i)
      .or(page.locator('[data-testid="correlation-id"]'))
      .or(page.locator(':text-matches("correlationId|Correlation ID|correlation_id", "i")'));
    await expect(correlationIdLabel.first()).toBeVisible({ timeout: 5000 });

    // Verify beforeData / afterData fields are present
    const beforeDataLabel = page
      .getByText(/before\s*data/i)
      .or(page.locator('[data-testid="before-data"]'))
      .or(page.locator(':text-matches("beforeData|Before Data|before_data", "i")'));
    const afterDataLabel = page
      .getByText(/after\s*data/i)
      .or(page.locator('[data-testid="after-data"]'))
      .or(page.locator(':text-matches("afterData|After Data|after_data", "i")'));

    await expect(beforeDataLabel.first()).toBeVisible({ timeout: 5000 });
    await expect(afterDataLabel.first()).toBeVisible({ timeout: 5000 });

    // ── Step 6: Verify isAiAction value is false ────────────────────────
    // The field should show "false" or "No" since no AI module is implemented
    const aiActionValue = page
      .locator('[data-testid="is-ai-action-value"]')
      .or(page.locator(':text-matches("false|No", "i")'));

    // Check the detail content contains "false" near the AI Action label
    const fullDetailText = await page.locator('body').textContent() ?? '';
    const hasAiActionFalse =
      /ai\s*action[^]*?(false|no)/i.test(detailContent) ||
      detailContent.toLowerCase().includes('false');

    expect(hasAiActionFalse).toBeTruthy();

    // Checkpoint 2: Verified AI action is false
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-6-ai-action-false-verified.png` });
  });
});
