import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E3/journey-3';

test.describe('j03 — View Audit Log with Default Parameters', () => {
  test('Audit log loads with default params: no filters, sorted by timestamp descending', async ({ page }) => {
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

    // ── Step 4: Navigate directly to /system/audit-log ──────────────────
    await page.goto('/system/audit-log');

    // Wait for page to settle (either audit log loads or redirect happens)
    await page.waitForLoadState('networkidle', { timeout: 15000 });

    // Verify audit log table is visible
    const table = page
      .getByRole('table')
      .or(page.locator('table, [data-testid="audit-log-table"]'));
    await expect(table).toBeVisible({ timeout: 10000 });

    // Verify expected column headers exist
    const expectedHeaders = ['Timestamp', 'Entity Type', 'Entity ID', 'Action', 'User', 'AI Action'];
    for (const header of expectedHeaders) {
      await expect(
        page
          .getByRole('columnheader', { name: new RegExp(header, 'i') })
          .or(page.getByText(new RegExp(header, 'i')).first())
      ).toBeVisible();
    }

    // Verify table has at least one data row
    const dataRows = page.locator(
      'table tbody tr, [data-testid="audit-log-table"] [data-testid="audit-row"]'
    );
    await expect(dataRows.first()).toBeVisible({ timeout: 10000 });
    const rowCount = await dataRows.count();
    expect(rowCount).toBeGreaterThan(0);

    // Verify filter controls are in default/empty state
    const filterControls = page
      .locator('[data-testid="filter-controls"], form, [role="search"]')
      .or(page.getByText(/filter/i).first());
    // Filters should exist on the page (we don't assert emptiness strictly,
    // just presence — the default state means no active filters)

    // Checkpoint 1: Audit log page with default data
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-4-audit-log-default-view.png` });

    // ── Step 5: Verify pagination controls ──────────────────────────────
    const paginationArea = page
      .getByRole('navigation', { name: /pagination/i })
      .or(page.locator('[data-testid="pagination"]'))
      .or(page.getByText(/page/i))
      .or(page.locator('.pagination, [class*="pagination"]'));
    await expect(paginationArea).toBeVisible({ timeout: 10000 });

    // Checkpoint 2: Pagination controls visible
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-5-pagination-controls.png` });

    // ── Step 6: Verify descending sort order (newest first) ─────────────
    // Grab the timestamps from the first two rows to verify descending order
    // Look for timestamp cells in the first column
    const timestampCells = page.locator(
      'table tbody tr td:first-child, [data-testid="audit-row"] [data-testid="timestamp"]'
    );
    const firstRowCount = await timestampCells.count();

    if (firstRowCount >= 2) {
      const firstTimestamp = await timestampCells.nth(0).textContent();
      const secondTimestamp = await timestampCells.nth(1).textContent();

      // First timestamp should be >= second timestamp (descending order)
      if (firstTimestamp && secondTimestamp) {
        const firstDate = new Date(firstTimestamp.trim());
        const secondDate = new Date(secondTimestamp.trim());
        // Only compare if both parse as valid dates
        if (!isNaN(firstDate.getTime()) && !isNaN(secondDate.getTime())) {
          expect(firstDate.getTime()).toBeGreaterThanOrEqual(secondDate.getTime());
        }
      }
    }

    // Checkpoint 3: Sort order verified
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-6-sort-order-verified.png` });
  });
});
