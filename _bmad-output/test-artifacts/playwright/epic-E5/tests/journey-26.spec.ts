import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E5/journey-26';

test.describe('J26 — Verify AI Actions Appear in Audit Trail', () => {
  test('should show AI-created invoice entry in audit log with AI metadata', async ({
    page,
  }) => {
    // ─── Pre-requisite: Login as Finance Manager ───
    // j26 assumes the user is already authenticated from prior journeys,
    // but since tests run in isolation we must login first.
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);

    await page.getByLabel(/email/i).fill('finance@nexa-test.co.uk');
    await page.getByLabel(/password/i).fill('Finance123!');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for redirect away from login
    await page.waitForURL(/^(?!.*\/login)/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // ─── Step 1: Navigate to /system/audit-log ───
    await page.goto('/system/audit-log');
    await page.waitForLoadState('networkidle');

    // Verify the audit log page loaded
    const auditLogHeading = page
      .getByRole('heading', { name: /audit log/i })
      .or(page.getByText(/audit log/i).first())
      .or(page.locator('[data-testid="audit-log-heading"]'));

    const headingVisible = await auditLogHeading.isVisible().catch(() => false);

    // Also look for a data table or list of audit entries
    const auditTable = page
      .getByRole('table')
      .or(page.locator('[data-testid="audit-log-table"]'))
      .or(page.locator('[data-testid="audit-log-list"]'))
      .or(page.locator('table'));

    const tableVisible = await auditTable.first().isVisible().catch(() => false);

    // ─── CHECKPOINT 1: Audit log page loaded ───
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-1-audit-log-page-loaded.png`,
      fullPage: true,
    });

    // The page should have either a heading or a table — at minimum something identifying it as audit log
    const pageHasAuditContent = headingVisible || tableVisible;
    expect(
      pageHasAuditContent,
      'Expected audit log page to have a heading or table of audit entries'
    ).toBeTruthy();

    // ─── Step 2: Verify audit log entry for AI-created invoice ───
    // Look for an entry that was created via AI action (from j09: AI-created invoice for Acme Corp)
    // The entry should show: entity type CustomerInvoice, action CREATE, and an AI indicator

    // Search for AI-related indicators in audit entries
    const aiIndicator = page
      .locator('[data-testid*="ai-action"]')
      .or(page.locator('[data-testid*="ai-badge"]'))
      .or(page.getByText(/ai/i).locator('..').locator('badge, [class*="badge"], [class*="chip"], [class*="tag"]'))
      .or(page.locator('.ai-badge, .ai-indicator, .ai-tag'));

    const aiIndicatorVisible = await aiIndicator.first().isVisible().catch(() => false);

    // Also look for a CREATE action on CustomerInvoice
    const invoiceCreateEntry = page
      .getByText(/customerinvoice/i)
      .or(page.getByText(/customer.?invoice/i))
      .or(page.getByText(/invoice.*create/i))
      .or(page.getByText(/create.*invoice/i));

    const invoiceEntryVisible = await invoiceCreateEntry.first().isVisible().catch(() => false);

    // Look for isAiAction indicator in any form
    const isAiActionField = page
      .getByText(/isAiAction/i)
      .or(page.getByText(/ai.?action.*true/i))
      .or(page.getByText(/ai created/i))
      .or(page.getByText(/ai.?originated/i))
      .or(page.locator('[data-ai-action="true"]'));

    const isAiActionVisible = await isAiActionField.first().isVisible().catch(() => false);

    // ─── CHECKPOINT 2: AI-created invoice audit entry ───
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-ai-invoice-audit-entry.png`,
      fullPage: true,
    });

    // Assert: we expect to find audit entries on this page.
    // If there are no entries at all, or no AI entries, that is a meaningful finding.
    if (tableVisible) {
      // Table exists — look for rows
      const rows = page.locator('table tbody tr, [data-testid*="audit-row"], [role="row"]');
      const rowCount = await rows.count().catch(() => 0);

      // If we have rows but no AI-specific entry, that's notable but may just mean
      // j09 hasn't been run (no AI-created records exist yet).
      if (rowCount === 0) {
        expect(
          rowCount,
          'Audit log table is present but has no entries — expected at least some audit records'
        ).toBeGreaterThan(0);
      }
    }

    // ─── Step 3: Verify AI metadata on audit entry (isAiAction, aiConfidence) ───
    // Try to click on or expand an audit entry to see detail
    // First try clicking on an AI-related row if identifiable
    const aiRow = page
      .locator('tr:has-text("AI")')
      .or(page.locator('tr:has-text("ai")')
        .or(page.locator('[data-testid*="audit-row"]').filter({ hasText: /ai/i })));

    const aiRowVisible = await aiRow.first().isVisible().catch(() => false);

    if (aiRowVisible) {
      // Click to expand or view detail
      await aiRow.first().click();
      await page.waitForTimeout(1000);
    } else if (invoiceEntryVisible) {
      // Click on the invoice-related entry instead
      await invoiceCreateEntry.first().click();
      await page.waitForTimeout(1000);
    }

    // Look for AI metadata fields in the detail view / expanded row / modal
    const aiConfidenceField = page
      .getByText(/aiConfidence/i)
      .or(page.getByText(/ai.?confidence/i))
      .or(page.getByText(/confidence.*score/i))
      .or(page.locator('[data-testid*="ai-confidence"]'));

    const correlationIdField = page
      .getByText(/correlationId/i)
      .or(page.getByText(/correlation.?id/i))
      .or(page.getByText(/conversation.?id/i))
      .or(page.locator('[data-testid*="correlation-id"]'));

    const confidenceVisible = await aiConfidenceField.first().isVisible().catch(() => false);
    const correlationVisible = await correlationIdField.first().isVisible().catch(() => false);

    // ─── CHECKPOINT 3: AI metadata detail view ───
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-ai-metadata-detail.png`,
      fullPage: true,
    });

    // Final assertions:
    // 1. Audit log page loaded (already asserted above)
    // 2. We expect AI metadata fields to be visible on AI-created entries
    //    If no AI-created entries exist (j09 not run), the test should still document what's missing
    if (aiRowVisible || invoiceEntryVisible) {
      // We found an entry — check for metadata
      expect(
        isAiActionVisible || aiIndicatorVisible || confidenceVisible,
        'Expected AI-originated audit entry to display isAiAction indicator, AI badge, or confidence score'
      ).toBeTruthy();
    } else {
      // No AI audit entries found — this could mean j09 wasn't executed or the feature is missing
      expect(
        aiRowVisible || invoiceEntryVisible,
        'Expected to find an audit log entry for an AI-created CustomerInvoice (from j09 action confirmation). ' +
          'Either j09 has not been executed in this session, or the audit trail feature for AI actions is missing.'
      ).toBeTruthy();
    }
  });
});
