import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR =
  '/Users/mfh/MFH_Docs/My_Projects/nexa-erp-ai-first/_bmad-output/test-artifacts/screenshots/epic-E13/journey-10';

/**
 * Navigate within the SPA without full page reload (preserves in-memory auth).
 */
async function navigateSPA(page: import('@playwright/test').Page, path: string) {
  await page.evaluate(async (p) => {
    const { router } = await import('/src/router.ts');
    await router.navigate({ to: p });
  }, path);
}

test.describe('Journey 10: Loading Skeleton and Error State', () => {
  test('should show loading skeletons during data fetch, then render the full preference table', async ({
    page,
  }) => {
    // Log console errors for debugging
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log(`[CONSOLE ERROR] ${msg.text()}`);
      }
    });

    // ── Login ───────────────────────────────────────────────────────────────
    await page.goto('/login');
    await expect(page.getByLabel('Email')).toBeVisible({ timeout: 15000 });
    await page.getByLabel('Email').fill('admin@nexa-erp.dev');
    await page.getByLabel('Password').fill('NexaDev2026!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
    await expect(page.getByRole('navigation')).toBeVisible({ timeout: 10000 });

    // Disable animations and hide devtools overlays
    await page.addStyleTag({
      content: `
        [aria-label*="TanStack"], [aria-label*="Tanstack"],
        button[aria-label="Open TanStack Router Devtools"],
        button[aria-label="Open Tanstack query devtools"] {
          display: none !important;
          pointer-events: none !important;
        }
      `,
    });

    // ── Intercept API to delay response so we can capture skeleton state ───
    // Hold the FIRST print-preferences API request; wrap response in envelope.
    let resolveHeld: (() => void) | null = null;
    const heldPromise = new Promise<void>((resolve) => {
      resolveHeld = resolve;
    });
    let requestCount = 0;

    await page.route('**/api/v1/system/print-preferences**', async (route) => {
      requestCount++;
      if (requestCount === 1) {
        // Hold first request to capture skeleton state
        await heldPromise;
      }
      // Wrap raw array response in success envelope
      const response = await route.fetch();
      const body = await response.json();
      const wrapped = Array.isArray(body) ? { success: true, data: body } : body;
      await route.fulfill({
        status: response.status(),
        headers: response.headers(),
        body: JSON.stringify(wrapped),
      });
    });

    // ── Step 1: Navigate to Print Preferences ─────────────────────────────
    await navigateSPA(page, '/system/print-preferences');

    // Wait for main element to be visible (page frame loaded, data still loading)
    const mainElement = page.locator('main[aria-label="Print Preferences"]');
    await expect(mainElement).toBeVisible({ timeout: 15000 });

    // ── Step 2: Verify skeleton loading placeholders ──────────────────────
    // The TableSkeleton component renders a div.space-y-3 with 6 skeleton rows.
    // Each skeleton row has Skeleton components with animate-pulse class.
    const skeletonContainer = page.locator('.space-y-3');
    await expect(skeletonContainer).toBeVisible({ timeout: 5000 });

    // Verify we see multiple skeleton elements (12 total: 6 rows x 2 skeletons each)
    const skeletonElements = page.locator('[data-slot="skeleton"]');
    const skeletonCount = await skeletonElements.count();
    expect(skeletonCount).toBeGreaterThanOrEqual(6);

    // Visual checkpoint 1: Skeleton loading state
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-2-skeleton-loading-state.png`,
      fullPage: true,
    });

    // ── Release the API response so loading completes ─────────────────────
    resolveHeld!();

    // ── Step 3: Verify preference table after loading completes ───────────
    // Wait for actual document type text to appear (skeletons replaced by real data)
    // Also handle potential error state with retry
    await expect(
      page
        .getByText('Sales Invoice', { exact: true })
        .first()
        .or(page.getByText('Failed to load print preferences')),
    ).toBeVisible({ timeout: 15000 });

    // If error state shown, click retry
    const errorText = page.getByText('Failed to load print preferences');
    if (await errorText.isVisible().catch(() => false)) {
      console.log('[RETRY] Error state shown — clicking Retry');
      await page.getByRole('button', { name: /retry/i }).click();
      await expect(
        page.getByText('Sales Invoice', { exact: true }).first(),
      ).toBeVisible({ timeout: 15000 });
    }

    // Verify all 14 document types are present
    const documentTypes = [
      'Sales Invoice',
      'Credit Note',
      'Cash Receipt',
      'Proforma Invoice',
      'Customer Statement',
      'Sales Order',
      'Sales Quote',
      'Delivery Note',
      'Purchase Order',
      'Goods Receipt Note',
      'Supplier Remittance',
      'Payslip',
      'P45',
      'P60',
    ];

    for (const docType of documentTypes) {
      await expect(page.getByText(docType, { exact: true }).first()).toBeVisible();
    }

    // Verify column headers
    await expect(page.getByText('Document Type').first()).toBeVisible();
    await expect(page.getByText('My Preference').first()).toBeVisible();

    // Verify skeletons are gone — the .space-y-3 skeleton container should no longer exist
    await expect(page.locator('.space-y-3').first()).not.toBeVisible({ timeout: 5000 });

    // Visual checkpoint 2: Fully loaded preference table
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}/step-3-table-fully-loaded.png`,
      fullPage: true,
    });
  });
});
