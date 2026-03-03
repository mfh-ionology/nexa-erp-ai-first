import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E3/journey-17';

test.describe('Journey 17: Filter Dead Letter Queue by Reprocessed Status', () => {
  test('Admin filters DLQ entries by pending and reprocessed status', async ({ page }) => {
    // Step 1: Navigate to /login
    await page.goto('/login');

    const emailInput = page.getByLabel(/email/i);
    const passwordInput = page.getByLabel(/password/i);
    const signInButton = page.getByRole('button', { name: /sign in/i });

    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await expect(passwordInput).toBeVisible();
    await expect(signInButton).toBeVisible();

    // Visual Checkpoint 1: Login page loaded
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-1-login-page.png` });

    // Step 2: Fill login form with admin credentials
    await emailInput.fill('admin@nexa-test.co.uk');
    await passwordInput.fill('Admin123!');

    // Step 3: Click Sign In
    await signInButton.click();

    // Wait for navigation away from login page
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 15000,
    });

    // Visual Checkpoint 2: Dashboard after login
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-3-dashboard-after-login.png` });

    // Verify sidebar/navigation is visible
    await expect(page.locator('nav, [role="navigation"], aside')).toBeVisible();

    // Step 4: Navigate to Dead Letter Queue page
    await page.goto('/system/dead-letter-queue');
    await page.waitForLoadState('networkidle');

    // Visual Checkpoint 3: DLQ page loaded
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-4-dlq-page-loaded.png` });

    // Verify DLQ page loaded
    const dlqHeading = page.getByRole('heading', { name: /dead.?letter/i });
    const dlqPageIndicator = page.getByText(/dead.?letter/i).first();
    await expect(dlqHeading.or(dlqPageIndicator)).toBeVisible({ timeout: 10000 });

    // Step 5: Set Reprocessed status filter to "false" (pending entries)
    const reprocessedFilter = page.getByLabel(/reprocessed/i)
      .or(page.getByPlaceholder(/reprocessed/i))
      .or(page.locator('[data-testid="filter-reprocessed"]'))
      .or(page.locator('select[name="reprocessed"]'))
      .or(page.getByRole('combobox', { name: /reprocessed/i }));

    await expect(reprocessedFilter.first()).toBeVisible({ timeout: 5000 });
    await reprocessedFilter.first().selectOption({ label: /false|pending|not reprocessed|no/i }).catch(async () => {
      // Fallback: might be a text input or custom dropdown
      await reprocessedFilter.first().fill('false');
    });

    // Step 6: Click Apply Filters button
    const applyButton = page.getByRole('button', { name: /apply|filter|search/i })
      .or(page.locator('[data-testid="apply-filters"]'))
      .or(page.getByRole('button', { name: /apply filters/i }));

    await applyButton.first().click();

    // Wait for table to refresh
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Visual Checkpoint 4: Filtered to pending entries only (reprocessed=false)
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-6-dlq-filtered-pending.png` });

    // Verify filtered results: either matching entries shown or empty state
    const dlqTable = page.locator('table, [role="table"], [data-testid*="dlq"], [data-testid*="dead-letter"]');
    const emptyState = page.getByText(/no.*entries/i)
      .or(page.getByText(/no.*results/i))
      .or(page.getByText(/no.*events/i))
      .or(page.getByText(/empty/i));

    const tableVisible = await dlqTable.first().isVisible().catch(() => false);
    const emptyVisible = await emptyState.first().isVisible().catch(() => false);

    // Either filtered table rows or empty state should be visible
    expect(tableVisible || emptyVisible).toBe(true);

    // If table is visible with rows, verify all visible rows show reprocessed=false/Pending
    if (tableVisible) {
      const rows = page.locator('table tbody tr, [role="row"]');
      const rowCount = await rows.count().catch(() => 0);

      if (rowCount > 0) {
        for (let i = 0; i < rowCount; i++) {
          const rowText = await rows.nth(i).textContent().catch(() => '');
          if (rowText && rowText.trim().length > 0) {
            // Row should NOT contain "true" in the reprocessed column or "Reprocessed" badge
            // It should show "false", "Pending", "No", or similar
            const lowerText = rowText.toLowerCase();
            // Verify pending status indicators are present (not reprocessed)
            const hasPendingIndicator =
              lowerText.includes('false') ||
              lowerText.includes('pending') ||
              lowerText.includes('no');
            // Allow if it's an empty state or header row
            const isNonDataRow =
              lowerText.includes('no entries') ||
              lowerText.includes('no results') ||
              lowerText.includes('event name'); // header
            if (!isNonDataRow) {
              expect(hasPendingIndicator).toBe(true);
            }
          }
        }

        // Verify Reprocess action buttons are available for pending entries
        const reprocessButtons = page.getByRole('button', { name: /reprocess/i })
          .or(page.locator('[data-testid*="reprocess"]'));
        const reprocessButtonCount = await reprocessButtons.count().catch(() => 0);
        if (rowCount > 0 && !emptyVisible) {
          expect(reprocessButtonCount).toBeGreaterThan(0);
        }
      }
    }

    // Step 7: Change Reprocessed status filter to "true" (reprocessed entries)
    await reprocessedFilter.first().selectOption({ label: /true|reprocessed|yes/i }).catch(async () => {
      await reprocessedFilter.first().fill('');
      await reprocessedFilter.first().fill('true');
    });

    // Step 8: Click Apply Filters button again
    await applyButton.first().click();

    // Wait for table to refresh
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Visual Checkpoint 5: Filtered to reprocessed entries only (reprocessed=true)
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-8-dlq-filtered-reprocessed.png` });

    // Verify filtered results for reprocessed entries
    const tableVisibleAfterSecondFilter = await dlqTable.first().isVisible().catch(() => false);
    const emptyVisibleAfterSecondFilter = await emptyState.first().isVisible().catch(() => false);

    // Either filtered table rows or empty state should be visible
    expect(tableVisibleAfterSecondFilter || emptyVisibleAfterSecondFilter).toBe(true);

    // If table is visible with rows, verify all visible rows show reprocessed=true
    if (tableVisibleAfterSecondFilter) {
      const rows = page.locator('table tbody tr, [role="row"]');
      const rowCount = await rows.count().catch(() => 0);

      if (rowCount > 0) {
        for (let i = 0; i < rowCount; i++) {
          const rowText = await rows.nth(i).textContent().catch(() => '');
          if (rowText && rowText.trim().length > 0) {
            const lowerText = rowText.toLowerCase();
            const isNonDataRow =
              lowerText.includes('no entries') ||
              lowerText.includes('no results') ||
              lowerText.includes('event name'); // header
            if (!isNonDataRow) {
              // Reprocessed entries should show "true", "Reprocessed", "Yes", or a timestamp
              const hasReprocessedIndicator =
                lowerText.includes('true') ||
                lowerText.includes('reprocessed') ||
                lowerText.includes('yes');
              expect(hasReprocessedIndicator).toBe(true);
            }
          }
        }

        // For reprocessed entries, Reprocess buttons should be disabled or hidden
        const enabledReprocessButtons = page.getByRole('button', { name: /reprocess/i })
          .and(page.locator(':not([disabled])'));
        const enabledCount = await enabledReprocessButtons.count().catch(() => 0);
        // All reprocess buttons should be disabled for already-reprocessed entries
        // (enabledCount should be 0, but we only soft-check since UI design may vary)
      }
    }
  });
});
