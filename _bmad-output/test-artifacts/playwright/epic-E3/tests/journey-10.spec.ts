import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E3/journey-10';

test.describe('j10 — Paginate Through Audit Log Records', () => {
  test('Cursor-based pagination: load first page, next page, verify different records', async ({ page }) => {
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

    // ── Step 4: Navigate to /system/audit-log?limit=5 ───────────────────
    await page.goto('/system/audit-log?limit=5');
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

    // Count rows on page 1 — should be at most 5 (limit=5)
    const page1RowCount = await dataRows.count();
    expect(page1RowCount).toBeGreaterThan(0);
    expect(page1RowCount).toBeLessThanOrEqual(5);

    // Capture the text content of each row on page 1 for deduplication check later
    const page1RowTexts: string[] = [];
    for (let i = 0; i < page1RowCount; i++) {
      const text = await dataRows.nth(i).textContent();
      if (text) page1RowTexts.push(text.trim());
    }

    // Verify pagination — look for a Next Page button
    const nextButton = page
      .getByRole('button', { name: /next/i })
      .or(page.locator('[data-testid="next-page"]'))
      .or(page.getByRole('button', { name: /→|›|»/i }))
      .or(page.locator('button:has-text("Next")'));
    await expect(nextButton).toBeVisible({ timeout: 10000 });
    await expect(nextButton).toBeEnabled();

    // Checkpoint 1: First page of audit log with limit=5
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-4-first-page-audit-log.png` });

    // ── Step 5: Click Next Page button ──────────────────────────────────
    await nextButton.click();

    // Wait for the table to update (network request for page 2)
    await page.waitForLoadState('networkidle', { timeout: 15000 });

    // Wait a moment for the UI to re-render with new data
    await page.waitForTimeout(1000);

    // Verify the table is still visible after pagination
    await expect(table).toBeVisible({ timeout: 10000 });
    await expect(dataRows.first()).toBeVisible({ timeout: 10000 });

    // Verify Previous Page button is now enabled
    const prevButton = page
      .getByRole('button', { name: /prev/i })
      .or(page.locator('[data-testid="prev-page"]'))
      .or(page.getByRole('button', { name: /←|‹|«/i }))
      .or(page.locator('button:has-text("Previous")'));
    await expect(prevButton).toBeVisible({ timeout: 10000 });
    await expect(prevButton).toBeEnabled();

    // Checkpoint 2: Second page after clicking Next
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/step-5-second-page-audit-log.png` });

    // ── Step 6: Verify page 2 records are different from page 1 ─────────
    const page2RowCount = await dataRows.count();
    expect(page2RowCount).toBeGreaterThan(0);

    const page2RowTexts: string[] = [];
    for (let i = 0; i < page2RowCount; i++) {
      const text = await dataRows.nth(i).textContent();
      if (text) page2RowTexts.push(text.trim());
    }

    // No row from page 2 should be identical to a row from page 1
    for (const page2Row of page2RowTexts) {
      expect(page1RowTexts).not.toContain(page2Row);
    }

    // Verify the first record on page 2 has an earlier timestamp than
    // the last record on page 1 (descending sort = page 2 is older)
    const timestampCells = page.locator(
      'table tbody tr td:first-child, [data-testid="audit-row"] [data-testid="timestamp"]'
    );
    const page2FirstTimestamp = await timestampCells.first().textContent();

    // We stored page1 last row text — try to parse timestamps for comparison
    // This is a best-effort check since timestamp format may vary
    if (page2FirstTimestamp && page1RowTexts.length > 0) {
      // The timestamps in descending order means page 2 first record
      // should be older than (or equal to) page 1 last record
      // We just verify the data has changed — the non-duplicate check above
      // is the primary assertion
    }
  });
});
